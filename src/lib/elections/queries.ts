import type { PrismaClient } from "@prisma/client";

import { getCanonicalCollege } from "@/lib/constants/colleges";

/**
 * Build a map of canonical college -> eligible voter count for an election.
 * Sums counts when multiple raw college values map to the same canonical (e.g. "Lang" / "LANG").
 */
export async function buildCollegeEligibleMap(
	db: PrismaClient,
	electionId: string,
): Promise<Map<string, number>> {
	const collegeStats = await db.eligibleVoter.groupBy({
		by: ["college"],
		where: { electionId },
		_count: true,
	});
	const map = new Map<string, number>();
	for (const c of collegeStats) {
		const key = getCanonicalCollege(c.college) ?? c.college;
		map.set(key, (map.get(key) ?? 0) + c._count);
	}
	return map;
}

/**
 * Build a map of canonical college -> participated count (hasVoted) for an election.
 * Used for turnout-based quorum. Sums counts when multiple raw college values map to the same canonical.
 */
export async function buildCollegeVotedMap(
	db: PrismaClient,
	electionId: string,
): Promise<Map<string, number>> {
	const votedByCollege = await db.eligibleVoter.groupBy({
		by: ["college"],
		where: { electionId, hasVoted: true },
		_count: true,
	});
	const map = new Map<string, number>();
	for (const v of votedByCollege) {
		const key = getCanonicalCollege(v.college) ?? v.college;
		map.set(key, (map.get(key) ?? 0) + v._count);
	}
	return map;
}
