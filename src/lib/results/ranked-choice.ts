/**
 * Ranked Choice Voting (Instant Runoff) Calculator
 *
 * Implements the instant runoff voting algorithm:
 * 1. Count first-choice votes
 * 2. If a candidate has >50%, they win
 * 3. Otherwise, eliminate the candidate with the fewest votes
 * 4. Redistribute their votes to next choices
 * 5. Repeat until a winner emerges
 *
 * Ties for exclusion follow the Australian rule. Exclude the candidate who
 * had the fewest votes at the most recent earlier count where one of the tied
 * candidates had fewer votes than each of the others. If no earlier count
 * separates them, the CRO decides by lot: counting stops at that round
 * (`pendingLot`) until the draw is recorded and passed in as a `LotDecision`.
 * A final-round tie between the last two candidates is resolved the same way.
 */

export interface RankedVote {
	voteId: string;
	rankings: string[]; // Ordered list of candidate IDs (1st choice, 2nd choice, etc.)
}

export interface RoundResult {
	round: number;
	eliminated: string | null;
	voteCounts: Map<string, number>;
	totalVotes: number;
}

/** The recorded outcome of a draw by lot between candidates tied for exclusion */
export interface LotDecision {
	round: number;
	candidateIds: string[];
	excludedCandidateId: string;
}

/** How a tie for exclusion was resolved */
export interface TieBreak {
	round: number;
	candidateIds: string[];
	excluded: string;
	method: "PREVIOUS_COUNT" | "LOT";
	/** For PREVIOUS_COUNT: the earlier round whose counts decided it */
	decidedByRound?: number;
}

export interface RankedChoiceResult {
	winner: string | null;
	rounds: RoundResult[];
	finalCounts: Map<string, number>;
	totalVotes: number;
	isTie: boolean;
	/** Ties resolved during the count, in round order */
	tieBreaks: TieBreak[];
	/** Set when counting stopped on a tie that must be decided by lot */
	pendingLot?: { round: number; candidateIds: string[] };
}

const sortedIds = (ids: string[]) => [...ids].sort();
const sameIds = (a: string[], b: string[]) =>
	a.length === b.length &&
	sortedIds(a).every((id, i) => id === sortedIds(b)[i]);

/**
 * The most recent earlier round in which exactly one of the tied candidates
 * had fewer votes than each of the others, and that candidate
 */
function lookBack(
	tied: string[],
	previousRounds: RoundResult[],
): { excluded: string; round: number } | null {
	for (let i = previousRounds.length - 1; i >= 0; i--) {
		const round = previousRounds[i];
		if (!round) continue;
		const counts = tied.map((id) => round.voteCounts.get(id) ?? 0);
		const fewest = Math.min(...counts);
		const lowest = tied.filter((_, j) => counts[j] === fewest);
		if (lowest.length === 1 && lowest[0]) {
			return { excluded: lowest[0], round: round.round };
		}
	}
	return null;
}

/**
 * Calculate ranked choice voting results using instant runoff
 *
 * @param votes - Array of ranked votes (each vote has ordered candidate IDs)
 * @param candidateIds - All candidate IDs in the race
 * @param ineligibleCandidateIds - Withdrawn/disqualified candidate IDs; they are treated as
 *   already eliminated so votes for them flow to the voter's next choice (RCV-compliant)
 * @returns Result with winner, round-by-round breakdown, and final counts
 */
export function calculateRankedChoice(
	votes: RankedVote[],
	candidateIds: string[],
	ineligibleCandidateIds: string[] = [],
	lotDecisions: LotDecision[] = [],
): RankedChoiceResult {
	const tieBreaks: TieBreak[] = [];
	if (votes.length === 0) {
		return {
			winner: null,
			rounds: [],
			finalCounts: new Map(),
			totalVotes: 0,
			isTie: false,
			tieBreaks,
		};
	}

	const ineligibleSet = new Set(ineligibleCandidateIds);
	// Initialize active candidates: only those eligible (withdrawn/disqualified are pre-eliminated)
	const activeCandidates = new Set(
		candidateIds.filter((id) => !ineligibleSet.has(id)),
	);
	const rounds: RoundResult[] = [];
	let roundNumber = 1;

	// Keep track of each vote's current preference
	const votePreferences = new Map<string, string[]>(
		votes.map((v) => [v.voteId, v.rankings]),
	);

	while (activeCandidates.size > 0) {
		// Count votes for each active candidate based on current preferences
		const voteCounts = new Map<string, number>();
		for (const candidateId of activeCandidates) {
			voteCounts.set(candidateId, 0);
		}

		let totalActiveVotes = 0;

		for (const [_voteId, rankings] of votePreferences.entries()) {
			// Find the highest-ranked candidate who is still active
			const currentChoice = rankings.find((candidateId) =>
				activeCandidates.has(candidateId),
			);

			if (currentChoice) {
				voteCounts.set(currentChoice, (voteCounts.get(currentChoice) ?? 0) + 1);
				totalActiveVotes++;
			}
		}

		// Check if any candidate has a majority (>50%)
		const majority = Math.floor(totalActiveVotes / 2) + 1;
		const maxVotes = Math.max(...Array.from(voteCounts.values()), 0);
		const candidatesWithMaxVotes = Array.from(voteCounts.entries())
			.filter(([_, count]) => count === maxVotes)
			.map(([id]) => id);

		if (maxVotes >= majority) {
			// We have a winner (or a tie at >50%)
			const isTie = candidatesWithMaxVotes.length > 1;
			rounds.push({
				round: roundNumber,
				eliminated: null,
				voteCounts,
				totalVotes: totalActiveVotes,
			});

			return {
				winner: candidatesWithMaxVotes[0] ?? null,
				rounds,
				finalCounts: voteCounts,
				totalVotes: votes.length,
				isTie,
				tieBreaks,
			};
		}

		// If only one candidate remains, they win
		if (activeCandidates.size === 1) {
			rounds.push({
				round: roundNumber,
				eliminated: null,
				voteCounts,
				totalVotes: totalActiveVotes,
			});

			return {
				winner: Array.from(activeCandidates)[0] ?? null,
				rounds,
				finalCounts: voteCounts,
				totalVotes: votes.length,
				isTie: false,
				tieBreaks,
			};
		}

		// Find candidate(s) with fewest votes to eliminate
		const minVotes = Math.min(...Array.from(voteCounts.values()));
		const candidatesWithMinVotes = Array.from(voteCounts.entries())
			.filter(([_, count]) => count === minVotes)
			.map(([id]) => id);

		// Eliminate the candidate with fewest votes, breaking ties by the
		// Australian rule: look back at earlier counts, then decide by lot
		let toEliminate = candidatesWithMinVotes[0];
		if (candidatesWithMinVotes.length > 1) {
			const tied = sortedIds(candidatesWithMinVotes);
			const earlier = lookBack(tied, rounds);
			const draw = lotDecisions.find(
				(d) =>
					d.round === roundNumber &&
					sameIds(d.candidateIds, tied) &&
					tied.includes(d.excludedCandidateId),
			);
			if (earlier) {
				toEliminate = earlier.excluded;
				tieBreaks.push({
					round: roundNumber,
					candidateIds: tied,
					excluded: earlier.excluded,
					method: "PREVIOUS_COUNT",
					decidedByRound: earlier.round,
				});
			} else if (draw) {
				toEliminate = draw.excludedCandidateId;
				tieBreaks.push({
					round: roundNumber,
					candidateIds: tied,
					excluded: draw.excludedCandidateId,
					method: "LOT",
				});
			} else {
				// Tied at every count: wait for the CRO to decide by lot
				rounds.push({
					round: roundNumber,
					eliminated: null,
					voteCounts,
					totalVotes: totalActiveVotes,
				});
				return {
					winner: null,
					rounds,
					finalCounts: voteCounts,
					totalVotes: votes.length,
					isTie: true,
					tieBreaks,
					pendingLot: { round: roundNumber, candidateIds: tied },
				};
			}
		}

		if (!toEliminate) {
			// Should never happen, but safety check
			break;
		}

		rounds.push({
			round: roundNumber,
			eliminated: toEliminate,
			voteCounts,
			totalVotes: totalActiveVotes,
		});

		activeCandidates.delete(toEliminate);
		roundNumber++;

		// Safety check: prevent infinite loops
		if (roundNumber > candidateIds.length + 5) {
			console.error("Ranked choice calculation exceeded maximum rounds");
			break;
		}
	}

	// If we get here, something went wrong - no clear winner
	// Return tie among remaining candidates
	return {
		winner: null,
		rounds,
		finalCounts: new Map(),
		totalVotes: votes.length,
		isTie: true,
		tieBreaks,
	};
}

/**
 * Get a human-readable description of a round
 */
export function describeRound(
	round: RoundResult,
	candidateNames: Map<string, string>,
): string {
	const counts = Array.from(round.voteCounts.entries())
		.map(([id, count]) => {
			const name = candidateNames.get(id) ?? "Unknown";
			return `${name}: ${count}`;
		})
		.join(", ");

	if (round.eliminated) {
		const eliminatedName = candidateNames.get(round.eliminated) ?? "Unknown";
		return `Round ${round.round}: ${counts}. Eliminated: ${eliminatedName}`;
	}

	return `Round ${round.round} (Final): ${counts}`;
}
