import { describe, expect, it } from "vitest";
import {
	IDENTITY_CONFIRMATION_MS,
	identityLockedUntil,
	isIdentityConfirmed,
	normalizeStudentId,
	studentIdsMatch,
} from "./identity";

const now = new Date("2026-10-08T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("normalizeStudentId", () => {
	it.each([
		["1234567", "1234567"],
		[" 1234567 ", "1234567"],
		["123 4567", "1234567"],
		["123-4567", "1234567"],
		["0123456", "123456"],
		["0000", "0"],
		["A0123", "A0123"],
		["", ""],
	])("%j → %j", (input, expected) => {
		expect(normalizeStudentId(input)).toBe(expected);
	});
});

describe("studentIdsMatch", () => {
	it("matches the same ID typed differently", () => {
		expect(studentIdsMatch(" 123 4567", "1234567")).toBe(true);
		expect(studentIdsMatch("123456", "0123456")).toBe(true);
	});

	it("rejects a different or empty ID", () => {
		expect(studentIdsMatch("1234568", "1234567")).toBe(false);
		expect(studentIdsMatch("", "1234567")).toBe(false);
		expect(studentIdsMatch("123456", "1234567")).toBe(false);
	});
});

describe("isIdentityConfirmed", () => {
	const voter = (identityConfirmedAt: Date | null) => ({
		identityConfirmedAt,
		identityLockedUntil: null,
	});

	it("is false until the voter confirms", () => {
		expect(isIdentityConfirmed(voter(null), now)).toBe(false);
	});

	it("lasts for the confirmation window", () => {
		expect(isIdentityConfirmed(voter(ago(0)), now)).toBe(true);
		expect(
			isIdentityConfirmed(voter(ago(IDENTITY_CONFIRMATION_MS - 1)), now),
		).toBe(true);
		expect(isIdentityConfirmed(voter(ago(IDENTITY_CONFIRMATION_MS)), now)).toBe(
			false,
		);
	});
});

describe("identityLockedUntil", () => {
	const voter = (until: Date | null) => ({
		identityConfirmedAt: null,
		identityLockedUntil: until,
	});

	it("returns the end of an active lockout", () => {
		const until = new Date(now.getTime() + 1000);
		expect(identityLockedUntil(voter(until), now)).toEqual(until);
	});

	it("returns null once the lockout has passed", () => {
		expect(identityLockedUntil(voter(null), now)).toBeNull();
		expect(identityLockedUntil(voter(now), now)).toBeNull();
		expect(identityLockedUntil(voter(ago(1)), now)).toBeNull();
	});
});
