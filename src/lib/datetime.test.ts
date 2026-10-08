import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
	formatDateForInput,
	formatDateInAppTz,
	formatDateTimeLocalForInput,
	formatInAppTz,
	formatTimeForInput,
	formatTimeInAppTz,
	parseDateTimeLocalInAppTz,
	parseLocalDateTimeInAppTz,
} from "./datetime";

const utc = (iso: string) => new Date(iso);

describe("formatting in America/Toronto", () => {
	// 2026-10-08 00:30 in Toronto (EDT, UTC-4), but 04:30 on the 8th in UTC
	const justAfterMidnight = utc("2026-10-08T04:30:00Z");

	it("formats dates and times in Toronto time, not UTC or the host zone", () => {
		expect(formatInAppTz(justAfterMidnight)).toBe("2026-10-08, 00:30:00");
		expect(formatDateInAppTz(justAfterMidnight)).toBe("2026-10-08");
		expect(formatTimeInAppTz(justAfterMidnight)).toBe("00:30");
	});

	it("uses the previous Toronto day for early-UTC instants", () => {
		expect(formatDateInAppTz(utc("2026-10-08T03:59:00Z"))).toBe("2026-10-07");
	});

	it("formats midnight as 00, never 24", () => {
		expect(formatTimeInAppTz(utc("2026-01-15T05:00:00Z"))).toBe("00:00");
	});

	it("produces values valid for date, time and datetime-local inputs", () => {
		expect(formatDateForInput(justAfterMidnight)).toBe("2026-10-08");
		expect(formatTimeForInput(justAfterMidnight)).toBe("00:30");
		expect(formatDateTimeLocalForInput(justAfterMidnight)).toBe(
			"2026-10-08T00:30",
		);
	});

	it("accepts formatting overrides", () => {
		expect(
			formatDateInAppTz(justAfterMidnight, { month: "long", day: "numeric" }),
		).toBe("October 8, 2026");
	});
});

describe("parseLocalDateTimeInAppTz", () => {
	it.each([
		["2026-07-15", "09:00", "2026-07-15T13:00:00.000Z", "summer (EDT)"],
		["2026-01-15", "09:00", "2026-01-15T14:00:00.000Z", "winter (EST)"],
		[
			"2026-01-15",
			"23:59",
			"2026-01-16T04:59:00.000Z",
			"crossing UTC midnight",
		],
		// Daylight saving transition days: times before 02:00 use the old offset
		["2026-11-01", "00:30", "2026-11-01T04:30:00.000Z", "before fall-back"],
		["2026-11-01", "03:00", "2026-11-01T08:00:00.000Z", "after fall-back"],
		[
			"2026-03-08",
			"01:30",
			"2026-03-08T06:30:00.000Z",
			"before spring-forward",
		],
		["2026-03-08", "03:30", "2026-03-08T07:30:00.000Z", "after spring-forward"],
	])("parses %s %s as Toronto time (%s)", (date, time, expected) => {
		expect(parseLocalDateTimeInAppTz(date, time).toISOString()).toBe(expected);
	});
});

describe("parseDateTimeLocalInAppTz", () => {
	it("parses a datetime-local value as Toronto time, ignoring seconds", () => {
		expect(parseDateTimeLocalInAppTz("2026-07-15T09:00").toISOString()).toBe(
			"2026-07-15T13:00:00.000Z",
		);
		expect(parseDateTimeLocalInAppTz("2026-07-15T09:00:45").toISOString()).toBe(
			"2026-07-15T13:00:00.000Z",
		);
	});

	it("falls back to the Date constructor for values without a time part", () => {
		expect(parseDateTimeLocalInAppTz("2026-07-15").toISOString()).toBe(
			new Date("2026-07-15").toISOString(),
		);
	});

	it("round-trips any minute through the datetime-local input format", () => {
		const minute = 60_000;
		const hour = 60 * minute;
		const toInstant = (m: number) => new Date(m * minute);
		const anyMinute = fc
			.integer({
				min: Date.UTC(2024, 0, 1) / minute,
				max: Date.UTC(2032, 0, 1) / minute,
			})
			.map(toInstant);

		// Daylight saving transition days (second Sunday of March, first Sunday
		// of November), where offset bugs show up
		const nthSunday = (year: number, month: number, n: number) => {
			const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
			return 1 + ((7 - firstDay) % 7) + (n - 1) * 7;
		};
		const transitionDays = [
			2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031,
		].flatMap((year) =>
			[
				[2, nthSunday(year, 2, 2)],
				[10, nthSunday(year, 10, 1)],
			].map(([month = 0, day = 1]) => Date.UTC(year, month, day) / minute),
		);
		const transitionDayMinute = fc
			.constantFrom(...transitionDays)
			.chain((dayStart) =>
				// Toronto's day spans roughly 04:00-05:00 UTC to the next morning
				fc.integer({ min: dayStart, max: dayStart + 30 * 60 }),
			)
			.map(toInstant);

		fc.assert(
			fc.property(fc.oneof(anyMinute, transitionDayMinute), (date) => {
				const local = formatDateTimeLocalForInput(date);
				const parsed = parseDateTimeLocalInAppTz(local);
				// A local time in the repeated hour after fall-back names two
				// instants; it resolves to the first (EDT) one
				const isRepeatedHour =
					formatDateTimeLocalForInput(new Date(date.getTime() - hour)) ===
					local;
				expect(parsed.getTime()).toBe(
					isRepeatedHour ? date.getTime() - hour : date.getTime(),
				);
			}),
			{ numRuns: 2_000 },
		);
	});
});
