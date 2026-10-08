import { describe, expect, it } from "vitest";
import {
	type CSVRow,
	checkDuplicates,
	getValidationSummary,
	validateCSVData,
	validateHeaders,
	validateRow,
} from "./validation";

const row = (overrides: Partial<CSVRow> = {}): CSVRow => ({
	studentId: "1234567",
	firstName: "Ada",
	lastName: "Lovelace",
	email: "ada@uoguelph.ca",
	college: "COE",
	...overrides,
});

const fields = (errors: { field: string }[]) => errors.map((e) => e.field);

describe("validateHeaders", () => {
	it("accepts the required columns in any order and case", () => {
		expect(
			validateHeaders([
				"COLLEGE",
				" email ",
				"lastName",
				"firstname",
				"studentId",
			]),
		).toEqual([]);
	});

	it("reports each missing required column", () => {
		expect(
			validateHeaders(["studentId", "email"]).map((e) => e.message),
		).toEqual([
			"Missing required column: firstName",
			"Missing required column: lastName",
			"Missing required column: college",
		]);
	});
});

describe("validateRow", () => {
	it("accepts a valid row", () => {
		expect(validateRow(row(), 2)).toEqual([]);
	});

	it("allows missing first and last names", () => {
		expect(validateRow(row({ firstName: "", lastName: "" }), 2)).toEqual([]);
	});

	it.each([
		["12345", true],
		["1234567890", true],
		["  1234567 ", true],
		["1234", false],
		["12345678901", false],
		["12a4567", false],
		["-1234567", false],
	])("student ID %j valid: %s", (studentId, valid) => {
		expect(fields(validateRow(row({ studentId }), 2))).toEqual(
			valid ? [] : ["studentId"],
		);
	});

	it.each([
		["ada@uoguelph.ca", true],
		["first.last+tag@mail.uoguelph.ca", true],
		["ada@uoguelph", false],
		["ada uoguelph.ca", false],
		["@uoguelph.ca", false],
		["ada@@uoguelph.ca", false],
	])("email %j valid: %s", (email, valid) => {
		expect(fields(validateRow(row({ email }), 2))).toEqual(
			valid ? [] : ["email"],
		);
	});

	it.each([
		["COE", true],
		["coe", true],
		[" Lang ", true],
		["OVC", true],
		["Engineering", false],
		["CO E", false],
	])("college %j valid: %s", (college, valid) => {
		expect(fields(validateRow(row({ college }), 2))).toEqual(
			valid ? [] : ["college"],
		);
	});

	it("reports every problem in a row, tagged with its row number", () => {
		const errors = validateRow(
			{ ...row(), studentId: " ", email: "", college: "" },
			7,
		);
		expect(errors.map((e) => [e.row, e.field, e.message])).toEqual([
			[7, "studentId", "Student ID is required"],
			[7, "email", "Email is required"],
			[7, "college", "College is required"],
		]);
	});
});

describe("checkDuplicates", () => {
	it("flags repeated student IDs and emails with both row numbers", () => {
		const errors = checkDuplicates([
			row(),
			row({ studentId: "2222222", email: "other@uoguelph.ca" }),
			row({ email: "third@uoguelph.ca" }),
			row({ studentId: "3333333", email: "ADA@uoguelph.ca " }),
		]);
		expect(errors.map((e) => [e.row, e.field, e.message])).toEqual([
			[4, "studentId", "Duplicate student ID (first seen on row 2)"],
			[5, "email", "Duplicate email (first seen on row 2)"],
		]);
	});

	it("treats student IDs that differ only by surrounding whitespace as duplicates", () => {
		expect(
			fields(
				checkDuplicates([
					row(),
					row({ studentId: " 1234567 ", email: "b@uoguelph.ca" }),
				]),
			),
		).toEqual(["studentId"]);
	});
});

describe("validateCSVData", () => {
	it("combines row and duplicate errors across batch boundaries", () => {
		const rows = Array.from({ length: 5 }, (_, i) =>
			row({ studentId: `${1_000_000 + i}`, email: `s${i}@uoguelph.ca` }),
		);
		rows[3] = row({ studentId: "bad", email: "s3@uoguelph.ca" });
		rows[4] = row({ studentId: "1000000", email: "s4@uoguelph.ca" });

		const result = validateCSVData(rows, 2);
		expect(result.valid).toBe(false);
		expect(result.rowCount).toBe(5);
		expect(result.errors.map((e) => [e.row, e.field])).toEqual([
			[5, "studentId"],
			[6, "studentId"],
		]);
	});

	it("is valid when there are no errors", () => {
		expect(validateCSVData([row()])).toEqual({
			valid: true,
			errors: [],
			warnings: [],
			rowCount: 1,
		});
	});
});

describe("getValidationSummary", () => {
	it("summarises a valid result", () => {
		expect(
			getValidationSummary(
				validateCSVData([
					row(),
					row({ studentId: "7654321", email: "b@uoguelph.ca" }),
				]),
			),
		).toBe("✅ All 2 rows are valid");
	});

	it("groups error counts by field", () => {
		const result = validateCSVData([
			row({ studentId: "1", email: "bad" }),
			row({ studentId: "2", email: "b@uoguelph.ca" }),
		]);
		expect(getValidationSummary(result)).toBe(
			[
				"❌ Found 3 errors in 2 rows:",
				"  - studentId: 2 errors",
				"  - email: 1 errors",
			].join("\n"),
		);
	});
});
