import type { UserRole } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { appRouter } from "@/server/api/root";
import { db } from "@/server/db";
import { anonymous, callerFor, createUser } from "@/test/integration/caller";
import {
	createBallot,
	createElection,
	enrollVoter,
} from "@/test/integration/fixtures";

/**
 * Who may call each procedure:
 * - public: anyone, signed in or not
 * - signedIn: any signed-in user
 * - admin: ADMIN or CRO
 *
 * Every procedure in the app router must be listed. Adding a procedure
 * without deciding its access level fails the coverage test below.
 */
type Access = "public" | "signedIn" | "admin";

interface Seed {
	electionId: string;
	ballotId: string;
	candidateId: string;
	voteHash: string;
}

const procedures: Record<string, [Access, (s: Seed) => unknown]> = {
	"election.getAll": ["public", () => undefined],
	"election.getActive": ["public", () => undefined],
	"election.getById": ["public", (s) => ({ id: s.electionId })],
	"election.getMyElections": ["signedIn", () => undefined],

	"voter.checkEligibility": ["signedIn", (s) => ({ electionId: s.electionId })],
	"voter.getMyDetails": ["signedIn", (s) => ({ electionId: s.electionId })],

	"admin.createElection": [
		"admin",
		() => ({ name: "New", startTime: new Date(), endTime: new Date() }),
	],
	"admin.updateElection": [
		"admin",
		(s) => ({ id: s.electionId, name: "Renamed" }),
	],
	"admin.deleteElection": ["admin", (s) => ({ id: s.electionId })],
	"admin.getAllElections": ["admin", () => undefined],
	"admin.importVoters": [
		"admin",
		(s) => ({
			electionId: s.electionId,
			voters: [
				{
					studentId: "7777777",
					firstName: "New",
					lastName: "Voter",
					email: "new-voter@uoguelph.ca",
					college: "COE",
				},
			],
		}),
	],
	"admin.getVoters": ["admin", (s) => ({ electionId: s.electionId })],
	"admin.getVoterStats": ["admin", (s) => ({ electionId: s.electionId })],
	"admin.deleteAllVoters": ["admin", (s) => ({ electionId: s.electionId })],
	"admin.getMonitoringData": ["admin", (s) => ({ electionId: s.electionId })],
	"admin.updateElectionEndTime": [
		"admin",
		(s) => ({ electionId: s.electionId, endTime: new Date(Date.now() + 1e7) }),
	],

	"ballot.getByElection": ["signedIn", (s) => ({ electionId: s.electionId })],
	"ballot.getById": ["signedIn", (s) => ({ id: s.ballotId })],
	"ballot.create": [
		"admin",
		(s) => ({ electionId: s.electionId, title: "New", type: "EXECUTIVE" }),
	],
	"ballot.update": ["admin", (s) => ({ id: s.ballotId, title: "Renamed" })],
	"ballot.delete": ["admin", (s) => ({ id: s.ballotId })],
	"ballot.addCandidate": [
		"admin",
		(s) => ({ ballotId: s.ballotId, name: "New" }),
	],
	"ballot.updateCandidate": [
		"admin",
		(s) => ({ id: s.candidateId, name: "Renamed" }),
	],
	"ballot.setCandidateStatus": [
		"admin",
		(s) => ({ id: s.candidateId, status: "WITHDRAWN" }),
	],
	"ballot.deleteCandidate": ["admin", (s) => ({ id: s.candidateId })],
	"ballot.reorder": [
		"admin",
		(s) => ({
			electionId: s.electionId,
			ballotOrders: [{ id: s.ballotId, order: 1 }],
		}),
	],

	"vote.checkEligibility": ["signedIn", (s) => ({ electionId: s.electionId })],
	"vote.getBallots": ["signedIn", (s) => ({ electionId: s.electionId })],
	"vote.castVotes": [
		"signedIn",
		(s) => ({
			electionId: s.electionId,
			votes: [{ ballotId: s.ballotId, voteData: { type: "ABSTAIN" } }],
		}),
	],
	"vote.getReceipt": ["signedIn", (s) => ({ electionId: s.electionId })],
	"vote.getVotingStatus": ["signedIn", () => undefined],

	"verify.verifyHash": ["public", (s) => ({ voteHash: s.voteHash })],
	"verify.verifyBatch": ["public", (s) => ({ voteHashes: [s.voteHash] })],
	"verify.verifyVoteIntegrity": [
		"public",
		(s) => ({ voteHash: s.voteHash, voterId: "1234567" }),
	],
	"verify.getElectionStats": ["public", (s) => ({ electionId: s.electionId })],

	"settings.getGlobal": ["admin", () => undefined],
	"settings.updateQuorum": [
		"admin",
		() => ({ executiveQuorum: 10, directorQuorum: 10, referendumQuorum: 20 }),
	],

	"results.getElectionResults": [
		"public",
		(s) => ({ electionId: s.electionId }),
	],
	"results.getResultsStatus": ["public", (s) => ({ electionId: s.electionId })],
	"results.finalizeResults": ["admin", (s) => ({ electionId: s.electionId })],
	"results.publishResults": ["admin", (s) => ({ electionId: s.electionId })],
	"results.unpublishResults": ["admin", (s) => ({ electionId: s.electionId })],
	"results.exportResultsCSV": ["admin", (s) => ({ electionId: s.electionId })],
	"results.exportResultsJSON": ["admin", (s) => ({ electionId: s.electionId })],
	"results.generateSummaryReport": [
		"admin",
		(s) => ({ electionId: s.electionId }),
	],

	"audit.getAuditLogs": ["admin", () => ({})],
	"audit.getAuditLogsByElection": [
		"admin",
		(s) => ({ electionId: s.electionId }),
	],
	"audit.getActionTypes": ["admin", () => undefined],
	"audit.exportAuditLogs": ["admin", () => ({})],

	"proof.generateMerkleTree": ["admin", (s) => ({ electionId: s.electionId })],
	"proof.getRecentElections": ["public", () => undefined],
	"proof.getMerkleTreeInfo": ["public", (s) => ({ electionId: s.electionId })],
	"proof.generateProof": [
		"public",
		(s) => ({ electionId: s.electionId, voteHash: s.voteHash }),
	],
	"proof.batchGenerateProofs": [
		"public",
		(s) => ({ electionId: s.electionId, voteHashes: [s.voteHash] }),
	],
	"proof.verifyProof": [
		"public",
		(s) => ({
			proof: {
				leaf: s.voteHash,
				proof: [],
				root: s.voteHash,
				position: "left",
				positions: [],
			},
		}),
	],
	"proof.getTreeStats": ["public", (s) => ({ electionId: s.electionId })],
};

const callers: Array<{ label: string; role: UserRole | null }> = [
	{ label: "anonymous", role: null },
	{ label: "STUDENT", role: "STUDENT" },
	{ label: "CRO", role: "CRO" },
	{ label: "ADMIN", role: "ADMIN" },
];

function isAllowed(access: Access, role: UserRole | null) {
	if (access === "public") return true;
	if (access === "signedIn") return role !== null;
	return role === "ADMIN" || role === "CRO";
}

/**
 * An election where business rules don't get in the way: it's open, its
 * results are published, and every test user is on the voter roll. Any
 * UNAUTHORIZED or FORBIDDEN is then an access-control decision.
 */
async function seed(emails: string[]): Promise<Seed> {
	const election = await createElection({
		isFinalized: true,
		isPublished: true,
	});
	const ballot = await createBallot(election.id, {
		candidates: ["Ada", "Bob"],
	});
	for (const email of emails) {
		await enrollVoter(election.id, { email });
	}
	const vote = await db.vote.create({
		data: {
			electionId: election.id,
			ballotId: ballot.id,
			voteData: { type: "ABSTAIN" },
			voteHash: "a".repeat(64),
		},
	});
	return {
		electionId: election.id,
		ballotId: ballot.id,
		candidateId: ballot.candidates[0]?.id ?? "",
		voteHash: vote.voteHash,
	};
}

async function call(
	caller: ReturnType<typeof callerFor>,
	path: string,
	input: unknown,
): Promise<string | null> {
	const [router = "", procedure = ""] = path.split(".");
	// biome-ignore lint/suspicious/noExplicitAny: dynamic dispatch by procedure path
	const fn = (caller as any)[router][procedure] as (
		i: unknown,
	) => Promise<unknown>;
	try {
		await fn(input);
		return null;
	} catch (error) {
		if (error instanceof TRPCError) return error.code;
		throw error;
	}
}

describe("authorization", () => {
	it("declares an access level for every procedure", () => {
		expect(Object.keys(procedures).sort()).toEqual(
			Object.keys(appRouter._def.procedures).sort(),
		);
	});

	const cases = Object.entries(procedures).map(([path, [access, input]]) => ({
		path,
		access,
		input,
	}));

	it.each(cases)("$path is $access", async ({ path, access, input }) => {
		const users = await Promise.all(
			callers.map((c) => (c.role ? createUser(c.role) : null)),
		);
		const s = await seed(users.flatMap((u) => (u?.email ? [u.email] : [])));

		for (const [i, { label, role }] of callers.entries()) {
			const user = users[i] ?? null;
			const code = await call(
				user ? callerFor(user) : anonymous(),
				path,
				input(s),
			);
			const denied = code === "UNAUTHORIZED" || code === "FORBIDDEN";

			expect(
				{ caller: label, denied },
				`${path} as ${label} returned ${code ?? "success"}`,
			).toEqual({ caller: label, denied: !isAllowed(access, role) });
		}
	});
});
