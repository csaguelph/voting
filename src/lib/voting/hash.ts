import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/env";

/**
 * Generate a cryptographic hash for a vote using HMAC for integrity protection
 * Format: HMAC-SHA256(electionId|ballotId|candidateId|voterId|timestamp, SECRET_KEY)
 *
 * This hash serves multiple purposes:
 * 1. Vote verification - voters can verify their vote was counted
 * 2. Anonymity - no direct link between voter and candidate
 * 3. Integrity - hash CANNOT be recalculated without the secret key
 *
 * SECURITY: Using HMAC instead of plain SHA-256 prevents database administrators
 * from manipulating vote data and recalculating valid hashes. Even if they change
 * the candidateId, they cannot generate a valid new hash without the HMAC secret.
 *
 * The hash is deterministic (no random salt) so it can be recomputed and verified.
 * Uniqueness is guaranteed by the combination of voterId and timestamp.
 *
 * @param electionId - The election ID
 * @param ballotId - The ballot ID
 * @param candidateId - The candidate ID (or "YES"/"NO" for referendums)
 * @param voterId - The voter's unique ID (email or student ID)
 * @param timestamp - When the vote was cast
 * @param hmacSecret - Optional HMAC secret (defaults to env.VOTE_HASH_SECRET)
 * @returns The deterministic vote hash with HMAC protection
 */
export function generateVoteHash({
	electionId,
	ballotId,
	candidateId,
	voterId,
	timestamp,
	hmacSecret,
}: {
	electionId: string;
	ballotId: string;
	candidateId: string;
	voterId: string;
	timestamp: Date;
	hmacSecret?: string;
}): string {
	// Create the hash input string
	const hashInput = [
		electionId,
		ballotId,
		candidateId,
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
		candidateId: string;
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
