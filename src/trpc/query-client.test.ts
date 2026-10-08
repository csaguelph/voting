import { describe, expect, it } from "vitest";
import { shouldRetryQuery } from "./query-client";

const trpcError = (httpStatus: number) => ({ data: { httpStatus } });

describe("shouldRetryQuery", () => {
	it("doesn't retry refusals that would only fail again", () => {
		for (const status of [400, 401, 403, 404, 409]) {
			expect(shouldRetryQuery(0, trpcError(status))).toBe(false);
		}
	});

	it("retries server errors, timeouts and rate limits up to three times", () => {
		for (const status of [500, 503, 408, 429]) {
			expect(shouldRetryQuery(0, trpcError(status))).toBe(true);
			expect(shouldRetryQuery(2, trpcError(status))).toBe(true);
			expect(shouldRetryQuery(3, trpcError(status))).toBe(false);
		}
	});

	it("retries network failures that have no HTTP status", () => {
		expect(shouldRetryQuery(0, new TypeError("Failed to fetch"))).toBe(true);
		expect(shouldRetryQuery(0, null)).toBe(true);
		expect(shouldRetryQuery(3, null)).toBe(false);
	});
});
