import { createHash } from "node:crypto";
import { MerkleTree } from "merkletreejs";

/**
 * Merkle Tree Utilities
 *
 * Provides cryptographic proof of vote inclusion in an election.
 * Uses SHA-256 for hashing and creates a Merkle tree from all vote hashes.
 * Voters can verify their vote was included without revealing the vote itself.
 */

/**
 * Hash function for Merkle tree (SHA-256)
 */
function sha256(data: string | Buffer): Buffer {
	return createHash("sha256").update(data).digest();
}

/**
 * Interface for Merkle proof data
 */
export interface MerkleProofData {
	leaf: string; // The vote hash being proven
	proof: string[]; // Array of sibling hashes in the proof path
	root: string; // The Merkle root
	position: "left" | "right"; // Position of leaf in each layer
	positions: number[]; // Binary positions for each proof element
}

/**
 * Build a Merkle tree from an array of vote hashes
 *
 * @param voteHashes - Array of vote hashes (hex strings)
 * @returns MerkleTree instance
 */
export function buildMerkleTree(voteHashes: string[]): MerkleTree {
	if (voteHashes.length === 0) {
		throw new Error("Cannot build Merkle tree with no vote hashes");
	}

	// Convert hex strings to buffers for the tree
	const leaves = voteHashes.map((hash) => sha256(hash));

	// Create the Merkle tree with SHA-256
	const tree = new MerkleTree(leaves, sha256, {
		sortPairs: true, // Sort pairs to ensure deterministic tree
	});

	return tree;
}

/**
 * Get the Merkle root from a tree
 *
 * @param tree - MerkleTree instance
 * @returns Merkle root as hex string
 */
export function getMerkleRoot(tree: MerkleTree): string {
	return tree.getRoot().toString("hex");
}

/**
 * Generate a Merkle proof for a specific vote hash
 *
 * @param tree - MerkleTree instance
 * @param voteHash - The vote hash to generate proof for
 * @returns Merkle proof data or null if hash not in tree
 */
export function generateMerkleProof(
	tree: MerkleTree,
	voteHash: string,
): MerkleProofData | null {
	const leaf = sha256(voteHash);
	const proof = tree.getProof(leaf);

	if (proof.length === 0) {
		// Hash not found in tree
		return null;
	}

	const root = getMerkleRoot(tree);

	// Convert proof to hex strings
	const proofHashes = proof.map((p) => p.data.toString("hex"));

	// Get positions (0 = left, 1 = right)
	const positions = proof.map((p) => (p.position === "left" ? 0 : 1));

	return {
		leaf: voteHash,
		proof: proofHashes,
		root,
		position: proof[0]?.position ?? "left",
		positions,
	};
}

/**
 * Verify a Merkle proof
 *
 * @param proof - The Merkle proof data
 * @returns True if proof is valid
 */
export function verifyMerkleProof(proof: MerkleProofData): boolean {
	try {
		const leaf = sha256(proof.leaf);
		const root = Buffer.from(proof.root, "hex");

		// Convert proof hashes to buffers
		const proofBuffers = proof.proof.map((hash) => Buffer.from(hash, "hex"));

		// Use MerkleTree.verify with the correct signature
		const verified = MerkleTree.verify(proofBuffers, leaf, root, sha256, {
			sortPairs: true,
		});

		return verified;
	} catch (error) {
		console.error("Error verifying Merkle proof:", error);
		return false;
	}
}

/**
 * Generate Merkle tree from database vote hashes
 * This is a convenience function for use in tRPC procedures
 *
 * @param voteHashes - Array of vote hashes from database
 * @returns Object with tree, root, and stats
 */
export function generateElectionMerkleTree(voteHashes: string[]): {
	tree: MerkleTree;
	root: string;
	totalVotes: number;
	treeDepth: number;
} {
	if (voteHashes.length === 0) {
		throw new Error("Cannot generate Merkle tree for election with no votes");
	}

	const tree = buildMerkleTree(voteHashes);
	const root = getMerkleRoot(tree);

	// Calculate tree depth (log2 of leaf count, rounded up)
	const treeDepth = Math.ceil(Math.log2(voteHashes.length));

	return {
		tree,
		root,
		totalVotes: voteHashes.length,
		treeDepth,
	};
}

/**
 * Batch generate Merkle proofs for multiple vote hashes
 *
 * @param tree - MerkleTree instance
 * @param voteHashes - Array of vote hashes
 * @returns Array of proofs (or null for hashes not in tree)
 */
export function batchGenerateMerkleProofs(
	tree: MerkleTree,
	voteHashes: string[],
): Array<MerkleProofData | null> {
	return voteHashes.map((hash) => generateMerkleProof(tree, hash));
}

/**
 * Verify multiple Merkle proofs
 *
 * @param proofs - Array of Merkle proof data
 * @returns Object with verification results
 */
export function batchVerifyMerkleProofs(proofs: MerkleProofData[]): {
	total: number;
	verified: number;
	failed: number;
	results: Array<{ proof: MerkleProofData; valid: boolean }>;
} {
	const results = proofs.map((proof) => ({
		proof,
		valid: verifyMerkleProof(proof),
	}));

	const verified = results.filter((r) => r.valid).length;
	const failed = results.filter((r) => !r.valid).length;

	return {
		total: proofs.length,
		verified,
		failed,
		results,
	};
}

/**
 * Serialize Merkle proof for storage or transmission
 *
 * @param proof - Merkle proof data
 * @returns JSON string
 */
export function serializeMerkleProof(proof: MerkleProofData): string {
	return JSON.stringify(proof);
}

/**
 * Deserialize Merkle proof from storage or transmission
 *
 * @param serialized - JSON string
 * @returns Merkle proof data
 */
export function deserializeMerkleProof(serialized: string): MerkleProofData {
	return JSON.parse(serialized) as MerkleProofData;
}

/**
 * Get tree statistics
 *
 * @param tree - MerkleTree instance
 * @returns Statistics about the tree
 */
export function getMerkleTreeStats(tree: MerkleTree): {
	root: string;
	depth: number;
	leafCount: number;
	layers: number;
} {
	const layers = tree.getLayers();
	const root = getMerkleRoot(tree);

	return {
		root,
		depth: layers.length - 1,
		leafCount: layers[0]?.length ?? 0,
		layers: layers.length,
	};
}
