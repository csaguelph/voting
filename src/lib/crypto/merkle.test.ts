import { createHash } from "node:crypto";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import {
	batchGenerateMerkleProofs,
	batchVerifyMerkleProofs,
	buildMerkleTree,
	deserializeMerkleProof,
	generateElectionMerkleTree,
	generateMerkleProof,
	getMerkleRoot,
	getMerkleTreeStats,
	serializeMerkleProof,
	verifyMerkleProof,
} from "./merkle";

const voteHash = (i: number) =>
	createHash("sha256").update(`vote-${i}`).digest("hex");
const hashes = (n: number) => Array.from({ length: n }, (_, i) => voteHash(i));

// A tampered proof makes verifyMerkleProof log; keep test output clean
vi.spyOn(console, "error").mockImplementation(() => {});

describe("buildMerkleTree", () => {
	it("refuses to build a tree with no votes", () => {
		expect(() => buildMerkleTree([])).toThrow(/no vote hashes/);
		expect(() => generateElectionMerkleTree([])).toThrow(/no votes/);
	});

	it("produces the same root for the same votes in the same order", () => {
		const votes = hashes(7);
		expect(getMerkleRoot(buildMerkleTree(votes))).toBe(
			getMerkleRoot(buildMerkleTree([...votes])),
		);
	});

	it("depends on vote order, so callers must rebuild trees in a stable order", () => {
		// sortPairs only orders siblings; leaves are paired in input order
		const votes = hashes(7);
		expect(getMerkleRoot(buildMerkleTree([...votes].reverse()))).not.toBe(
			getMerkleRoot(buildMerkleTree(votes)),
		);
	});

	it("changes the root when any vote changes", () => {
		const votes = hashes(8);
		const altered = [...votes];
		altered[3] = voteHash(999);
		expect(getMerkleRoot(buildMerkleTree(altered))).not.toBe(
			getMerkleRoot(buildMerkleTree(votes)),
		);
	});

	it("changes the root when a vote is removed", () => {
		const votes = hashes(8);
		expect(getMerkleRoot(buildMerkleTree(votes.slice(1)))).not.toBe(
			getMerkleRoot(buildMerkleTree(votes)),
		);
	});
});

describe("generateMerkleProof / verifyMerkleProof", () => {
	it("generates a verifiable proof for every vote in the tree", () => {
		fc.assert(
			fc.property(fc.integer({ min: 2, max: 70 }), (n) => {
				const votes = hashes(n);
				const tree = buildMerkleTree(votes);
				const root = getMerkleRoot(tree);
				for (const hash of votes) {
					const proof = generateMerkleProof(tree, hash);
					expect(proof).not.toBeNull();
					expect(proof?.root).toBe(root);
					expect(proof?.leaf).toBe(hash);
					expect(proof && verifyMerkleProof(proof)).toBe(true);
				}
			}),
			{ numRuns: 25 },
		);
	});

	it("returns null for a vote that is not in the tree", () => {
		const tree = buildMerkleTree(hashes(5));
		expect(generateMerkleProof(tree, voteHash(999))).toBeNull();
	});

	it("proves the only vote in a single-vote tree with an empty path", () => {
		const tree = buildMerkleTree(hashes(1));
		const proof = generateMerkleProof(tree, voteHash(0));
		expect(proof).toMatchObject({ proof: [], root: getMerkleRoot(tree) });
		expect(proof && verifyMerkleProof(proof)).toBe(true);
		expect(generateMerkleProof(tree, voteHash(1))).toBeNull();
	});

	describe("rejects tampered proofs", () => {
		const votes = hashes(16);
		const tree = buildMerkleTree(votes);
		const target = votes[5] ?? "";
		const valid = generateMerkleProof(tree, target);
		if (!valid) throw new Error("expected a proof");

		it("with a different leaf", () => {
			expect(verifyMerkleProof({ ...valid, leaf: voteHash(999) })).toBe(false);
		});

		it("with a different vote from the same tree", () => {
			expect(verifyMerkleProof({ ...valid, leaf: votes[6] ?? "" })).toBe(false);
		});

		it("with a different root", () => {
			const otherRoot = getMerkleRoot(buildMerkleTree(hashes(17)));
			expect(verifyMerkleProof({ ...valid, root: otherRoot })).toBe(false);
		});

		it("with a modified sibling hash", () => {
			const proof = [...valid.proof];
			proof[0] = voteHash(1000);
			expect(verifyMerkleProof({ ...valid, proof })).toBe(false);
		});

		it("with a missing step", () => {
			expect(verifyMerkleProof({ ...valid, proof: valid.proof.slice(1) })).toBe(
				false,
			);
		});

		it("with malformed data, without throwing", () => {
			expect(
				verifyMerkleProof({ ...valid, root: "zz", proof: ["not-hex"] }),
			).toBe(false);
		});
	});

	it("round-trips through serialization", () => {
		const votes = hashes(9);
		const proof = generateMerkleProof(buildMerkleTree(votes), votes[2] ?? "");
		if (!proof) throw new Error("expected a proof");
		const restored = deserializeMerkleProof(serializeMerkleProof(proof));
		expect(restored).toEqual(proof);
		expect(verifyMerkleProof(restored)).toBe(true);
	});
});

describe("batch helpers", () => {
	it("generates and verifies proofs in bulk, counting failures", () => {
		const votes = hashes(10);
		const tree = buildMerkleTree(votes);
		const proofs = batchGenerateMerkleProofs(tree, votes).filter(
			(p): p is NonNullable<typeof p> => p !== null,
		);
		expect(proofs).toHaveLength(10);

		const first = proofs[0];
		if (!first) throw new Error("expected a proof");
		const tampered = { ...first, leaf: voteHash(999) };
		const result = batchVerifyMerkleProofs([...proofs, tampered]);
		expect(result).toMatchObject({ total: 11, verified: 10, failed: 1 });
		expect(result.results.at(-1)?.valid).toBe(false);
	});
});

describe("tree metadata", () => {
	it.each([
		[2, 1],
		[8, 3],
		[9, 4],
		[1000, 10],
	])("reports depth for %i votes as %i", (n, depth) => {
		const election = generateElectionMerkleTree(hashes(n));
		expect(election.totalVotes).toBe(n);
		expect(election.treeDepth).toBe(depth);
		expect(election.root).toMatch(/^[0-9a-f]{64}$/);
	});

	it("reports layer statistics consistent with the tree", () => {
		const tree = buildMerkleTree(hashes(8));
		expect(getMerkleTreeStats(tree)).toEqual({
			root: getMerkleRoot(tree),
			depth: 3,
			leafCount: 8,
			layers: 4,
		});
	});
});
