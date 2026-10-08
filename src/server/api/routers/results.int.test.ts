import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { anonymous, signedInAs } from "@/test/integration/caller";
import {
	createBallot,
	createElection,
	enrollVoter,
} from "@/test/integration/fixtures";

const HOUR = 60 * 60 * 1000;

const errorCode = (promise: Promise<unknown>) =>
	promise.then(
		() => "success",
		(e: unknown) => (e instanceof TRPCError ? e.code : String(e)),
	);

/**
 * An election with real votes cast through the app:
 * - President (ranked): Ada 2, Bob 2, Cy 1 first choices; Cy's voter ranks
 *   Ada second, so Ada wins 3-2 after Cy is eliminated
 * - Fee (referendum): 3 YES, 1 NO, 1 ABSTAIN
 * Six voters are on the roll (four COE, two OAC) and five vote.
 */
async function electionWithVotes() {
	const election = await createElection();
	const president = await createBallot(election.id, {
		title: "President",
		candidates: ["Ada", "Bob", "Cy"],
	});
	const fee = await createBallot(election.id, {
		type: "REFERENDUM",
		title: "Fee",
	});
	const [ada, bob, cy] = president.candidates.map((c) => c.id) as [
		string,
		string,
		string,
	];

	const ballots = [
		{ rankings: [ada], fee: "YES" },
		{ rankings: [ada, bob], fee: "YES" },
		{ rankings: [bob], fee: "NO" },
		{ rankings: [bob, cy], fee: "YES" },
		{ rankings: [cy, ada], fee: "ABSTAIN" },
	] as const;
	for (const [i, choice] of ballots.entries()) {
		const email = `voter${i}@uoguelph.ca`;
		await enrollVoter(election.id, { email, college: i < 3 ? "COE" : "OAC" });
		const { caller } = await signedInAs("STUDENT", email);
		await caller.vote.castVotes({
			electionId: election.id,
			votes: [
				{
					ballotId: president.id,
					voteData: { type: "RANKED", rankings: [...choice.rankings] },
				},
				{ ballotId: fee.id, voteData: { type: choice.fee } },
			],
		});
	}
	await enrollVoter(election.id, { email: "absent@uoguelph.ca" });

	// Close voting
	await db.election.update({
		where: { id: election.id },
		data: { endTime: new Date(Date.now() - 1000) },
	});
	return { election, president, fee, ada, bob, cy };
}

describe("results.getElectionResults", () => {
	it("counts votes cast through the app", async () => {
		const { election, president, fee, ada } = await electionWithVotes();
		const { caller } = await signedInAs("CRO");
		const results = await caller.results.getElectionResults({
			electionId: election.id,
		});

		expect(results).toMatchObject({
			totalEligibleVoters: 6,
			totalVoted: 5,
			turnoutPercentage: 83.33,
			isAdmin: true,
		});

		const pres = results.ballots.find((b) => b.ballotId === president.id);
		const winner = pres?.candidates?.find((c) => c.isWinner);
		expect(winner?.candidateId).toBe(ada);
		expect(pres?.rankedChoiceDetails?.description).toEqual([
			"Round 1: Ada: 2, Bob: 2, Cy: 1. Eliminated: Cy",
			"Round 2 (Final): Ada: 3, Bob: 2",
		]);

		const ref = results.ballots.find((b) => b.ballotId === fee.id);
		expect(ref?.referendum).toMatchObject({ yes: 3, no: 1, passed: true });
		expect(ref?.totalVotes).toBe(5);
	});

	it("hides unpublished results from everyone but admins and CROs", async () => {
		const { election } = await electionWithVotes();
		const input = { electionId: election.id };
		const { caller: student } = await signedInAs("STUDENT");

		expect(await errorCode(anonymous().results.getElectionResults(input))).toBe(
			"FORBIDDEN",
		);
		expect(await errorCode(student.results.getElectionResults(input))).toBe(
			"FORBIDDEN",
		);
		for (const role of ["ADMIN", "CRO"] as const) {
			const { caller } = await signedInAs(role);
			expect(await errorCode(caller.results.getElectionResults(input))).toBe(
				"success",
			);
		}
	});
});

describe("finalizing and publishing results", () => {
	it("can't finalize before voting closes", async () => {
		const election = await createElection();
		const { caller } = await signedInAs("CRO");
		expect(
			await errorCode(
				caller.results.finalizeResults({ electionId: election.id }),
			),
		).toBe("BAD_REQUEST");
	});

	it("goes finalized -> published -> unpublished, audit-logging each step", async () => {
		const { election } = await electionWithVotes();
		const input = { electionId: election.id };
		const { caller, user } = await signedInAs("CRO");

		// Publishing requires finalizing first
		expect(await errorCode(caller.results.publishResults(input))).toBe(
			"BAD_REQUEST",
		);

		await caller.results.finalizeResults(input);
		expect(await errorCode(caller.results.finalizeResults(input))).toBe(
			"BAD_REQUEST",
		);
		await caller.results.publishResults(input);
		expect(await errorCode(caller.results.publishResults(input))).toBe(
			"BAD_REQUEST",
		);
		expect(await errorCode(anonymous().results.getElectionResults(input))).toBe(
			"success",
		);

		await caller.results.unpublishResults(input);
		expect(await errorCode(caller.results.unpublishResults(input))).toBe(
			"BAD_REQUEST",
		);
		const status = await anonymous().results.getResultsStatus(input);
		expect(status).toMatchObject({
			isFinalized: true,
			isPublished: false,
			publishedAt: null,
		});

		const actions = await db.auditLog.findMany({
			where: { electionId: election.id, action: { startsWith: "results." } },
			orderBy: { timestamp: "asc" },
		});
		expect(actions.map((a) => a.action)).toEqual([
			"results.finalized",
			"results.published",
			"results.unpublished",
		]);
		expect(actions.map((a) => a.details)).toEqual([
			expect.objectContaining({ finalizedBy: user.email }),
			expect.objectContaining({ publishedBy: user.email }),
			expect.objectContaining({ unpublishedBy: user.email }),
		]);
	});
});

describe("results cache", () => {
	it("serves cached results until something invalidates them", async () => {
		const { election } = await electionWithVotes();
		const { caller } = await signedInAs("CRO");
		const input = { electionId: election.id };

		const first = await caller.results.getElectionResults(input);
		// A vote recorded directly doesn't invalidate the cache by itself
		await db.eligibleVoter.updateMany({
			where: { email: "absent@uoguelph.ca" },
			data: { hasVoted: true },
		});
		const second = await caller.results.getElectionResults(input);
		expect(second.totalVoted).toBe(first.totalVoted);
	});

	it("shows newly published results to the public right away", async () => {
		const { election } = await electionWithVotes();
		const { caller } = await signedInAs("CRO");
		const input = { electionId: election.id };

		// Cached while unpublished
		await caller.results.getElectionResults(input);
		await caller.results.finalizeResults(input);
		await caller.results.publishResults(input);

		expect(await errorCode(anonymous().results.getElectionResults(input))).toBe(
			"success",
		);
	});

	it("stops showing results to the public as soon as they're unpublished", async () => {
		const { election } = await electionWithVotes();
		const { caller } = await signedInAs("CRO");
		const input = { electionId: election.id };
		await caller.results.finalizeResults(input);
		await caller.results.publishResults(input);

		// Cached while published
		await anonymous().results.getElectionResults(input);
		await caller.results.unpublishResults(input);

		expect(await errorCode(anonymous().results.getElectionResults(input))).toBe(
			"FORBIDDEN",
		);
	});

	it("reflects quorum changes immediately", async () => {
		const { election } = await electionWithVotes();
		const { caller } = await signedInAs("ADMIN");
		const input = { electionId: election.id };

		const before = await caller.results.getElectionResults(input);
		expect(before.ballots[0]?.quorumPercentage).toBe(10);

		await caller.settings.updateQuorum({
			executiveQuorum: 90,
			directorQuorum: 10,
			referendumQuorum: 90,
		});
		const after = await caller.results.getElectionResults(input);
		expect(after.ballots.map((b) => b.quorumPercentage)).toEqual([90, 90]);
		expect(after.ballots.every((b) => !b.hasReachedQuorum)).toBe(true);
	});

	it("reflects a candidate disqualified after results were published", async () => {
		// e.g. a post-election appeal ruling
		const { election, president, ada, bob } = await electionWithVotes();
		const { caller } = await signedInAs("CRO");
		const input = { electionId: election.id };
		await caller.results.finalizeResults(input);
		await caller.results.publishResults(input);

		const before = await anonymous().results.getElectionResults(input);
		const winnerBefore = before.ballots
			.find((b) => b.ballotId === president.id)
			?.candidates?.find((c) => c.isWinner);
		expect(winnerBefore?.candidateId).toBe(ada);

		await caller.ballot.setCandidateStatus({
			id: ada,
			status: "DISQUALIFIED",
			statusReason: "Campaign violation",
		});

		const after = await anonymous().results.getElectionResults(input);
		const pres = after.ballots.find((b) => b.ballotId === president.id);
		expect(pres?.candidates?.find((c) => c.isWinner)?.candidateId).toBe(bob);
		expect(after.withdrawalsAndDisqualifications).toEqual([
			expect.objectContaining({ candidateId: ada, status: "DISQUALIFIED" }),
		]);
	});

	it("reflects election details changed after results were cached", async () => {
		const { election } = await electionWithVotes();
		const { caller } = await signedInAs("ADMIN");
		const input = { electionId: election.id };

		await caller.results.getElectionResults(input);
		await caller.admin.updateElection({
			id: election.id,
			name: "Renamed Election",
		});

		const after = await caller.results.getElectionResults(input);
		expect(after.electionName).toBe("Renamed Election");
	});
});

describe("results exports", () => {
	it("export the counted results as CSV, JSON and a summary report", async () => {
		const { election } = await electionWithVotes();
		const { caller } = await signedInAs("CRO");
		const input = { electionId: election.id };

		const csv = await caller.results.exportResultsCSV(input);
		const json = await caller.results.exportResultsJSON(input);
		const report = await caller.results.generateSummaryReport(input);

		expect(JSON.stringify(csv)).toContain("Ada");
		expect(JSON.parse(json.json)).toMatchObject({ totalVoted: 5 });
		expect(JSON.stringify(report)).toContain("ELECTION RESULTS: Test Election");
	});
});

describe("voting window", () => {
	it("ignores votes in an election that hasn't closed for finalizing", async () => {
		const election = await createElection({
			startTime: new Date(Date.now() - 2 * HOUR),
			endTime: new Date(Date.now() + HOUR),
		});
		const { caller } = await signedInAs("ADMIN");
		expect(
			await errorCode(
				caller.results.finalizeResults({ electionId: election.id }),
			),
		).toBe("BAD_REQUEST");
	});
});
