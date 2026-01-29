/**
 * Ranked Choice Voting (Instant Runoff) Calculator
 *
 * Implements the instant runoff voting algorithm:
 * 1. Count first-choice votes
 * 2. If a candidate has >50%, they win
 * 3. Otherwise, eliminate the candidate with the fewest votes
 * 4. Redistribute their votes to next choices
 * 5. Repeat until a winner emerges
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

export interface RankedChoiceResult {
	winner: string | null;
	rounds: RoundResult[];
	finalCounts: Map<string, number>;
	totalVotes: number;
	isTie: boolean;
}

/**
 * Calculate ranked choice voting results using instant runoff
 *
 * @param votes - Array of ranked votes (each vote has ordered candidate IDs)
 * @param candidateIds - All candidate IDs in the race
 * @returns Result with winner, round-by-round breakdown, and final counts
 */
export function calculateRankedChoice(
	votes: RankedVote[],
	candidateIds: string[],
): RankedChoiceResult {
	if (votes.length === 0) {
		return {
			winner: null,
			rounds: [],
			finalCounts: new Map(),
			totalVotes: 0,
			isTie: false,
		};
	}

	// Initialize active candidates (not yet eliminated)
	const activeCandidates = new Set(candidateIds);
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

		for (const [voteId, rankings] of votePreferences.entries()) {
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
			};
		}

		// Find candidate(s) with fewest votes to eliminate
		const minVotes = Math.min(...Array.from(voteCounts.values()));
		const candidatesWithMinVotes = Array.from(voteCounts.entries())
			.filter(([_, count]) => count === minVotes)
			.map(([id]) => id);

		// Eliminate the candidate with fewest votes
		// If there's a tie at the bottom, eliminate the first one alphabetically
		const toEliminate =
			candidatesWithMinVotes.length === 1
				? candidatesWithMinVotes[0]
				: candidatesWithMinVotes.sort()[0];

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
