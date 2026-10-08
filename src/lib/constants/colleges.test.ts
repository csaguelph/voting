import { describe, expect, it } from "vitest";
import { COLLEGES, getCanonicalCollege, isValidCollege } from "./colleges";

describe("colleges", () => {
	it("lists the eight U of G colleges", () => {
		expect(COLLEGES).toEqual([
			"COA",
			"CBS",
			"Lang",
			"CCMPS",
			"COE",
			"CSAHS",
			"OAC",
			"OVC",
		]);
	});

	it("validates exact college codes only", () => {
		expect(isValidCollege("Lang")).toBe(true);
		expect(isValidCollege("LANG")).toBe(false);
		expect(isValidCollege("")).toBe(false);
	});

	it.each([
		["COE", "COE"],
		["coe", "COE"],
		["  lang ", "Lang"],
		["Ccmps", "CCMPS"],
		["Engineering", null],
		["", null],
	])("canonicalises %j to %j", (input, expected) => {
		expect(getCanonicalCollege(input)).toBe(expected);
	});
});
