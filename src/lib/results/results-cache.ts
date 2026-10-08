/**
 * Server-side cache for computed election results (Upstash Redis).
 * Avoids re-running the heavy fetch + calculation on every request (e.g. public results page).
 * Invalidated whenever something that affects results changes.
 *
 * Entries are versioned. Invalidating bumps a version number instead of
 * deleting the entry, and results are written under the version that was
 * current when the request started. A request that read the database before
 * a change but finishes after its invalidation therefore writes to a key that
 * nothing reads any more, instead of putting stale results back in the cache.
 */

import { Redis } from "@upstash/redis";
import superjson from "superjson";

import { env } from "@/env";

const CACHE_TTL_SEC_LIVE = 5 * 60; // 5 min when results not finalized
const CACHE_TTL_SEC_FINALIZED = 24 * 60 * 60; // 24 hours when finalized & published (purge manually from Redis if needed)
const KEY_PREFIX = "election-results:";
const VERSION_PREFIX = "election-results-version:";
/** Bumped to invalidate every election at once (e.g. quorum changes) */
const GLOBAL_VERSION_KEY = "election-results-version";

const redis = new Redis({
	url: env.UPSTASH_REDIS_REST_URL,
	token: env.UPSTASH_REDIS_REST_TOKEN,
	automaticDeserialization: false,
});

const resultsKey = (electionId: string, version: string) =>
	`${KEY_PREFIX}${electionId}:${version}`;

/**
 * Read cached results. Returns the current cache version too: pass it to
 * setCachedElectionResults when caching results computed after this read.
 */
export async function getCachedElectionResults<T>(
	electionId: string,
): Promise<{ value: T | null; version: string }> {
	const [globalVersion, electionVersion] = await redis.mget<(string | null)[]>(
		GLOBAL_VERSION_KEY,
		VERSION_PREFIX + electionId,
	);
	const version = `${globalVersion ?? 0}.${electionVersion ?? 0}`;
	const raw = await redis.get<string>(resultsKey(electionId, version));
	return { value: raw == null ? null : superjson.parse<T>(raw), version };
}

/** Cache results computed after reading `version` from getCachedElectionResults */
export async function setCachedElectionResults<T>(
	electionId: string,
	version: string,
	value: T,
	opts: { isFinalized: boolean; isPublished: boolean },
): Promise<void> {
	const ttlSec =
		opts.isFinalized && opts.isPublished
			? CACHE_TTL_SEC_FINALIZED
			: CACHE_TTL_SEC_LIVE;
	await redis.set(resultsKey(electionId, version), superjson.stringify(value), {
		ex: ttlSec,
	});
}

export async function invalidateElectionResults(
	electionId: string,
): Promise<void> {
	await redis.incr(VERSION_PREFIX + electionId);
}

export async function invalidateAllElectionResults(): Promise<void> {
	await redis.incr(GLOBAL_VERSION_KEY);
}
