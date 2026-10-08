import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	generateReceiptHash,
	generateVoteHash,
	hashStudentId,
	verifyVoteHash,
} from "./hash";

const SECRET = "test-vote-hash-secret-at-least-32-chars";

const baseVote = {
	electionId: "election-1",
	ballotId: "ballot-1",
	voteData: { type: "RANKED", rankings: ["c1", "c2"] },
	voterId: "1234567",
	timestamp: new Date("2026-03-01T15:30:00.000Z"),
};

describe("hashStudentId", () => {
	it("is an HMAC-SHA256 of the student ID keyed with VOTE_HASH_SECRET", () => {
		const expected = createHmac("sha256", SECRET)
			.update("1234567")
			.digest("hex");
		expect(hashStudentId("1234567")).toBe(expected);
	});

	it("is deterministic and distinguishes different IDs", () => {
		expect(hashStudentId("1234567")).toBe(hashStudentId("1234567"));
		expect(hashStudentId("1234567")).not.toBe(hashStudentId("1234568"));
	});
});

describe("generateVoteHash", () => {
	it("produces a 64-character hex HMAC", () => {
		expect(generateVoteHash(baseVote)).toMatch(/^[0-9a-f]{64}$/);
	});

	it("is deterministic for identical inputs", () => {
		expect(generateVoteHash(baseVote)).toBe(generateVoteHash({ ...baseVote }));
	});

	it("does not depend on the key order of the vote data", () => {
		const reordered = {
			...baseVote,
			voteData: { rankings: ["c1", "c2"], type: "RANKED" },
		};
		expect(generateVoteHash(reordered)).toBe(generateVoteHash(baseVote));
	});

	it.each([
		["electionId", { electionId: "election-2" }],
		["ballotId", { ballotId: "ballot-2" }],
		["voter", { voterId: "7654321" }],
		["timestamp", { timestamp: new Date("2026-03-01T15:30:00.001Z") }],
		["ranking order", { voteData: { type: "RANKED", rankings: ["c2", "c1"] } }],
		["vote type", { voteData: { type: "ABSTAIN" } }],
	])("changes when the %s changes", (_field, change) => {
		expect(generateVoteHash({ ...baseVote, ...change })).not.toBe(
			generateVoteHash(baseVote),
		);
	});

	it("depends on the secret, so the hash can't be recomputed without it", () => {
		expect(
			generateVoteHash({ ...baseVote, hmacSecret: "other-secret" }),
		).not.toBe(generateVoteHash(baseVote));
	});
});

describe("verifyVoteHash", () => {
	const hash = generateVoteHash(baseVote);

	it("accepts a hash generated from the same inputs", () => {
		expect(verifyVoteHash(hash, baseVote)).toBe(true);
	});

	it("rejects a hash when any input differs", () => {
		expect(verifyVoteHash(hash, { ...baseVote, ballotId: "ballot-2" })).toBe(
			false,
		);
	});

	it("rejects a hash generated with a different secret", () => {
		expect(verifyVoteHash(hash, baseVote, "other-secret")).toBe(false);
	});

	it.each([
		["a truncated hash", hash.slice(0, 32)],
		["non-hex input", "not-a-hash"],
		["an empty string", ""],
	])("returns false rather than throwing for %s", (_label, input) => {
		expect(verifyVoteHash(input, baseVote)).toBe(false);
	});
});

describe("generateReceiptHash", () => {
	const receipt = {
		electionId: "election-1",
		ballotId: "ballot-1",
		candidateId: "c1",
		timestamp: new Date("2026-03-01T15:30:00.000Z"),
	};

	it("returns a 16-character uppercase hex code", () => {
		expect(generateReceiptHash(receipt)).toMatch(/^[0-9A-F]{16}$/);
	});

	it("is deterministic and input-sensitive", () => {
		expect(generateReceiptHash(receipt)).toBe(generateReceiptHash(receipt));
		expect(generateReceiptHash({ ...receipt, candidateId: "c2" })).not.toBe(
			generateReceiptHash(receipt),
		);
	});
});
