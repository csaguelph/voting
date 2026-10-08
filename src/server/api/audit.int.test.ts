import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { callerFor, createUser } from "@/test/integration/caller";
import { createBallot, createElection } from "@/test/integration/fixtures";

const HOUR = 60 * 60 * 1000;

type Caller = ReturnType<typeof callerFor>;

interface Case {
	action: string;
	/** Sets up an election and runs the mutation, returning the election id */
	run: (caller: Caller) => Promise<string>;
}

const upcoming = () =>
	createElection({
		startTime: new Date(Date.now() + HOUR),
		endTime: new Date(Date.now() + 2 * HOUR),
	});

/**
 * Every mutation that changes an election, its ballots or its voter roll must
 * leave an audit entry saying what happened and who did it.
 *
 * Not covered: settings.updateQuorum (global, but audit entries must belong
 * to an election) and admin.deleteElection (its audit entries are deleted
 * with it). Votes and results are covered in their own test files.
 */
const cases: Record<string, Case> = {
	"admin.createElection": {
		action: "ELECTION_CREATE",
		run: async (c) =>
			(
				await c.admin.createElection({
					name: "New",
					startTime: new Date(Date.now() + HOUR),
					endTime: new Date(Date.now() + 2 * HOUR),
				})
			).id,
	},
	"admin.updateElection": {
		action: "ELECTION_UPDATE",
		run: async (c) => {
			const e = await upcoming();
			await c.admin.updateElection({ id: e.id, name: "Renamed" });
			return e.id;
		},
	},
	"admin.importVoters": {
		action: "VOTER_IMPORT",
		run: async (c) => {
			const e = await upcoming();
			await c.admin.importVoters({
				electionId: e.id,
				voters: [
					{
						studentId: "1234567",
						firstName: "Ada",
						lastName: "Lovelace",
						email: "ada@uoguelph.ca",
						college: "COE",
					},
				],
			});
			return e.id;
		},
	},
	"admin.deleteAllVoters": {
		action: "VOTER_DELETE_ALL",
		run: async (c) => {
			const e = await upcoming();
			await c.admin.deleteAllVoters({ electionId: e.id });
			return e.id;
		},
	},
	"admin.updateElectionEndTime": {
		action: "ELECTION_DEADLINE_EXTENDED",
		run: async (c) => {
			const e = await createElection();
			await c.admin.updateElectionEndTime({
				electionId: e.id,
				endTime: new Date(Date.now() + 3 * HOUR),
			});
			return e.id;
		},
	},
	"ballot.create": {
		action: "ballot.created",
		run: async (c) => {
			const e = await upcoming();
			await c.ballot.create({
				electionId: e.id,
				title: "President",
				type: "EXECUTIVE",
			});
			return e.id;
		},
	},
	"ballot.update": {
		action: "ballot.updated",
		run: async (c) => {
			const e = await upcoming();
			const b = await createBallot(e.id);
			await c.ballot.update({ id: b.id, title: "Renamed" });
			return e.id;
		},
	},
	"ballot.delete": {
		action: "ballot.deleted",
		run: async (c) => {
			const e = await upcoming();
			const b = await createBallot(e.id);
			await c.ballot.delete({ id: b.id });
			return e.id;
		},
	},
	"ballot.addCandidate": {
		action: "candidate.added",
		run: async (c) => {
			const e = await upcoming();
			const b = await createBallot(e.id);
			await c.ballot.addCandidate({ ballotId: b.id, name: "Ada" });
			return e.id;
		},
	},
	"ballot.updateCandidate": {
		action: "candidate.updated",
		run: async (c) => {
			const e = await upcoming();
			const b = await createBallot(e.id, { candidates: ["Ada", "Bob"] });
			await c.ballot.updateCandidate({
				id: b.candidates[0]?.id ?? "",
				name: "Ada L.",
			});
			return e.id;
		},
	},
	"ballot.setCandidateStatus": {
		action: "candidate.status_updated",
		run: async (c) => {
			const e = await createElection();
			const b = await createBallot(e.id, { candidates: ["Ada", "Bob"] });
			await c.ballot.setCandidateStatus({
				id: b.candidates[0]?.id ?? "",
				status: "WITHDRAWN",
				statusReason: "Personal reasons",
			});
			return e.id;
		},
	},
	"ballot.deleteCandidate": {
		action: "candidate.deleted",
		run: async (c) => {
			const e = await upcoming();
			const b = await createBallot(e.id, { candidates: ["Ada", "Bob"] });
			await c.ballot.deleteCandidate({ id: b.candidates[0]?.id ?? "" });
			return e.id;
		},
	},
	"ballot.reorder": {
		action: "ballots.reordered",
		run: async (c) => {
			const e = await upcoming();
			const b = await createBallot(e.id);
			await c.ballot.reorder({
				electionId: e.id,
				ballotOrders: [{ id: b.id, order: 3 }],
			});
			return e.id;
		},
	},
	"proof.generateMerkleTree": {
		action: "merkle_tree.generated",
		run: async (c) => {
			const e = await createElection({
				startTime: new Date(Date.now() - 2 * HOUR),
				endTime: new Date(Date.now() - HOUR),
			});
			const b = await createBallot(e.id, { type: "REFERENDUM" });
			await db.vote.create({
				data: {
					electionId: e.id,
					ballotId: b.id,
					voteData: { type: "YES" },
					voteHash: "a".repeat(64),
				},
			});
			await c.proof.generateMerkleTree({ electionId: e.id });
			return e.id;
		},
	},
};

describe("audit log", () => {
	it.each(Object.entries(cases))(
		"%s records what happened and who did it",
		async (_path, { action, run }) => {
			const user = await createUser("CRO");
			const electionId = await run(callerFor(user));

			const entries = await db.auditLog.findMany({
				where: { electionId, action },
			});
			expect(entries).toHaveLength(1);
			const details = JSON.stringify(entries[0]?.details);
			expect(
				details.includes(user.id) || details.includes(user.email ?? "-"),
				`audit entry should identify the actor: ${details}`,
			).toBe(true);
		},
	);

	it("records which election fields changed, with old and new values", async () => {
		const user = await createUser("ADMIN");
		const e = await upcoming();
		const newEnd = new Date(Date.now() + 5 * HOUR);
		await callerFor(user).admin.updateElection({
			id: e.id,
			name: "Renamed",
			endTime: newEnd,
			description: undefined,
		});

		const entry = await db.auditLog.findFirstOrThrow({
			where: { electionId: e.id, action: "ELECTION_UPDATE" },
		});
		expect(entry.details).toMatchObject({
			performedByEmail: user.email,
			changes: {
				name: { from: "Test Election", to: "Renamed" },
				endTime: { from: e.endTime.toISOString(), to: newEnd.toISOString() },
			},
		});
		expect(Object.keys((entry.details as { changes: object }).changes)).toEqual(
			["name", "endTime"],
		);
	});
});
