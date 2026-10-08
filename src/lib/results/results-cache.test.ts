import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
	values: new Map<string, string>(),
	ttls: new Map<string, number>(),
}));

// Minimal in-memory Redis with the commands the cache uses
vi.mock("@upstash/redis", () => ({
	Redis: class {
		async mget(...keys: string[]) {
			return keys.map((k) => store.values.get(k) ?? null);
		}
		async get(key: string) {
			return store.values.get(key) ?? null;
		}
		async set(key: string, value: string, opts: { ex: number }) {
			store.values.set(key, value);
			store.ttls.set(key, opts.ex);
			return "OK";
		}
		async incr(key: string) {
			const next = Number(store.values.get(key) ?? 0) + 1;
			store.values.set(key, String(next));
			return next;
		}
	},
}));

const {
	getCachedElectionResults,
	invalidateAllElectionResults,
	invalidateElectionResults,
	setCachedElectionResults,
} = await import("./results-cache");

const live = { isFinalized: false, isPublished: false };

/** Simulate a request: read the cache, then cache freshly computed results */
async function cacheFresh(electionId: string, value: unknown) {
	const { version } = await getCachedElectionResults(electionId);
	await setCachedElectionResults(electionId, version, value, live);
}

beforeEach(() => {
	store.values.clear();
	store.ttls.clear();
});

describe("results cache", () => {
	it("returns cached results until invalidated", async () => {
		expect((await getCachedElectionResults("e1")).value).toBeNull();
		await cacheFresh("e1", { totalVoted: 5 });
		expect((await getCachedElectionResults("e1")).value).toEqual({
			totalVoted: 5,
		});

		await invalidateElectionResults("e1");
		expect((await getCachedElectionResults("e1")).value).toBeNull();
	});

	it("round-trips Dates and Maps through superjson", async () => {
		const value = {
			at: new Date("2026-03-01T15:00:00Z"),
			m: new Map([["a", 1]]),
		};
		await cacheFresh("e1", value);
		expect((await getCachedElectionResults("e1")).value).toEqual(value);
	});

	it("doesn't let a request that started before an invalidation re-cache stale results", async () => {
		// A request reads the cache (miss) and starts computing from the database
		const { version } = await getCachedElectionResults("e1");
		// Meanwhile a candidate is disqualified and the cache invalidated
		await invalidateElectionResults("e1");
		// The slow request finishes with results computed before the change
		await setCachedElectionResults("e1", version, { winner: "old" }, live);

		expect((await getCachedElectionResults("e1")).value).toBeNull();
		await cacheFresh("e1", { winner: "new" });
		expect((await getCachedElectionResults("e1")).value).toEqual({
			winner: "new",
		});
	});

	it("invalidates one election without affecting others", async () => {
		await cacheFresh("e1", "one");
		await cacheFresh("e2", "two");
		await invalidateElectionResults("e1");
		expect((await getCachedElectionResults("e1")).value).toBeNull();
		expect((await getCachedElectionResults("e2")).value).toBe("two");
	});

	it("can invalidate every election at once", async () => {
		await cacheFresh("e1", "one");
		await cacheFresh("e2", "two");
		await invalidateAllElectionResults();
		expect((await getCachedElectionResults("e1")).value).toBeNull();
		expect((await getCachedElectionResults("e2")).value).toBeNull();
	});

	it("keeps published results for a day and live results for five minutes", async () => {
		const { version } = await getCachedElectionResults("e1");
		await setCachedElectionResults("e1", version, "live", live);
		await setCachedElectionResults("e2", version, "final", {
			isFinalized: true,
			isPublished: true,
		});
		expect(store.ttls.get(`election-results:e1:${version}`)).toBe(300);
		expect(store.ttls.get(`election-results:e2:${version}`)).toBe(86_400);
	});
});
