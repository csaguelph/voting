import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/env";

/**
 * Generate an HMAC-SHA256 hash of a student ID for database lookups
 * This allows us to query for students without decrypting the encrypted studentId field
 *
 * Uses HMAC instead of plain SHA-256 to prevent oracle attacks where an attacker
 * could hash known student IDs and query the database to confirm enrollment.
 *
 * @param studentId - The plaintext student ID
 * @returns HMAC-SHA256 hash of the student ID (hex string)
 */
export function hashStudentId(studentId: string): string {
	const secret = env.VOTE_HASH_SECRET;

	if (!secret) {
		throw new Error(
			"VOTE_HASH_SECRET is required for hashing student IDs. " +
				"This protects against oracle attacks on encrypted student data.",
		);
	}

	return createHmac("sha256", secret).update(studentId).digest("hex");
}

/**
 * Generate a cryptographic hash for a vote using HMAC for integrity protection
 * Format: HMAC-SHA256(electionId|ballotId|voteData|voterId|timestamp, SECRET_KEY)
 *
 * This hash serves multiple purposes:
 * 1. Vote verification - voters can verify their vote was counted
 * 2. Anonymity - no direct link between voter and vote choice
 * 3. Integrity - hash CANNOT be recalculated without the secret key
 *
 * SECURITY: Using HMAC instead of plain SHA-256 prevents database administrators
 * from manipulating vote data and recalculating valid hashes. Even if they change
 * the voteData, they cannot generate a valid new hash without the HMAC secret.
 *
 * The hash is deterministic (no random salt) so it can be recomputed and verified.
 * Uniqueness is guaranteed by the combination of voterId and timestamp.
 *
 * @param electionId - The election ID
 * @param ballotId - The ballot ID
 * @param voteData - The vote data as JSON (rankings or simple vote)
 * @param voterId - The voter's unique ID (email or student ID)
 * @param timestamp - When the vote was cast
 * @param hmacSecret - Optional HMAC secret (defaults to env.VOTE_HASH_SECRET)
 * @returns The deterministic vote hash with HMAC protection
 */
export function generateVoteHash({
	electionId,
	ballotId,
	voteData,
	voterId,
	timestamp,
	hmacSecret,
}: {
	electionId: string;
	ballotId: string;
	voteData: unknown; // JSON vote data
	voterId: string;
	timestamp: Date;
	hmacSecret?: string;
}): string {
	// Serialize vote data to stable JSON string (sorted keys for consistency)
	const voteDataString = JSON.stringify(
		voteData,
		Object.keys(voteData as object).sort(),
	);

	// Create the hash input string
	const hashInput = [
		electionId,
		ballotId,
		voteDataString,
		voterId,
		timestamp.toISOString(),
	].join("|");

	// Use HMAC with secret key for integrity protection
	// This prevents database administrators from manipulating votes and recalculating hashes
	const secret = hmacSecret ?? env.VOTE_HASH_SECRET;

	if (!secret) {
		throw new Error(
			"VOTE_HASH_SECRET is required for generating vote hashes. " +
				"This protects against vote manipulation by database administrators.",
		);
	}

	// Generate HMAC-SHA256 hash
	const voteHash = createHmac("sha256", secret).update(hashInput).digest("hex");

	return voteHash;
}

/**
 * Verify a vote hash using timing-safe comparison
 * Regenerates the hash with the same inputs and compares
 *
 * @param voteHash - The hash to verify
 * @param inputs - The original inputs used to generate the hash
 * @param hmacSecret - Optional HMAC secret (defaults to env.VOTE_HASH_SECRET)
 * @returns True if the hash is valid
 */
export function verifyVoteHash(
	voteHash: string,
	inputs: {
		electionId: string;
		ballotId: string;
		voteData: unknown;
		voterId: string;
		timestamp: Date;
	},
	hmacSecret?: string,
): boolean {
	const regeneratedHash = generateVoteHash({ ...inputs, hmacSecret });

	// Use timing-safe comparison to prevent timing attacks
	try {
		return timingSafeEqual(
			Buffer.from(voteHash, "hex"),
			Buffer.from(regeneratedHash, "hex"),
		);
	} catch {
		// If lengths don't match or invalid hex, return false
		return false;
	}
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
