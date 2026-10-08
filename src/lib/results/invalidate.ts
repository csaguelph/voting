import { invalidateElectionResults } from "./results-cache";

/**
 * Drop an election's cached results after a change that affects what they
 * show. Cache errors are logged rather than thrown, so a Redis outage can't
 * block the change itself (the stale entry then expires on its own).
 */
export async function invalidateCachedResults(electionId: string) {
	try {
		await invalidateElectionResults(electionId);
	} catch (err) {
		console.error("[results-cache] invalidateElectionResults failed:", err);
	}
}
