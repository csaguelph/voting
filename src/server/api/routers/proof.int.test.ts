import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyMerkleProof } from "@/lib/crypto/merkle";
import { db } from "@/server/db";
import { anonymous, signedInAs } from "@/test/integration/caller";
import {
	createBallot,
	createElection,
	enrollVoter,
} from "@/test/integration/fixtures";

const HOUR = 60 * 60 * 1000;
const SAME_INSTANT = new Date("2026-03-01T15:00:00.000Z");

const closeVoting = (electionId: string) =>
	db.election.update({
		where: { id: electionId },
		data: { endTime: new Date(Date.now() - 1000) },
	});

/** An ended election whose votes were inserted with the given hashes */
async function electionWithVotes(
	hashes: string[],
	timestamp: (i: number) => Date = () => SAME_INSTANT,
) {
	const election = await createElection({
		startTime: new Date(Date.now() - 2 * HOUR),
		endTime: new Date(Date.now() - HOUR),
	});
	const ballot = await createBallot(election.id, { type: "REFERENDUM" });
	// Inserted one at a time so ids increase in this order
	for (const [i, voteHash] of hashes.entries()) {
		await db.vote.create({
			data: {
				electionId: election.id,
				ballotId: ballot.id,
				voteData: { type: "YES" },
				voteHash,
				timestamp: timestamp(i),
			},
		});
	}
	return election;
}

const hash = (char: string) => char.repeat(64);

async function storedRoot(electionId: string) {
	const election = await db.election.findUniqueOrThrow({
		where: { id: electionId },
	});
	return election.merkleRoot;
}

/** Every vote's proof must verify against the published root */
async function expectAllProofsMatchPublishedRoot(electionId: string) {
	const root = await storedRoot(electionId);
	const votes = await db.vote.findMany({ where: { electionId } });
	for (const vote of votes) {
		const { proof } = await anonymous().proof.generateProof({
			electionId,
			voteHash: vote.voteHash,
		});
		expect(proof.root).toBe(root);
		expect(verifyMerkleProof(proof)).toBe(true);
	}
	const batch = await anonymous().proof.batchGenerateProofs({
		electionId,
		voteHashes: votes.map((v) => v.voteHash),
	});
	expect(batch.found).toBe(votes.length);
	expect(batch.results.every((r) => r.proof?.root === root)).toBe(true);
}

beforeEach(() => {
	vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("proof.generateMerkleTree", () => {
	it("won't publish a root while voting is still open", async () => {
		const election = await createElection();
		const ballot = await createBallot(election.id, { type: "REFERENDUM" });
		await db.vote.create({
			data: {
				electionId: election.id,
				ballotId: ballot.id,
				voteData: { type: "YES" },
				voteHash: hash("a"),
			},
		});
		const { caller } = await signedInAs("CRO");

		const error = await caller.proof
			.generateMerkleTree({ electionId: election.id })
			.catch((e: unknown) => e);
		expect((error as TRPCError).code).toBe("BAD_REQUEST");
		expect(await storedRoot(election.id)).toBeNull();
	});

	it("publishes a root over every vote, once", async () => {
		const election = await electionWithVotes([hash("a"), hash("b"), hash("c")]);
		const { caller, user } = await signedInAs("CRO");

		const result = await caller.proof.generateMerkleTree({
			electionId: election.id,
		});
		expect(result).toMatchObject({ success: true, voteCount: 3 });
		expect(await storedRoot(election.id)).toBe(result.merkleRoot);
		expect(
			await db.auditLog.findFirst({
				where: { action: "merkle_tree.generated" },
			}),
		).toMatchObject({ details: { generatedBy: user.email, voteCount: 3 } });

		const again = await caller.proof
			.generateMerkleTree({ electionId: election.id })
			.catch((e: unknown) => e);
		expect((again as TRPCError).code).toBe("BAD_REQUEST");
	});
});

describe("Merkle proofs", () => {
	it("verify against the published root for votes cast through the app", async () => {
		// Each submission's votes share a timestamp, across several ballots
		const election = await createElection();
		const ballots = await Promise.all(
			[1, 2, 3].map(() => createBallot(election.id, { type: "REFERENDUM" })),
		);
		for (let i = 0; i < 4; i++) {
			const email = `voter${i}@uoguelph.ca`;
			await enrollVoter(election.id, { email });
			const { caller } = await signedInAs("STUDENT", email);
			await caller.vote.castVotes({
				electionId: election.id,
				votes: ballots.map((b) => ({
					ballotId: b.id,
					voteData: { type: i % 2 ? "YES" : "NO" },
				})),
			});
		}
		await closeVoting(election.id);
		const { caller } = await signedInAs("CRO");
		await caller.proof.generateMerkleTree({ electionId: election.id });

		await expectAllProofsMatchPublishedRoot(election.id);
	});

	it("still match the published root after the votes table is rewritten", async () => {
		// Votes sharing a timestamp, inserted out of hash order. CLUSTER
		// rewrites the table in hash order, as a VACUUM FULL or a
		// dump-and-restore to a new host can, changing how ties come back.
		// (The tree sorts each sibling pair, so the new order has to change
		// which votes are paired, not just reverse them.)
		const election = await electionWithVotes([
			hash("b"),
			hash("d"),
			hash("a"),
			hash("c"),
		]);
		const { caller } = await signedInAs("CRO");
		await caller.proof.generateMerkleTree({ electionId: election.id });

		await db.$executeRawUnsafe('CLUSTER "votes" USING "votes_voteHash_key"');
		const tiesAfterRewrite = await db.$queryRaw<{ voteHash: string }[]>`
			SELECT "voteHash" FROM votes WHERE "electionId" = ${election.id}
			ORDER BY timestamp`;
		// Precondition: ordering by timestamp alone now returns ties reversed
		expect(tiesAfterRewrite.map((v) => v.voteHash[0])).toEqual([
			"a",
			"b",
			"c",
			"d",
		]);

		await expectAllProofsMatchPublishedRoot(election.id);
	});

	it("can prove the only vote in a single-vote election", async () => {
		const election = await electionWithVotes([hash("a")]);
		const { caller } = await signedInAs("CRO");
		await caller.proof.generateMerkleTree({ electionId: election.id });

		await expectAllProofsMatchPublishedRoot(election.id);
	});

	it("ignore votes cast after the tree was generated", async () => {
		// e.g. an admin extends the deadline after the root was published
		const election = await electionWithVotes(
			[hash("a"), hash("b")],
			(i) => new Date(SAME_INSTANT.getTime() + i),
		);
		const { caller } = await signedInAs("CRO");
		await caller.proof.generateMerkleTree({ electionId: election.id });

		const ballot = await db.ballot.findFirstOrThrow({
			where: { electionId: election.id },
		});
		await db.vote.create({
			data: {
				electionId: election.id,
				ballotId: ballot.id,
				voteData: { type: "NO" },
				voteHash: hash("0"),
				timestamp: new Date(),
			},
		});

		for (const voteHash of [hash("a"), hash("b")]) {
			const { proof } = await anonymous().proof.generateProof({
				electionId: election.id,
				voteHash,
			});
			expect(proof.root).toBe(await storedRoot(election.id));
		}
		const late = await anonymous()
			.proof.generateProof({ electionId: election.id, voteHash: hash("0") })
			.catch((e: unknown) => e);
		expect((late as TRPCError).code).toBe("NOT_FOUND");
	});

	it("are refused when the votes no longer match the published root", async () => {
		const election = await electionWithVotes([hash("a"), hash("b"), hash("c")]);
		const { caller } = await signedInAs("CRO");
		await caller.proof.generateMerkleTree({ electionId: election.id });

		// Tamper with a stored vote after the root was published
		await db.vote.updateMany({
			where: { voteHash: hash("c") },
			data: { voteHash: hash("e") },
		});

		const error = await anonymous()
			.proof.generateProof({ electionId: election.id, voteHash: hash("a") })
			.catch((e: unknown) => e);
		expect(error).toBeInstanceOf(TRPCError);
		expect((error as TRPCError).message).toMatch(/published Merkle root/);

		const stats = await anonymous().proof.getTreeStats({
			electionId: election.id,
		});
		expect(stats.rootMatches).toBe(false);
	});
});
