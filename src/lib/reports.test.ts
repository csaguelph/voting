import { describe, expect, it } from "vitest";
import { REPORT_DETAILS_MAX, reportError, reportInput } from "./reports";

describe("reportError", () => {
	it("needs a reason", () => {
		expect(reportError({ reason: "", details: "" })).toMatchObject({
			field: "reason",
		});
	});

	it("needs details only for 'something else'", () => {
		expect(reportError({ reason: "PRESSURED", details: "" })).toBeNull();
		expect(reportError({ reason: "OTHER", details: "  " })).toMatchObject({
			field: "details",
		});
		expect(reportError({ reason: "OTHER", details: "It was odd" })).toBeNull();
	});

	it("limits the details' length, ignoring surrounding spaces", () => {
		const max = "x".repeat(REPORT_DETAILS_MAX);
		expect(
			reportError({ reason: "PRESSURED", details: ` ${max} ` }),
		).toBeNull();
		expect(
			reportError({ reason: "PRESSURED", details: `${max}x` }),
		).toMatchObject({ field: "details" });
	});
});

describe("reportInput", () => {
	it("trims the details", () => {
		expect(
			reportInput.parse({ reason: "PRESSURED", details: "  hi  " }),
		).toEqual({ reason: "PRESSURED", details: "hi" });
	});

	it("rejects an unknown reason, or 'something else' with no details", () => {
		expect(reportInput.safeParse({ reason: "NOPE", details: "" }).success).toBe(
			false,
		);
		expect(
			reportInput.safeParse({ reason: "OTHER", details: " " }).success,
		).toBe(false);
	});
});
