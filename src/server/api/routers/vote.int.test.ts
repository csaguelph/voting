import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyVoteHash } from "@/lib/voting/hash";
import {
	IDENTITY_CONFIRMATION_MS,
	IDENTITY_LOCKOUT_MS,
	MAX_IDENTITY_ATTEMPTS,
} from "@/lib/voting/identity";
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

		it.each([
			["hasn't confirmed their student ID", null],
			[
				"confirmed their student ID too long ago",
				new Date(Date.now() - IDENTITY_CONFIRMATION_MS - 1000),
			],
		])("%s", async (_label, identityConfirmedAt) => {
			const ctx = await setup();
			await db.eligibleVoter.update({
				where: { id: ctx.voter.id },
				data: { identityConfirmedAt },
			});
			await expectRejected(ctx, ctx.fullBallot, "PRECONDITION_FAILED");
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

	describe("rejects a ballot that", () => {
		it("belongs to another college", async () => {
			const ctx = await setup();
			await expectRejected(
				ctx,
				[{ ballotId: ctx.oac.id, voteData: ranked(ctx.id(ctx.oac, 0)) }],
				"BAD_REQUEST",
			);
		});

		it("belongs to another election", async () => {
			const ctx = await setup();
			const other = await createElection({ name: "Other" });
			const foreign = await createBallot(other.id, { type: "REFERENDUM" });
			await expectRejected(
				ctx,
				[{ ballotId: foreign.id, voteData: YES }],
				"BAD_REQUEST",
			);
		});

		it("doesn't exist", async () => {
			const ctx = await setup();
			await expectRejected(
				ctx,
				[{ ballotId: "no-such-ballot", voteData: YES }],
				"BAD_REQUEST",
			);
		});

		it("is voted on twice in one submission", async () => {
			const ctx = await setup();
			await expectRejected(
				ctx,
				[
					{ ballotId: ctx.ref.id, voteData: YES },
					{ ballotId: ctx.ref.id, voteData: { type: "NO" } },
				],
				"BAD_REQUEST",
			);
		});

		it("makes the whole submission fail, not just that vote", async () => {
			const ctx = await setup();
			await expectRejected(
				ctx,
				[
					...ctx.fullBallot,
					{ ballotId: ctx.oac.id, voteData: ranked(ctx.id(ctx.oac, 0)) },
				],
				"BAD_REQUEST",
			);
		});

		it("is empty", async () => {
			const ctx = await setup();
			await expectRejected(ctx, [], "BAD_REQUEST");
		});
	});

	describe("rejects a vote that", () => {
		it("ranks a candidate from a different ballot", async () => {
			const ctx = await setup();
			await expectRejected(
				ctx,
				[{ ballotId: ctx.exec.id, voteData: ranked(ctx.id(ctx.coe, 0)) }],
				"BAD_REQUEST",
			);
		});

		it("ranks the same candidate twice", async () => {
			const ctx = await setup();
			const ada = ctx.id(ctx.exec, 0);
			await expectRejected(
				ctx,
				[{ ballotId: ctx.exec.id, voteData: ranked(ada, ada) }],
				"BAD_REQUEST",
			);
		});

		it("ranks nobody", async () => {
			const ctx = await setup();
			await expectRejected(
				ctx,
				[{ ballotId: ctx.exec.id, voteData: ranked() }],
				"BAD_REQUEST",
			);
		});

		it.each([
			["ranks candidates on a referendum", "ref", "RANKED"],
			["answers YES on a multi-candidate ballot", "exec", "YES"],
			["ranks on a single-candidate (YES/NO) ballot", "solo", "RANKED"],
		] as const)("%s", async (_label, ballotKey, type) => {
			const ctx = await setup();
			const ballot = ctx[ballotKey];
			const voteData =
				type === "RANKED" ? ranked(ballot.candidates[0]?.id ?? "x") : YES;
			await expectRejected(
				ctx,
				[{ ballotId: ballot.id, voteData }],
				"BAD_REQUEST",
			);
		});
	});
});

describe("vote.checkEligibility", () => {
	it("never sends the student ID to the browser", async () => {
		const ctx = await setup();
		const result = await ctx.caller.vote.checkEligibility({
			electionId: ctx.election.id,
		});
		expect(result.eligible).toBe(true);
		expect(JSON.stringify(result)).not.toContain(STUDENT_ID);
	});

	it("reports whether the voter still has to confirm their student ID", async () => {
		const ctx = await setup();
		await db.eligibleVoter.update({
			where: { id: ctx.voter.id },
			data: { identityConfirmedAt: null },
		});
		const result = await ctx.caller.vote.checkEligibility({
			electionId: ctx.election.id,
		});
		expect(result.identity).toEqual({ confirmed: false, lockedUntil: null });
	});
});

describe("vote.confirmIdentity", () => {
	/** A voter who hasn't confirmed their student ID yet */
	async function unconfirmed() {
		const ctx = await setup();
		await db.eligibleVoter.update({
			where: { id: ctx.voter.id },
			data: { identityConfirmedAt: null },
		});
		const confirm = (studentId: string) =>
			ctx.caller.vote.confirmIdentity({
				electionId: ctx.election.id,
				studentId,
			});
		const voterRow = () =>
			db.eligibleVoter.findUniqueOrThrow({ where: { id: ctx.voter.id } });
		return { ...ctx, confirm, voterRow };
	}

	it("opens the ballot for the right student ID, however it's typed", async () => {
		const ctx = await unconfirmed();
		expect(await ctx.confirm(" 123 4567 ")).toEqual({ status: "confirmed" });
		expect((await ctx.voterRow()).identityConfirmedAt).not.toBeNull();
		const result = await ctx.caller.vote.castVotes({
			electionId: ctx.election.id,
			votes: ctx.fullBallot,
		});
		expect(result.success).toBe(true);
	});

	it("counts down the attempts left and audit-logs each wrong ID, without the ID", async () => {
		const ctx = await unconfirmed();
		expect(await ctx.confirm("7654321")).toEqual({
			status: "incorrect",
			attemptsLeft: MAX_IDENTITY_ATTEMPTS - 1,
		});
		expect(await ctx.confirm("7654321")).toEqual({
			status: "incorrect",
			attemptsLeft: MAX_IDENTITY_ATTEMPTS - 2,
		});
		expect((await ctx.voterRow()).identityConfirmedAt).toBeNull();

		const logs = await db.auditLog.findMany({
			where: { action: "voter.identity_failed" },
			orderBy: { timestamp: "asc" },
		});
		expect(logs.map((l) => l.details)).toMatchObject([
			{ voterId: ctx.voter.id, attempt: 1 },
			{ voterId: ctx.voter.id, attempt: 2 },
		]);
		expect(JSON.stringify(logs)).not.toContain("7654321");
	});

	it("resets the count after a correct ID", async () => {
		const ctx = await unconfirmed();
		await ctx.confirm("7654321");
		await ctx.confirm(STUDENT_ID);
		expect((await ctx.voterRow()).identityCheckFailures).toBe(0);
	});

	it("locks the ballot after too many wrong IDs, even for the right one", async () => {
		const ctx = await unconfirmed();
		for (let i = 1; i < MAX_IDENTITY_ATTEMPTS; i++) {
			await ctx.confirm("7654321");
		}
		const before = Date.now();
		const locked = await ctx.confirm("7654321");
		expect(locked.status).toBe("locked");
		const lockedUntil =
			locked.status === "locked" ? locked.lockedUntil.getTime() : 0;
		expect(lockedUntil).toBeGreaterThanOrEqual(before + IDENTITY_LOCKOUT_MS);
		expect(
			await db.auditLog.count({ where: { action: "voter.identity_locked" } }),
		).toBe(1);
		// Including the attempt that set off the lockout
		expect(
			await db.auditLog.count({ where: { action: "voter.identity_failed" } }),
		).toBe(MAX_IDENTITY_ATTEMPTS);

		expect(await ctx.confirm(STUDENT_ID)).toMatchObject({ status: "locked" });
		expect((await ctx.voterRow()).identityConfirmedAt).toBeNull();
		await expectRejected(ctx, ctx.fullBallot, "PRECONDITION_FAILED");
		expect(
			(await ctx.caller.vote.checkEligibility({ electionId: ctx.election.id }))
				.identity?.lockedUntil,
		).toEqual(new Date(lockedUntil));
	});

	it("gets only the allowed tries from a burst of parallel guesses", async () => {
		const ctx = await unconfirmed();
		const results = await Promise.all(
			Array.from({ length: MAX_IDENTITY_ATTEMPTS * 4 }, () =>
				ctx.confirm("7654321"),
			),
		);
		const count = (status: string) =>
			results.filter((r) => r.status === status).length;
		// Every guess after the lockout is refused without being checked
		expect(count("incorrect")).toBe(MAX_IDENTITY_ATTEMPTS - 1);
		expect(count("locked")).toBe(results.length - MAX_IDENTITY_ATTEMPTS + 1);
		expect(
			await db.auditLog.count({ where: { action: "voter.identity_locked" } }),
		).toBe(1);
		expect(await ctx.confirm(STUDENT_ID)).toMatchObject({ status: "locked" });
	});

	it("can't have a lockout undone by a correct guess racing it", async () => {
		const ctx = await unconfirmed();
		for (let trial = 0; trial < 20; trial++) {
			await db.eligibleVoter.update({
				where: { id: ctx.voter.id },
				data: {
					identityCheckFailures: MAX_IDENTITY_ATTEMPTS - 1,
					identityLockedUntil: null,
					identityConfirmedAt: null,
				},
			});
			const [wrong, right] = await Promise.all([
				ctx.confirm("7654321"),
				ctx.confirm(STUDENT_ID),
			]);
			const row = await ctx.voterRow();

			// Either order is fine, as long as the guesses are handled one at a time
			if (wrong.status === "locked") {
				expect(right.status).toBe("locked");
				expect(row.identityConfirmedAt).toBeNull();
				expect(row.identityLockedUntil).not.toBeNull();
			} else {
				expect(right.status).toBe("confirmed");
				expect(wrong).toEqual({
					status: "incorrect",
					attemptsLeft: MAX_IDENTITY_ATTEMPTS - 1,
				});
				expect(row.identityLockedUntil).toBeNull();
			}
		}
	});

	it("opens again once the lockout ends", async () => {
		const ctx = await unconfirmed();
		await db.eligibleVoter.update({
			where: { id: ctx.voter.id },
			data: { identityLockedUntil: new Date(Date.now() - 1000) },
		});
		expect(await ctx.confirm(STUDENT_ID)).toEqual({ status: "confirmed" });
	});

	it("is refused once the voter has voted", async () => {
		const ctx = await setup();
		await ctx.caller.vote.castVotes({
			electionId: ctx.election.id,
			votes: ctx.fullBallot,
		});
		const error = await ctx.caller.vote
			.confirmIdentity({ electionId: ctx.election.id, studentId: STUDENT_ID })
			.catch((e: unknown) => e);
		expect((error as TRPCError).code).toBe("CONFLICT");
	});
});
