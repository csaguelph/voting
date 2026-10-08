import { describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { anonymous, signedInAs } from "@/test/integration/caller";
import {
	createBallot,
	createElection,
	enrollVoter,
} from "@/test/integration/fixtures";

// Lets a test pause a results request after it has read the database
const gate = vi.hoisted(() => {
	const deferred = () => {
		let resolve = () => {};
		const promise = new Promise<void>((r) => {
			resolve = r;
		});
		return { promise, resolve };
	};
	return { pauseNext: false, paused: deferred(), resume: deferred() };
});

vi.mock("@/lib/results/fetch-election-for-results", async (importOriginal) => {
	const original =
		await importOriginal<
			typeof import("@/lib/results/fetch-election-for-results")
		>();
	return {
		...original,
		fetchElectionForResults: vi.fn(
			async (...args: Parameters<typeof original.fetchElectionForResults>) => {
				const data = await original.fetchElectionForResults(...args);
				if (gate.pauseNext) {
					gate.pauseNext = false;
					gate.paused.resolve();
					await gate.resume.promise;
				}
				return data;
			},
		),
	};
});

describe("results cache under concurrent changes", () => {
	it("doesn't re-cache old results from a request that overlapped a disqualification", async () => {
		// Published results where Ada wins 2-1
		const election = await createElection();
		const ballot = await createBallot(election.id, {
			candidates: ["Ada", "Bob"],
		});
		const [ada, bob] = ballot.candidates.map((c) => c.id) as [string, string];
		for (const [i, first] of [ada, ada, bob].entries()) {
			const email = `v${i}@uoguelph.ca`;
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
			data: {
				endTime: new Date(Date.now() - 1000),
				isFinalized: true,
				isPublished: true,
			},
		});
		const input = { electionId: election.id };

		// A public request reads the votes (cache miss), then stalls
		gate.pauseNext = true;
		const slowRequest = anonymous().results.getElectionResults(input);
		await gate.paused.promise;

		// Meanwhile the CRO disqualifies Ada
		const { caller: cro } = await signedInAs("CRO");
		await cro.ballot.setCandidateStatus({ id: ada, status: "DISQUALIFIED" });

		// The stalled request finishes with the pre-disqualification results
		gate.resume.resolve();
		const stale = await slowRequest;
		const winner = (r: typeof stale) =>
			r.ballots[0]?.candidates?.find((c) => c.isWinner)?.candidateId;
		expect(winner(stale)).toBe(ada);

		// ...but those results must not be what later visitors see
		const after = await anonymous().results.getElectionResults(input);
		expect(winner(after)).toBe(bob);
	});
});
