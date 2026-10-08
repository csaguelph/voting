import Papa from "papaparse";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
	ballot,
	candidate,
	NO,
	ranked,
	votes,
	YES,
} from "@/test/results-fixtures";
import { calculateElectionResults, type ElectionResults } from "./calculator";
import {
	createSummaryReport,
	formatBallotSummary,
	formatCandidateResult,
	formatDate,
	formatReferendumResult,
	formatResultsAsCSV,
	formatResultsAsJSON,
	formatTurnoutStats,
	generateResultsFilename,
} from "./formatter";

beforeAll(() => {
	vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
	vi.useRealTimers();
});

const election = (names: string[] = ["Ada", "Bob"]): ElectionResults =>
	calculateElectionResults(
		{
			id: "e1",
			name: "2026 General Election",
			isFinalized: true,
			isPublished: true,
			finalizedAt: new Date("2026-03-10T16:00:00Z"),
			publishedAt: new Date("2026-03-11T16:00:00Z"),
		},
		[
			ballot({
				id: "exec",
				title: "President",
				candidates: names.map((name, i) => candidate(`c${i}`, { name })),
				votes: [...votes(3, ranked("c0")), ...votes(1, ranked("c1"))],
			}),
			ballot({
				id: "ref",
				title: "Transit Fee",
				type: "REFERENDUM",
				votes: [...votes(3, YES), ...votes(1, NO)],
			}),
		],
		10,
		4,
	);

/** Data rows of the CSV, skipping "#" comment lines; fails on malformed CSV */
const csvRows = (csv: string) => {
	const parsed = Papa.parse<string[]>(
		csv
			.split("\n")
			.filter((line) => line && !line.startsWith("#"))
			.join("\n"),
	);
	expect(parsed.errors).toEqual([]);
	return parsed.data;
};

describe("formatResultsAsCSV", () => {
	it("exports candidate and referendum tables with metadata comments", () => {
		const csv = formatResultsAsCSV(election());

		expect(csv).toContain("# Election: 2026 General Election");
		expect(csv).toContain("# Turnout: 40%");
		expect(csv).toContain("# Finalized: Yes on 2026-03-10T16:00:00.000Z");
		expect(csvRows(csv)).toEqual([
			["Candidate", "Votes", "Percentage", "Status"],
			["Ada", "3", "75%", "WINNER"],
			["Bob", "1", "25%", ""],
			["Option", "Votes", "Percentage"],
			["YES", "3", "75%"],
			["NO", "1", "25%"],
			["Result", "PASSED"],
		]);
	});

	it("keeps names containing commas and quotes in a single cell", () => {
		const csv = formatResultsAsCSV(election(['Jane "JJ" Smith', "Doe, John"]));
		const rows = csvRows(csv);
		expect(rows[1]?.[0]).toBe('Jane "JJ" Smith');
		expect(rows[2]?.[0]).toBe("Doe, John");
	});

	it.each(['=HYPERLINK("x")', "+1", "-1+1", "@SUM(A1)"])(
		"neutralises a candidate name that a spreadsheet would run as a formula (%s)",
		(name) => {
			const rows = csvRows(formatResultsAsCSV(election([name, "Bob"])));
			expect(rows[1]?.[0]).toBe(`'${name}`);
		},
	);

	it("includes scores and seat info for multi-seat ballots", () => {
		const results = calculateElectionResults(
			{ id: "e", name: "E", isFinalized: false, isPublished: false },
			[
				ballot({
					seatsAvailable: 2,
					candidates: ["a", "b", "c"].map((id) => candidate(id)),
					votes: votes(2, ranked("a", "b")),
				}),
			],
			10,
			2,
		);
		const csv = formatResultsAsCSV(results);
		expect(csvRows(csv)[0]).toEqual([
			"Candidate",
			"Score",
			"Votes",
			"Percentage",
			"Status",
		]);
		expect(csv).toContain("# Seats Available: 2");
		expect(csv).toContain("# Scoring: 1st choice = 3 pts, 2nd = 2 pts, etc.");
	});

	it("hides vote counts for withdrawn candidates", () => {
		const results = calculateElectionResults(
			{ id: "e", name: "E", isFinalized: false, isPublished: false },
			[
				ballot({
					candidates: [
						candidate("a", { name: "Ada" }),
						candidate("w", { name: "Will", status: "WITHDRAWN" }),
					],
					votes: votes(2, ranked("a")),
				}),
			],
			10,
			2,
		);
		expect(csvRows(formatResultsAsCSV(results))).toContainEqual([
			"Will",
			"",
			"",
			"WITHDRAWN",
		]);
	});
});

describe("formatResultsAsJSON", () => {
	it("round-trips the results", () => {
		const results = election();
		expect(JSON.parse(formatResultsAsJSON(results))).toEqual(
			JSON.parse(JSON.stringify(results)),
		);
	});
});

describe("display helpers", () => {
	const results = election();
	const [exec, ref] = results.ballots;

	it("summarises ballots", () => {
		expect(exec && formatBallotSummary(exec)).toBe(
			"President: Ada (3 votes, 75%)",
		);
		expect(ref && formatBallotSummary(ref)).toBe(
			"Transit Fee: PASSED (YES: 3, NO: 1)",
		);
	});

	it("formats candidate and referendum lines", () => {
		const ada = exec?.candidates?.[0];
		expect(ada && formatCandidateResult(ada)).toBe(
			"Ada: 3 votes (75%) (WINNER)",
		);
		expect(ref?.referendum && formatReferendumResult(ref.referendum)).toBe(
			"YES: 3 (75%), NO: 1 (25%) - PASSED",
		);
		expect(formatTurnoutStats(results)).toBe("4 / 10 voters (40%)");
	});

	it("formats dates in Toronto time and handles missing dates", () => {
		expect(formatDate(new Date("2026-03-10T16:00:00Z"))).toBe(
			"March 10, 2026 at 12:00:00",
		);
		expect(formatDate(null)).toBe("Not set");
	});
});

describe("generateResultsFilename", () => {
	it("slugifies the election name and stamps the date", () => {
		vi.useFakeTimers({ now: new Date("2026-03-11T12:00:00Z") });
		expect(
			generateResultsFilename("  2026 CSA General Election! ", "csv"),
		).toBe("election-results-2026-csa-general-election-2026-03-11.csv");
		expect(generateResultsFilename("../../etc/passwd", "json")).toBe(
			"election-results-etc-passwd-2026-03-11.json",
		);
	});
});

describe("createSummaryReport", () => {
	it("includes turnout, each ballot and the outcome", () => {
		const report = createSummaryReport(election());
		expect(report).toContain("ELECTION RESULTS: 2026 General Election");
		expect(report).toContain("Turnout: 40%");
		expect(report).toContain("President");
		expect(report).toContain("Transit Fee");
	});
});
