/**
 * Server-side cache for computed election results (Upstash Redis).
 * Avoids re-running the heavy fetch + calculation on every request (e.g. public results page).
 * Invalidated when results are finalized or published.
 */

import { Redis } from "@upstash/redis";
import superjson from "superjson";

import { env } from "@/env";

const CACHE_TTL_SEC_LIVE = 5 * 60; // 5 min when results not finalized
const CACHE_TTL_SEC_FINALIZED = 24 * 60 * 60; // 24 hours when finalized & published (purge manually from Redis if needed)
const KEY_PREFIX = "election-results:";

const redis = new Redis({
	url: env.UPSTASH_REDIS_REST_URL,
	token: env.UPSTASH_REDIS_REST_TOKEN,
	automaticDeserialization: false,
});

export async function getCachedElectionResults<T>(
	electionId: string,
): Promise<T | null> {
	const key = KEY_PREFIX + electionId;
	const raw = await redis.get<string>(key);
	if (raw == null) return null;
	return superjson.parse<T>(raw);
}

export async function setCachedElectionResults<T>(
	electionId: string,
	value: T,
	opts: { isFinalized: boolean; isPublished: boolean },
): Promise<void> {
	const key = KEY_PREFIX + electionId;
	const ttlSec =
		opts.isFinalized && opts.isPublished
			? CACHE_TTL_SEC_FINALIZED
			: CACHE_TTL_SEC_LIVE;
	await redis.set(key, superjson.stringify(value), { ex: ttlSec });
}

export async function invalidateElectionResults(
	electionId: string,
): Promise<void> {
	await redis.del(KEY_PREFIX + electionId);
}

/** Invalidate all cached results (e.g. when global quorum settings change). */
export async function invalidateAllElectionResults(): Promise<void> {
	const keys = await redis.keys(`${KEY_PREFIX}*`);
	if (keys.length > 0) {
		await redis.del(...keys);
	}
}
