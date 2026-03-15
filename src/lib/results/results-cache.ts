/**
 * Server-side cache for computed election results (Upstash Redis).
 * Avoids re-running the heavy fetch + calculation on every request (e.g. public results page).
 * Invalidated when results are finalized or published.
 */

import { Redis } from "@upstash/redis";
import superjson from "superjson";

import { env } from "@/env";

const CACHE_TTL_SEC_LIVE = 2 * 60; // 2 min when results not finalized
const CACHE_TTL_SEC_FINALIZED = 60 * 60; // 1 hour when finalized & published
const KEY_PREFIX = "election-results:";

const redis = new Redis({
	url: env.UPSTASH_REDIS_REST_URL,
	token: env.UPSTASH_REDIS_REST_TOKEN,
});

export async function getCachedElectionResults<T>(
	electionId: string,
): Promise<T | null> {
	const key = KEY_PREFIX + electionId;
	const raw = await redis.get(key);
	if (raw == null || typeof raw !== "string") return null;
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
