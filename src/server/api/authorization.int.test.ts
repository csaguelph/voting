import { createHash } from "node:crypto";
import type { UserRole } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { generateElectionMerkleTree } from "@/lib/crypto/merkle";
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
 * - cro: CRO only
 *
 * Every procedure in the app router must be listed. Adding a procedure
 * without deciding its access level fails the coverage test below.
 */
type Access = "public" | "signedIn" | "admin" | "cro";

interface Seed {
	electionId: string;
	ballotId: string;
	candidateId: string;
	voteHash: string;
	reportId: string;
}

/** The election state a procedure needs in order to succeed */
interface SeedOptions {
	phase?: "upcoming" | "open" | "ended";
	finalized?: boolean;
	published?: boolean;
	/** Every enrolled voter has already voted */
	voted?: boolean;
	merkleTree?: boolean;
	/** The target ballot is tied 1-1, waiting to be decided by lot */
	tie?: boolean;
}

type Entry =
	| [Access, (s: Seed) => unknown]
	| [Access, (s: Seed) => unknown, SeedOptions];

const HOUR = 60 * 60 * 1000;
const ENDED: SeedOptions = { phase: "ended" };
const PUBLISHED: SeedOptions = {
	phase: "ended",
	finalized: true,
	published: true,
};

const procedures: Record<string, Entry> = {
	"election.getAll": ["public", () => undefined],
	"election.getActive": ["public", () => undefined],
	"election.getById": ["public", (s) => ({ id: s.electionId })],
	"election.getMyElections": ["signedIn", () => undefined],

	"voter.checkEligibility": ["signedIn", (s) => ({ electionId: s.electionId })],
	"voter.getMyDetails": ["signedIn", (s) => ({ electionId: s.electionId })],

	"admin.createElection": [
		"admin",
		() => ({
			name: "New",
			startTime: new Date(Date.now() + 60_000),
			endTime: new Date(Date.now() + 120_000),
		}),
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
	"admin.deleteAllVoters": [
		"admin",
		(s) => ({ electionId: s.electionId }),
		{ phase: "upcoming" },
	],
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
	"ballot.deleteCandidate": [
		"admin",
		(s) => ({ id: s.candidateId }),
		{ phase: "upcoming" },
	],
	"ballot.reorder": [
		"admin",
		(s) => ({
			electionId: s.electionId,
			ballotOrders: [{ id: s.ballotId, order: 1 }],
		}),
	],

	"vote.checkEligibility": ["signedIn", (s) => ({ electionId: s.electionId })],
	"vote.getBallots": ["signedIn", (s) => ({ electionId: s.electionId })],
	"vote.confirmIdentity": [
		"signedIn",
		(s) => ({ electionId: s.electionId, studentId: "0000000" }),
	],
	"vote.castVotes": [
		"signedIn",
		(s) => ({
			electionId: s.electionId,
			votes: [{ ballotId: s.ballotId, voteData: { type: "ABSTAIN" } }],
		}),
	],
	"vote.getReceipt": [
		"signedIn",
		(s) => ({ electionId: s.electionId }),
		{ voted: true },
	],
	"vote.getVotingStatus": ["signedIn", () => undefined],

	"report.file": [
		"signedIn",
		(s) => ({
			electionId: s.electionId,
			source: "DASHBOARD",
			report: { reason: "PRESSURED", details: "" },
		}),
	],
	"report.list": ["cro", () => ({})],
	"report.setStatus": ["cro", (s) => ({ id: s.reportId, status: "RESOLVED" })],

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
		PUBLISHED,
	],
	"results.getResultsStatus": ["public", (s) => ({ electionId: s.electionId })],
	"results.finalizeResults": [
		"admin",
		(s) => ({ electionId: s.electionId }),
		ENDED,
	],
	"results.publishResults": [
		"admin",
		(s) => ({ electionId: s.electionId }),
		{ phase: "ended", finalized: true },
	],
	"results.recordTieBreakDraw": [
		"cro",
		(s) => ({
			electionId: s.electionId,
			ballotId: s.ballotId,
			selectedCandidateIds: [s.candidateId],
		}),
		{ phase: "ended", tie: true },
	],
	"results.unpublishResults": [
		"admin",
		(s) => ({ electionId: s.electionId }),
		PUBLISHED,
	],
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

	"proof.generateMerkleTree": [
		"admin",
		(s) => ({ electionId: s.electionId }),
		ENDED,
	],
	"proof.getRecentElections": ["public", () => undefined],
	"proof.getMerkleTreeInfo": ["public", (s) => ({ electionId: s.electionId })],
	"proof.generateProof": [
		"public",
		(s) => ({ electionId: s.electionId, voteHash: s.voteHash }),
		{ merkleTree: true },
	],
	"proof.batchGenerateProofs": [
		"public",
		(s) => ({ electionId: s.electionId, voteHashes: [s.voteHash] }),
		{ merkleTree: true },
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
	"proof.getTreeStats": [
		"public",
		(s) => ({ electionId: s.electionId }),
		{ merkleTree: true },
	],
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
	if (access === "cro") return role === "CRO";
	return role === "ADMIN" || role === "CRO";
}

/**
 * A fresh election in the state a procedure needs, with every given email
 * on the voter roll. Each caller gets its own, so one role's mutation can't
 * change what the next role's check measures. Business rules are satisfied,
 * so any UNAUTHORIZED or FORBIDDEN is an access-control decision.
 */
async function seed(
	emails: string[],
	options: SeedOptions = {},
): Promise<Seed> {
	const { phase = "open", finalized = false, published = false } = options;
	const now = Date.now();
	const window = {
		upcoming: {
			startTime: new Date(now + HOUR),
			endTime: new Date(now + 2 * HOUR),
		},
		open: { startTime: new Date(now - HOUR), endTime: new Date(now + HOUR) },
		ended: {
			startTime: new Date(now - 2 * HOUR),
			endTime: new Date(now - HOUR),
		},
	}[phase];
	const election = await createElection({
		...window,
		isFinalized: finalized,
		isPublished: published,
	});

	// The ballot procedures act on; votes go on a separate ballot so it can be
	// edited and deleted freely
	const ballot = await createBallot(election.id, {
		candidates: ["Ada", "Bob"],
	});
	const voted = await createBallot(election.id, { type: "REFERENDUM" });
	// Two votes with distinct timestamps, so the Merkle tree has a real proof
	// path and a stable leaf order
	const votes = await Promise.all(
		[0, 1].map((i) =>
			db.vote.create({
				data: {
					electionId: election.id,
					ballotId: voted.id,
					voteData: { type: "YES" },
					voteHash: createHash("sha256")
						.update(`${election.id}-${i}`)
						.digest("hex"),
					timestamp: new Date(now - HOUR + i * 1000),
				},
			}),
		),
	);
	const voteHashes = votes.map((v) => v.voteHash);

	for (const email of emails) {
		const voter = await enrollVoter(election.id, { email });
		if (options.voted) {
			await db.eligibleVoter.update({
				where: { id: voter.id },
				data: { hasVoted: true, votedAt: new Date() },
			});
		}
	}

	if (options.tie) {
		for (const candidate of ballot.candidates) {
			await db.vote.create({
				data: {
					electionId: election.id,
					ballotId: ballot.id,
					voteData: { type: "RANKED", rankings: [candidate.id] },
					voteHash: createHash("sha256").update(candidate.id).digest("hex"),
				},
			});
		}
	}

	const report = await db.voterReport.create({
		data: {
			electionId: election.id,
			voterName: "Test Voter",
			voterEmail: "reporter@uoguelph.ca",
			reason: "PRESSURED",
			details: "",
			source: "DASHBOARD",
		},
	});

	if (options.merkleTree) {
		const { root, totalVotes } = generateElectionMerkleTree(voteHashes);
		await db.election.update({
			where: { id: election.id },
			data: {
				merkleRoot: root,
				merkleTreeVoteCount: totalVotes,
				merkleTreeGeneratedAt: new Date(),
			},
		});
	}

	return {
		electionId: election.id,
		ballotId: ballot.id,
		candidateId: ballot.candidates[0]?.id ?? "",
		voteHash: voteHashes[0] ?? "",
		reportId: report.id,
	};
}

async function call(
	caller: ReturnType<typeof callerFor>,
	path: string,
	input: unknown,
): Promise<{ code: string; message: string } | null> {
	const [router = "", procedure = ""] = path.split(".");
	// biome-ignore lint/suspicious/noExplicitAny: dynamic dispatch by procedure path
	const fn = (caller as any)[router][procedure] as (
		i: unknown,
	) => Promise<unknown>;
	try {
		await fn(input);
		return null;
	} catch (error) {
		if (error instanceof TRPCError) {
			return { code: error.code, message: error.message };
		}
		throw error;
	}
}

describe("authorization", () => {
	it("declares an access level for every procedure", () => {
		expect(Object.keys(procedures).sort()).toEqual(
			Object.keys(appRouter._def.procedures).sort(),
		);
	});

	const cases = Object.entries(procedures).map(
		([path, [access, input, options]]) => ({ path, access, input, options }),
	);

	it.each(cases)(
		"$path is $access",
		async ({ path, access, input, options }) => {
			const users = await Promise.all(
				callers.map((c) => (c.role ? createUser(c.role) : null)),
			);
			const emails = users.flatMap((u) => (u?.email ? [u.email] : []));

			for (const [i, { label, role }] of callers.entries()) {
				const user = users[i] ?? null;
				const s = await seed(emails, options);
				const error = await call(
					user ? callerFor(user) : anonymous(),
					path,
					input(s),
				);
				const outcome = error ? `${error.code}: ${error.message}` : "success";

				if (isAllowed(access, role)) {
					expect(outcome, `${path} as ${label}`).toBe("success");
				} else {
					expect(error?.code, `${path} as ${label} returned ${outcome}`).toBe(
						role ? "FORBIDDEN" : "UNAUTHORIZED",
					);
				}
			}
		},
	);
});
