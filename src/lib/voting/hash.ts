import { createHash } from "node:crypto";

/**
 * Generate a cryptographic hash for a vote
 * Format: SHA-256(electionId|ballotId|candidateId|voterId|timestamp)
 *
 * This hash serves multiple purposes:
 * 1. Vote verification - voters can verify their vote was counted
 * 2. Anonymity - no direct link between voter and candidate
 * 3. Integrity - hash can be recomputed to prove vote hasn't been tampered with
 *
 * The hash is deterministic (no random salt) so it can be recomputed and verified.
 * Uniqueness is guaranteed by the combination of voterId and timestamp.
 *
 * @param electionId - The election ID
 * @param ballotId - The ballot ID
 * @param candidateId - The candidate ID (or "YES"/"NO" for referendums)
 * @param voterId - The voter's unique ID (email or student ID)
 * @param timestamp - When the vote was cast
 * @returns The deterministic vote hash
 */
export function generateVoteHash({
	electionId,
	ballotId,
	candidateId,
	voterId,
	timestamp,
}: {
	electionId: string;
	ballotId: string;
	candidateId: string;
	voterId: string;
	timestamp: Date;
}): string {
	// Create the hash input string
	const hashInput = [
		electionId,
		ballotId,
		candidateId,
		voterId,
		timestamp.toISOString(),
	].join("|");

	// Generate SHA-256 hash
	const voteHash = createHash("sha256").update(hashInput).digest("hex");

	return voteHash;
}

/**
 * Verify a vote hash
 * Regenerates the hash with the same inputs and compares
 *
 * @param voteHash - The hash to verify
 * @param inputs - The original inputs used to generate the hash
 * @returns True if the hash is valid
 */
export function verifyVoteHash(
	voteHash: string,
	inputs: {
		electionId: string;
		ballotId: string;
		candidateId: string;
		voterId: string;
		timestamp: Date;
	},
): boolean {
	const regeneratedHash = generateVoteHash(inputs);
	return regeneratedHash === voteHash;
}

/**
 * Generate a simple hash for a vote receipt
 * This is a simpler hash that doesn't include voter ID for privacy
 * Format: SHA-256(electionId|ballotId|candidateId|timestamp)
 *
 * @param electionId - The election ID
 * @param ballotId - The ballot ID
 * @param candidateId - The candidate ID
 * @param timestamp - When the vote was cast
 * @returns Receipt hash (shortened to 16 characters for readability)
 */
export function generateReceiptHash({
	electionId,
	ballotId,
	candidateId,
	timestamp,
}: {
	electionId: string;
	ballotId: string;
	candidateId: string;
	timestamp: Date;
}): string {
	const hashInput = [
		electionId,
		ballotId,
		candidateId,
		timestamp.toISOString(),
	].join("|");

	const hash = createHash("sha256").update(hashInput).digest("hex");

	// Return first 16 characters for readability
	return hash.substring(0, 16).toUpperCase();
}
