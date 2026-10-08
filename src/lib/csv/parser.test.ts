import { describe, expect, it } from "vitest";
import {
	formatCSVStats,
	getCSVStats,
	getPreviewRows,
	parseCSVFromString,
} from "./parser";

const HEADER = "studentId,firstName,lastName,email,college";
const csv = (...lines: string[]) => lines.join("\n");

describe("parseCSVFromString", () => {
	it("parses a valid voter list", async () => {
		const result = await parseCSVFromString(
			csv(
				HEADER,
				"1234567,Ada,Lovelace,ada@uoguelph.ca,COE",
				"2345678,Alan,Turing,alan@uoguelph.ca,CCMPS",
			),
		);

		expect(result.parseErrors).toEqual([]);
		expect(result.validation.valid).toBe(true);
		expect(result.data).toEqual([
			{
				studentId: "1234567",
				firstName: "Ada",
				lastName: "Lovelace",
				email: "ada@uoguelph.ca",
				college: "COE",
			},
			{
				studentId: "2345678",
				firstName: "Alan",
				lastName: "Turing",
				email: "alan@uoguelph.ca",
				college: "CCMPS",
			},
		]);
	});

	it("trims whitespace from headers and values", async () => {
		const result = await parseCSVFromString(
			csv(
				" studentId , firstName ,lastName, email ,college ",
				" 1234567 , Ada ,Lovelace, ada@uoguelph.ca , COE ",
			),
		);
		expect(result.validation.valid).toBe(true);
		expect(result.data[0]).toMatchObject({
			studentId: "1234567",
			firstName: "Ada",
			email: "ada@uoguelph.ca",
			college: "COE",
		});
	});

	it("handles quoted fields containing commas", async () => {
		const result = await parseCSVFromString(
			csv(HEADER, '1234567,"Ada, Countess",Lovelace,ada@uoguelph.ca,COE'),
		);
		expect(result.data[0]?.firstName).toBe("Ada, Countess");
	});

	it("handles Windows line endings and a UTF-8 byte order mark", async () => {
		const result = await parseCSVFromString(
			`﻿${HEADER}\r\n1234567,Ada,Lovelace,ada@uoguelph.ca,COE\r\n`,
		);
		expect(result.parseErrors).toEqual([]);
		expect(result.validation.valid).toBe(true);
		expect(result.data[0]?.studentId).toBe("1234567");
	});

	it("skips blank lines", async () => {
		const result = await parseCSVFromString(
			csv(HEADER, "", "1234567,Ada,Lovelace,ada@uoguelph.ca,COE", "  ", ""),
		);
		expect(result.data).toHaveLength(1);
	});

	it.each([
		["spaced names", "Student ID,First Name,Last Name,Email Address,College"],
		["snake_case names", "student_id,first_name,last_name,email,college"],
		["upper-case names", "STUDENTID,FIRSTNAME,LASTNAME,EMAIL,COLLEGE"],
		["short names", "id,fname,lname,mail,faculty"],
	])("maps header aliases (%s) onto voter fields", async (_label, header) => {
		const result = await parseCSVFromString(
			csv(header, "1234567,Ada,Lovelace,ada@uoguelph.ca,COE"),
		);

		expect(result.parseErrors).toEqual([]);
		expect(result.validation.valid).toBe(true);
		expect(result.data[0]).toEqual({
			studentId: "1234567",
			firstName: "Ada",
			lastName: "Lovelace",
			email: "ada@uoguelph.ca",
			college: "COE",
		});
	});

	it("reports missing required columns as validation errors", async () => {
		const result = await parseCSVFromString(
			csv("studentId,firstName,lastName", "1234567,Ada,Lovelace"),
		);
		expect(result.parseErrors).toEqual([
			"Missing required column: email",
			"Missing required column: college",
		]);
		expect(result.validation.valid).toBe(false);
		expect(result.validation.errors.slice(0, 2)).toEqual([
			{ row: 0, field: "headers", message: "Missing required column: email" },
			{ row: 0, field: "headers", message: "Missing required column: college" },
		]);
	});

	it.each([
		["id,studentId", "1111111,1234567"],
		["studentId,id", "1234567,1111111"],
	])(
		"rejects a file where two columns map to the student ID (%s)",
		async (idColumns, idValues) => {
			const result = await parseCSVFromString(
				csv(
					`${idColumns},firstName,lastName,email,college`,
					`${idValues},Ada,Lovelace,ada@uoguelph.ca,COE`,
				),
			);
			const message = expect.stringMatching(
				/Columns "(id|studentId)" and "(id|studentId)" both map to studentId/,
			);

			expect(result.validation.valid).toBe(false);
			expect(result.validation.errors).toContainEqual({
				row: 0,
				field: "headers",
				message,
			});
			expect(result.parseErrors).toContainEqual(message);
		},
	);

	it("rejects colliding aliases for other fields too", async () => {
		const result = await parseCSVFromString(
			csv(
				"studentId,firstName,lastName,email,Email Address,college",
				"1234567,Ada,Lovelace,ada@uoguelph.ca,ada@uoguelph.ca,COE",
			),
		);
		expect(result.validation.valid).toBe(false);
		expect(result.validation.errors[0]?.message).toBe(
			'Columns "email" and "Email Address" both map to email; remove or rename one',
		);
	});

	it("reports row-level validation errors with spreadsheet row numbers", async () => {
		const result = await parseCSVFromString(
			csv(
				HEADER,
				"1234567,Ada,Lovelace,ada@uoguelph.ca,COE",
				"12,Bad,Id,bad@uoguelph.ca,COE",
			),
		);
		expect(result.validation.valid).toBe(false);
		expect(result.validation.errors).toEqual([
			expect.objectContaining({ row: 3, field: "studentId" }),
		]);
	});

	it("parses a 30,000-row file quickly", async () => {
		const rows = Array.from(
			{ length: 30_000 },
			(_, i) =>
				`${1_000_000 + i},First${i},Last${i},student${i}@uoguelph.ca,COE`,
		);
		const start = performance.now();
		const result = await parseCSVFromString(csv(HEADER, ...rows));
		const elapsed = performance.now() - start;

		expect(result.data).toHaveLength(30_000);
		expect(result.validation.valid).toBe(true);
		// Generous bound for slow CI runners; guards against accidental O(n²)
		expect(elapsed).toBeLessThan(5_000);
	});
});

describe("CSV stats and preview", () => {
	const rows = [
		{ studentId: "1", firstName: "", lastName: "", email: "", college: "COE" },
		{ studentId: "2", firstName: "", lastName: "", email: "", college: "COE" },
		{
			studentId: "3",
			firstName: "",
			lastName: "",
			email: "",
			college: " OAC ",
		},
		{ studentId: "4", firstName: "", lastName: "", email: "", college: "" },
	];

	it("counts rows per college, ignoring blanks", () => {
		expect(getCSVStats(rows)).toEqual({
			totalRows: 4,
			colleges: { COE: 2, OAC: 1 },
			estimatedSizeKB: 1,
		});
	});

	it("formats stats with percentages of all rows", () => {
		expect(formatCSVStats(getCSVStats(rows))).toBe(
			[
				"Total Rows: 4",
				"Estimated Size: 1 KB",
				"",
				"Distribution by College:",
				"  COE: 2 (50.0%)",
				"  OAC: 1 (25.0%)",
			].join("\n"),
		);
	});

	it("returns the first N rows for preview", () => {
		expect(getPreviewRows(rows, 2)).toEqual(rows.slice(0, 2));
		expect(getPreviewRows(rows)).toHaveLength(4);
	});
});
