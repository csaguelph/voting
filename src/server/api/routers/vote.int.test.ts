import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyVoteHash } from "@/lib/voting/hash";
import { db } from "@/server/db";
import { signedInAs } from "@/test/integration/caller";
import {
	createBallot,
	createElection,
	enrollVoter,
} from "@/test/integration/fixtures";

const HOUR = 60 * 60 * 1000;
const STUDENT_ID = "1234567";

type CastInput = Parameters<
	Awaited<ReturnType<typeof signedInAs>>["caller"]["vote"]["castVotes"]
>[0];
type VoteData = CastInput["votes"][number]["voteData"];

const ranked = (...rankings: string[]): VoteData => ({
	type: "RANKED",
	rankings,
});
const YES: VoteData = { type: "YES" };
const ABSTAIN: VoteData = { type: "ABSTAIN" };

/**
 * An open election with every ballot shape, and a COE student on the roll:
 * - exec: ranked, three active candidates and one withdrawn
 * - solo: a single-candidate (YES/NO) executive ballot
 * - coe / oac: director ballots for two colleges
 * - ref: a referendum
 */
async function setup() {
	const election = await createElection();
	const exec = await createBallot(election.id, {
		title: "President",
		candidates: ["Ada", "Bob", "Cy", { name: "Will", status: "WITHDRAWN" }],
	});
	const solo = await createBallot(election.id, {
		title: "Treasurer",
		candidates: ["Solo"],
	});
	const coe = await createBallot(election.id, {
		type: "DIRECTOR",
		college: "COE",
		candidates: ["Dee", "Eve"],
	});
	const oac = await createBallot(election.id, {
		type: "DIRECTOR",
		college: "OAC",
		candidates: ["Fay", "Gus"],
	});
	const ref = await createBallot(election.id, { type: "REFERENDUM" });

	const voter = await enrollVoter(election.id, {
		email: "student@uoguelph.ca",
		college: "COE",
		studentId: STUDENT_ID,
	});
	const { caller } = await signedInAs("STUDENT", "student@uoguelph.ca");

	const id = (ballot: { candidates: { id: string }[] }, i: number) =>
		ballot.candidates[i]?.id ?? "";
	const fullBallot: CastInput["votes"] = [
		{ ballotId: exec.id, voteData: ranked(id(exec, 1), id(exec, 0)) },
		{ ballotId: solo.id, voteData: YES },
		{ ballotId: coe.id, voteData: ranked(id(coe, 0)) },
		{ ballotId: ref.id, voteData: { type: "NO" } },
	];

	return { election, exec, solo, coe, oac, ref, voter, caller, id, fullBallot };
}

type Setup = Awaited<ReturnType<typeof setup>>;

async function expectRejected(
	ctx: Setup,
	votes: CastInput["votes"],
	code: TRPCError["code"],
) {
	const error = await ctx.caller.vote
		.castVotes({ electionId: ctx.election.id, votes })
		.then(
			() => null,
			(e: unknown) => e,
		);
	expect(error, "expected castVotes to be rejected").toBeInstanceOf(TRPCError);
	expect((error as TRPCError).code).toBe(code);

	// Nothing recorded, and the voter can still vote
	expect(await db.vote.count()).toBe(0);
	const voter = await db.eligibleVoter.findUniqueOrThrow({
		where: { id: ctx.voter.id },
	});
	expect(voter.hasVoted).toBe(false);
	return error as TRPCError;
}

beforeEach(() => {
	// castVotes logs the underlying error when a transaction fails
	vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("vote.castVotes", () => {
	describe("accepts", () => {
		it("a full ballot, recording every vote atomically", async () => {
			const ctx = await setup();
			const result = await ctx.caller.vote.castVotes({
				electionId: ctx.election.id,
				votes: ctx.fullBallot,
			});

			expect(result).toMatchObject({ success: true, voteCount: 4 });
			const votes = await db.vote.findMany();
			expect(votes.map((v) => v.ballotId).sort()).toEqual(
				ctx.fullBallot.map((v) => v.ballotId).sort(),
			);

			const voter = await db.eligibleVoter.findUniqueOrThrow({
				where: { id: ctx.voter.id },
			});
			expect(voter.hasVoted).toBe(true);
			expect(voter.votedAt).not.toBeNull();
		});

		it("returns receipt hashes that verify against the stored votes", async () => {
			const ctx = await setup();
			const result = await ctx.caller.vote.castVotes({
				electionId: ctx.election.id,
				votes: ctx.fullBallot,
			});

			for (const receipt of result.votes) {
				const stored = await db.vote.findUniqueOrThrow({
					where: { voteHash: receipt.voteHash },
				});
				expect(stored.ballotId).toBe(receipt.ballotId);
				expect(
					verifyVoteHash(receipt.voteHash, {
						electionId: ctx.election.id,
						ballotId: stored.ballotId,
						voteData: stored.voteData,
						voterId: STUDENT_ID,
						timestamp: receipt.timestamp,
					}),
				).toBe(true);
			}
		});

		it("an audit entry that doesn't reveal any choices", async () => {
			const ctx = await setup();
			await ctx.caller.vote.castVotes({
				electionId: ctx.election.id,
				votes: ctx.fullBallot,
			});

			const [log, ...rest] = await db.auditLog.findMany({
				where: { action: "votes.cast" },
			});
			expect(rest).toHaveLength(0);
			expect(log?.details).toMatchObject({ ballotCount: 4 });
			const details = JSON.stringify(log?.details);
			for (const candidate of [...ctx.exec.candidates, ...ctx.coe.candidates]) {
				expect(details).not.toContain(candidate.id);
			}
			expect(details).not.toMatch(/"(YES|NO|RANKED)"/);
		});

		it("a partial ballot (skipped ballots are simply not voted on)", async () => {
			const ctx = await setup();
			await ctx.caller.vote.castVotes({
				electionId: ctx.election.id,
				votes: [{ ballotId: ctx.ref.id, voteData: YES }],
			});
			expect(await db.vote.count()).toBe(1);
		});

		it("an abstention on any ballot type", async () => {
			const ctx = await setup();
			await ctx.caller.vote.castVotes({
				electionId: ctx.election.id,
				votes: [ctx.exec, ctx.solo, ctx.coe, ctx.ref].map((b) => ({
					ballotId: b.id,
					voteData: ABSTAIN,
				})),
			});
			expect(await db.vote.count()).toBe(4);
		});

		it("rankings that include a withdrawn candidate", async () => {
			// Voters can still see withdrawn candidates; counting transfers past them
			const ctx = await setup();
			await ctx.caller.vote.castVotes({
				electionId: ctx.election.id,
				votes: [
					{
						ballotId: ctx.exec.id,
						voteData: ranked(ctx.id(ctx.exec, 3), ctx.id(ctx.exec, 0)),
					},
				],
			});
			expect(await db.vote.count()).toBe(1);
		});
	});

	describe("rejects a voter who", () => {
		it("has already voted", async () => {
			const ctx = await setup();
			await ctx.caller.vote.castVotes({
				electionId: ctx.election.id,
				votes: ctx.fullBallot,
			});

			const error = await ctx.caller.vote
				.castVotes({ electionId: ctx.election.id, votes: ctx.fullBallot })
				.catch((e: unknown) => e);
			expect((error as TRPCError).code).toBe("CONFLICT");
			expect(await db.vote.count()).toBe(4);
		});

		it("submits several times at once: exactly one submission counts", async () => {
			const ctx = await setup();
			const attempts = await Promise.allSettled(
				Array.from({ length: 5 }, () =>
					ctx.caller.vote.castVotes({
						electionId: ctx.election.id,
						votes: ctx.fullBallot,
					}),
				),
			);

			const succeeded = attempts.filter((a) => a.status === "fulfilled");
			const rejected = attempts.filter(
				(a): a is PromiseRejectedResult => a.status === "rejected",
			);
			expect(succeeded).toHaveLength(1);
			for (const r of rejected) {
				expect((r.reason as TRPCError).code).toBe("CONFLICT");
			}
			expect(await db.vote.count()).toBe(ctx.fullBallot.length);
			expect(await db.auditLog.count({ where: { action: "votes.cast" } })).toBe(
				1,
			);
		});

		it("isn't on the voter roll", async () => {
			const ctx = await setup();
			const { caller } = await signedInAs(
				"STUDENT",
				"someone-else@uoguelph.ca",
			);
			const error = await caller.vote
				.castVotes({ electionId: ctx.election.id, votes: ctx.fullBallot })
				.catch((e: unknown) => e);
			expect((error as TRPCError).code).toBe("FORBIDDEN");
			expect(await db.vote.count()).toBe(0);
		});

		it.each([
			["before voting opens", { startTime: new Date(Date.now() + HOUR) }],
			["after voting closes", { endTime: new Date(Date.now() - 1000) }],
		])("votes %s", async (_label, window) => {
			const ctx = await setup();
			await db.election.update({
				where: { id: ctx.election.id },
				data: window,
			});
			await expectRejected(ctx, ctx.fullBallot, "FORBIDDEN");
		});
	});
});
