import { createHash, randomBytes } from "node:crypto";

/**
 * Generate a cryptographic hash for a vote
 * Format: SHA-256(electionId|ballotId|candidateId|voterId|timestamp|salt)
 *
 * This hash serves multiple purposes:
 * 1. Vote verification - voters can verify their vote was counted
 * 2. Anonymity - no direct link between voter and candidate
 * 3. Integrity - hash proves vote hasn't been tampered with
 *
 * @param electionId - The election ID
 * @param ballotId - The ballot ID
 * @param candidateId - The candidate ID (or "YES"/"NO" for referendums)
 * @param voterId - The voter's unique ID (email or student ID)
 * @param timestamp - When the vote was cast
 * @param salt - Random salt for additional security (generated if not provided)
 * @returns Object with voteHash and salt used
 */
export function generateVoteHash({
	electionId,
	ballotId,
	candidateId,
	voterId,
	timestamp,
	salt,
}: {
	electionId: string;
	ballotId: string;
	candidateId: string;
	voterId: string;
	timestamp: Date;
	salt?: string;
}): { voteHash: string; salt: string } {
	// Generate salt if not provided
	const usedSalt = salt ?? randomBytes(32).toString("hex");

	// Create the hash input string
	const hashInput = [
		electionId,
		ballotId,
		candidateId,
		voterId,
		timestamp.toISOString(),
		usedSalt,
	].join("|");

	// Generate SHA-256 hash
	const voteHash = createHash("sha256").update(hashInput).digest("hex");

	return {
		voteHash,
		salt: usedSalt,
	};
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
		salt: string;
	},
): boolean {
	const { voteHash: regeneratedHash } = generateVoteHash(inputs);
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
