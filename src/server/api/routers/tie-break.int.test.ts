import type { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { anonymous, signedInAs } from "@/test/integration/caller";
import {
	createBallot,
	createElection,
	enrollVoter,
} from "@/test/integration/fixtures";

const errorOf = (promise: Promise<unknown>) =>
	promise.then(
		() => null,
		(e: unknown) => e as TRPCError,
	);

/**
 * A closed election whose President race is tied and can't be separated by
 * an earlier count: Mo 4, Ada 2, Bob 2 in round 1. Ada's voters rank Bob
 * second.
 */
async function tiedElection() {
	const election = await createElection();
	const president = await createBallot(election.id, {
		title: "President",
		candidates: ["Mo", "Ada", "Bob"],
	});
	const idOf = (name: string) =>
		president.candidates.find((c) => c.name === name)?.id ?? "";
	const [mo, ada, bob] = [idOf("Mo"), idOf("Ada"), idOf("Bob")];

	const rankings = [
		[mo],
		[mo],
		[mo],
		[mo],
		[ada, bob],
		[ada, bob],
		[bob],
		[bob],
	];
	for (const [i, ranking] of rankings.entries()) {
		const email = `voter${i}@uoguelph.ca`;
		await enrollVoter(election.id, { email });
		const { caller } = await signedInAs("STUDENT", email);
		await caller.vote.castVotes({
			electionId: election.id,
			votes: [
				{
					ballotId: president.id,
					voteData: { type: "RANKED", rankings: ranking },
				},
			],
		});
	}
	await db.election.update({
		where: { id: election.id },
		data: { endTime: new Date(Date.now() - 1000) },
	});
	return { election, president, mo, ada, bob };
}

describe("deciding a tie by lot", () => {
	it("shows the tie as pending, with no winner, until the CRO records a draw", async () => {
		const { election, president, ada, bob } = await tiedElection();
		const { caller } = await signedInAs("CRO");

		const results = await caller.results.getElectionResults({
			electionId: election.id,
		});
		const ballot = results.ballots.find((b) => b.ballotId === president.id);
		expect(ballot?.pendingTieBreak).toEqual({
			kind: "EXCLUSION",
			round: 1,
			candidateIds: [ada, bob].sort(),
			select: 1,
		});
		expect(ballot?.candidates?.some((c) => c.isWinner)).toBe(false);
	});

	it("records the CRO's draw, recounts, and audit-logs it", async () => {
		const { election, president, mo, ada, bob } = await tiedElection();
		const { caller, user } = await signedInAs("CRO");

		const updated = await caller.results.recordTieBreakDraw({
			electionId: election.id,
			ballotId: president.id,
			selectedCandidateIds: [ada],
		});
		// Ada excluded; her votes move to Bob, leaving Mo and Bob on 4. Round 1
		// had Bob on 2 to Mo's 4, so Bob is excluded and Mo wins
		expect(updated?.pendingTieBreak).toBeUndefined();
		expect(updated?.candidates?.find((c) => c.isWinner)?.candidateId).toBe(mo);
		expect(updated?.tieBreaks?.map((t) => t.method)).toEqual([
			"LOT",
			"PREVIOUS_COUNT",
		]);

		const draw = await db.tieBreakDraw.findFirstOrThrow({
			where: { ballotId: president.id },
		});
		expect(draw).toMatchObject({
			kind: "EXCLUSION",
			round: 1,
			candidateIds: [ada, bob].sort(),
			selectedCandidateIds: [ada],
			decidedById: user.id,
			decidedByEmail: user.email,
		});
		const audit = await db.auditLog.findFirstOrThrow({
			where: { electionId: election.id, action: "results.tie_break_drawn" },
		});
		expect(audit.details).toMatchObject({
			ballotTitle: "President",
			selectedCandidateIds: [ada],
			drawnBy: user.email,
		});
	});

	it("updates results that were already cached", async () => {
		const { election, president, ada, mo } = await tiedElection();
		const { caller } = await signedInAs("CRO");
		const input = { electionId: election.id };

		await caller.results.getElectionResults(input);
		await caller.results.recordTieBreakDraw({
			...input,
			ballotId: president.id,
			selectedCandidateIds: [ada],
		});
		const after = await caller.results.getElectionResults(input);
		const ballot = after.ballots.find((b) => b.ballotId === president.id);
		expect(ballot?.candidates?.find((c) => c.isWinner)?.candidateId).toBe(mo);
	});

	it("blocks finalizing until every tie is decided", async () => {
		const { election, president, ada } = await tiedElection();
		const { caller } = await signedInAs("CRO");
		const input = { electionId: election.id };

		const blocked = await errorOf(caller.results.finalizeResults(input));
		expect(blocked?.code).toBe("BAD_REQUEST");
		expect(blocked?.message).toContain('"President"');

		await caller.results.recordTieBreakDraw({
			...input,
			ballotId: president.id,
			selectedCandidateIds: [ada],
		});
		await caller.results.finalizeResults(input);
		await caller.results.publishResults(input);
		const published = await anonymous().results.getElectionResults(input);
		expect(published.ballots[0]?.tieBreaks?.[0]?.method).toBe("LOT");
	});

	it("lets the CRO draw again when a disqualification changes the tie", async () => {
		// Ada, Bob and Cy have one vote each
		const election = await createElection();
		const ballot = await createBallot(election.id, {
			title: "Treasurer",
			candidates: ["Ada", "Bob", "Cy"],
		});
		const idOf = (name: string) =>
			ballot.candidates.find((c) => c.name === name)?.id ?? "";
		const [ada, bob, cy] = [idOf("Ada"), idOf("Bob"), idOf("Cy")];
		for (const [i, first] of [ada, bob, cy].entries()) {
			const email = `t${i}@uoguelph.ca`;
			await enrollVoter(election.id, { email });
			const { caller } = await signedInAs("STUDENT", email);
			await caller.vote.castVotes({
				electionId: election.id,
				votes: [
					{
						ballotId: ballot.id,
						voteData: { type: "RANKED", rankings: [first] },
					},
				],
			});
		}
		await db.election.update({
			where: { id: election.id },
			data: { endTime: new Date(Date.now() - 1000) },
		});
		const { caller } = await signedInAs("CRO");
		const input = { electionId: election.id, ballotId: ballot.id };

		// First draw: Ada excluded from the three-way tie
		await caller.results.recordTieBreakDraw({
			...input,
			selectedCandidateIds: [ada],
		});

		// Bob is then disqualified, so the count changes: round 1 is now
		// Ada vs Cy, a tie the earlier draw didn't decide
		await caller.ballot.setCandidateStatus({ id: bob, status: "DISQUALIFIED" });
		const results = await caller.results.getElectionResults({
			electionId: election.id,
		});
		expect(results.ballots[0]?.pendingTieBreak).toMatchObject({
			round: 1,
			candidateIds: [ada, cy].sort(),
		});

		const updated = await caller.results.recordTieBreakDraw({
			...input,
			selectedCandidateIds: [cy],
		});
		expect(updated?.candidates?.find((c) => c.isWinner)?.candidateId).toBe(ada);
		// Both draws are kept as history
		expect(
			await db.tieBreakDraw.count({ where: { ballotId: ballot.id } }),
		).toBe(2);
	});

	it("leaves elections counted under the legacy rule as they were", async () => {
		// An election finalized before the Australian rule was adopted (the
		// migration marks these LEGACY): its tie stays decided by candidate id
		const { election, president } = await tiedElection();
		await db.election.update({
			where: { id: election.id },
			data: { tieBreakRule: "LEGACY", isFinalized: true, isPublished: true },
		});
		const { caller } = await signedInAs("CRO");

		const results = await anonymous().results.getElectionResults({
			electionId: election.id,
		});
		const ballot = results.ballots.find((b) => b.ballotId === president.id);
		expect(ballot?.pendingTieBreak).toBeUndefined();
		expect(ballot?.candidates?.filter((c) => c.isWinner)).toHaveLength(1);

		const error = await errorOf(
			caller.results.recordTieBreakDraw({
				electionId: election.id,
				ballotId: president.id,
				selectedCandidateIds: [president.candidates[0]?.id ?? ""],
			}),
		);
		expect(error?.code).toBe("BAD_REQUEST");
	});

	describe("refuses to record a draw", () => {
		it.each([
			["for a candidate who isn't in the tie", "mo"],
			["for more candidates than the draw selects", "both"],
		] as const)("%s", async (_label, choice) => {
			const ctx = await tiedElection();
			const { caller } = await signedInAs("CRO");
			const selected = choice === "mo" ? [ctx.mo] : [ctx.ada, ctx.bob];
			const error = await errorOf(
				caller.results.recordTieBreakDraw({
					electionId: ctx.election.id,
					ballotId: ctx.president.id,
					selectedCandidateIds: selected,
				}),
			);
			expect(error?.code).toBe("BAD_REQUEST");
			expect(await db.tieBreakDraw.count()).toBe(0);
		});

		it("while voting is still open", async () => {
			const ctx = await tiedElection();
			await db.election.update({
				where: { id: ctx.election.id },
				data: { endTime: new Date(Date.now() + 60 * 60 * 1000) },
			});
			const { caller } = await signedInAs("CRO");
			const error = await errorOf(
				caller.results.recordTieBreakDraw({
					electionId: ctx.election.id,
					ballotId: ctx.president.id,
					selectedCandidateIds: [ctx.ada],
				}),
			);
			expect(error?.code).toBe("BAD_REQUEST");
		});

		it("for a ballot with no pending tie", async () => {
			const ctx = await tiedElection();
			const other = await createBallot(ctx.election.id, { type: "REFERENDUM" });
			const { caller } = await signedInAs("CRO");
			const error = await errorOf(
				caller.results.recordTieBreakDraw({
					electionId: ctx.election.id,
					ballotId: other.id,
					selectedCandidateIds: [ctx.ada],
				}),
			);
			expect(error?.code).toBe("BAD_REQUEST");
		});

		it("from an admin who isn't the CRO", async () => {
			const ctx = await tiedElection();
			const { caller } = await signedInAs("ADMIN");
			const error = await errorOf(
				caller.results.recordTieBreakDraw({
					electionId: ctx.election.id,
					ballotId: ctx.president.id,
					selectedCandidateIds: [ctx.ada],
				}),
			);
			expect(error?.code).toBe("FORBIDDEN");
		});

		it("a second time, even when two CROs submit at once", async () => {
			const ctx = await tiedElection();
			const [{ caller: one }, { caller: two }] = await Promise.all([
				signedInAs("CRO"),
				signedInAs("CRO"),
			]);
			const input = {
				electionId: ctx.election.id,
				ballotId: ctx.president.id,
			};
			const outcomes = await Promise.allSettled([
				one.results.recordTieBreakDraw({
					...input,
					selectedCandidateIds: [ctx.ada],
				}),
				two.results.recordTieBreakDraw({
					...input,
					selectedCandidateIds: [ctx.bob],
				}),
			]);
			expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
			expect(await db.tieBreakDraw.count()).toBe(1);
		});
	});
});
