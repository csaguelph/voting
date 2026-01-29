import type { Ballot, Candidate, Vote } from "@prisma/client";
import {
	type RankedVote,
	calculateRankedChoice,
	describeRound,
} from "./ranked-choice";

/**
 * Result for a single candidate in a ballot
 */
export interface CandidateResult {
	candidateId: string;
	name: string;
	votes: number; // For ranked choice, this is first-round votes
	percentage: number;
	isWinner: boolean;
	isTied: boolean;
	finalRoundVotes?: number; // For ranked choice, final round votes
	score?: number; // For multi-seat elections, ranking position score
}

/**
 * Ranked choice voting details
 */
export interface RankedChoiceDetails {
	rounds: Array<{
		round: number;
		eliminated: string | null;
		voteCounts: Record<string, number>;
	}>;
	description: string[];
}

/**
 * Referendum result (YES/NO voting)
 */
export interface ReferendumResult {
	yes: number;
	no: number;
	yesPercentage: number;
	noPercentage: number;
	totalVotes: number;
	passed: boolean; // true if YES > NO
	isTied: boolean; // true if YES === NO
}

/**
 * Results for a single ballot
 */
export interface BallotResult {
	ballotId: string;
	ballotTitle: string;
	ballotType: "EXECUTIVE" | "DIRECTOR" | "REFERENDUM";
	college?: string | null;
	seatsAvailable: number;
	totalVotes: number;
	eligibleVoters: number;
	quorumThreshold: number;
	hasReachedQuorum: boolean;
	quorumPercentage: number;
	candidates?: CandidateResult[];
	referendum?: ReferendumResult;
	rankedChoiceDetails?: RankedChoiceDetails; // Extra info for ranked choice
}

/**
 * Complete election results
 */
export interface ElectionResults {
	electionId: string;
	electionName: string;
	totalEligibleVoters: number;
	totalVoted: number;
	turnoutPercentage: number;
	ballots: BallotResult[];
	isFinalized: boolean;
	isPublished: boolean;
	finalizedAt?: Date | null;
	publishedAt?: Date | null;
}

/**
 * Internal type for ballot results before quorum calculation
 */
type PartialBallotResult = Omit<
	BallotResult,
	"eligibleVoters" | "quorumThreshold" | "hasReachedQuorum" | "quorumPercentage"
>;

/**
 * Calculate results for a regular ballot (EXECUTIVE or DIRECTOR)
 * Now handles both single-candidate YES/NO/ABSTAIN and multi-candidate ranked choice
 */
export function calculateBallotResults(
	ballot: Ballot & { candidates: Candidate[]; votes: Vote[] },
): PartialBallotResult {
	const totalVotes = ballot.votes.length;

	// Check if this is single candidate (YES/NO) or ranked choice
	const isSingleCandidate = ballot.candidates.length === 1;

	if (isSingleCandidate) {
		// Single candidate: count YES/NO votes
		const candidate = ballot.candidates[0];
		if (!candidate) {
			throw new Error("Single candidate ballot has no candidates");
		}

		let yesVotes = 0;
		let noVotes = 0;

		for (const vote of ballot.votes) {
			const voteData = vote.voteData as { type: string };
			if (voteData.type === "YES") {
				yesVotes++;
			} else if (voteData.type === "NO") {
				noVotes++;
			}
		}

		const candidateResult: CandidateResult = {
			candidateId: candidate.id,
			name: candidate.name,
			votes: yesVotes,
			percentage: totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0,
			isWinner: yesVotes > noVotes,
			isTied: yesVotes === noVotes && totalVotes > 0,
		};

		return {
			ballotId: ballot.id,
			ballotTitle: ballot.title,
			ballotType: ballot.type as "EXECUTIVE" | "DIRECTOR",
			college: ballot.college,
			seatsAvailable: ballot.seatsAvailable,
			totalVotes,
			candidates: [candidateResult],
		};
	}

	// Multiple candidates: use ranked choice voting
	const rankedVotes: RankedVote[] = ballot.votes
		.map((vote) => {
			const voteData = vote.voteData as
				| { type: "RANKED"; rankings: string[] }
				| { type: string };

			if (voteData.type === "RANKED" && "rankings" in voteData) {
				return {
					voteId: vote.id,
					rankings: voteData.rankings,
				};
			}
			return null;
		})
		.filter((v): v is RankedVote => v !== null);

	const rankedResult = calculateRankedChoice(
		rankedVotes,
		ballot.candidates.map((c) => c.id),
	);

	// Build candidate results from ranked choice results
	const candidateResults: CandidateResult[] = ballot.candidates.map(
		(candidate) => {
			// First round votes
			const firstRoundVotes =
				rankedResult.rounds[0]?.voteCounts.get(candidate.id) ?? 0;
			// Final round votes
			const finalRoundVotes = rankedResult.finalCounts.get(candidate.id) ?? 0;

			const isWinner = rankedResult.winner === candidate.id;
			const percentage =
				totalVotes > 0 ? (firstRoundVotes / totalVotes) * 100 : 0;

			return {
				candidateId: candidate.id,
				name: candidate.name,
				votes: firstRoundVotes,
				finalRoundVotes,
				percentage: Math.round(percentage * 100) / 100,
				isWinner,
				isTied: rankedResult.isTie && isWinner,
			};
		},
	);

	// For multi-seat elections, use first-choice voting instead of instant runoff
	// (Instant runoff is only designed for single-winner elections)
	if (ballot.seatsAvailable > 1) {
		// For multi-seat, calculate a score based on ranking positions
		// This gives candidates credit for being ranked, not just first-choice
		const candidateScores = new Map<string, number>();

		for (const vote of rankedVotes) {
			// Give points based on ranking position:
			// 1st place = candidates.length points, 2nd = candidates.length-1, etc.
			for (let i = 0; i < vote.rankings.length; i++) {
				const candidateId = vote.rankings[i];
				if (candidateId) {
					const points = ballot.candidates.length - i;
					candidateScores.set(
						candidateId,
						(candidateScores.get(candidateId) ?? 0) + points,
					);
				}
			}
		}

		// Calculate total points earned across all candidates
		const totalPoints = Array.from(candidateScores.values()).reduce(
			(sum, score) => sum + score,
			0,
		);

		// Attach scores and recalculate percentages based on points
		for (const candidate of candidateResults) {
			candidate.score = candidateScores.get(candidate.candidateId) ?? 0;
			// For multi-seat, percentage = (candidate's points / total points) * 100
			candidate.percentage =
				totalPoints > 0 ? (candidate.score / totalPoints) * 100 : 0;
		}

		// Sort by score (ranking position weighted), then by first-choice votes
		candidateResults.sort((a, b) => {
			const aScore = candidateScores.get(a.candidateId) ?? 0;
			const bScore = candidateScores.get(b.candidateId) ?? 0;
			if (bScore !== aScore) {
				return bScore - aScore;
			}
			if (b.votes !== a.votes) {
				return b.votes - a.votes;
			}
			return a.name.localeCompare(b.name);
		});

		// Clear any winner designation from instant runoff
		for (const candidate of candidateResults) {
			candidate.isWinner = false;
			candidate.isTied = false;
		}

		// Mark top seatsAvailable candidates as winners based on scores
		console.log(
			`[MULTI-SEAT] Ballot: ${ballot.title}, Seats: ${ballot.seatsAvailable}`,
		);
		console.log(
			"[MULTI-SEAT] Candidate scores:",
			Array.from(candidateScores.entries()).map(([id, score]) => {
				const cand = candidateResults.find((c) => c.candidateId === id);
				return { name: cand?.name, score };
			}),
		);

		for (
			let i = 0;
			i < Math.min(ballot.seatsAvailable, candidateResults.length);
			i++
		) {
			const candidate = candidateResults[i];
			if (candidate) {
				candidate.isWinner = true;
				console.log(
					`[MULTI-SEAT] Marking winner ${i + 1}/${ballot.seatsAvailable}: ${candidate.name}`,
				);
			}
		}

		// Check for ties at the cutoff position
		if (ballot.seatsAvailable < candidateResults.length) {
			const cutoffCandidate = candidateResults[ballot.seatsAvailable - 1];
			const cutoffScore = cutoffCandidate
				? (candidateScores.get(cutoffCandidate.candidateId) ?? 0)
				: 0;

			// Check if the next candidate has the same score (tie)
			const nextCandidate = candidateResults[ballot.seatsAvailable];
			const nextScore = nextCandidate
				? (candidateScores.get(nextCandidate.candidateId) ?? 0)
				: 0;

			if (nextScore === cutoffScore && cutoffScore > 0) {
				// Mark all candidates with the cutoff score as tied
				for (const candidate of candidateResults) {
					const candidateScore =
						candidateScores.get(candidate.candidateId) ?? 0;
					if (candidateScore === cutoffScore) {
						candidate.isTied = true;
					}
				}
			}
		}
	} else {
		// Single-seat: sort by final round votes from instant runoff
		candidateResults.sort((a, b) => {
			const aFinal = a.finalRoundVotes ?? a.votes;
			const bFinal = b.finalRoundVotes ?? b.votes;
			if (bFinal !== aFinal) {
				return bFinal - aFinal;
			}
			if (b.votes !== a.votes) {
				return b.votes - a.votes;
			}
			return a.name.localeCompare(b.name);
		});
	}

	// Create candidate names map for descriptions
	const candidateNames = new Map(ballot.candidates.map((c) => [c.id, c.name]));

	// Build ranked choice details
	const rankedChoiceDetails: RankedChoiceDetails = {
		rounds: rankedResult.rounds.map((round) => ({
			round: round.round,
			eliminated: round.eliminated,
			voteCounts: Object.fromEntries(round.voteCounts),
		})),
		description: rankedResult.rounds.map((round) =>
			describeRound(round, candidateNames),
		),
	};

	return {
		ballotId: ballot.id,
		ballotTitle: ballot.title,
		ballotType: ballot.type as "EXECUTIVE" | "DIRECTOR",
		college: ballot.college,
		seatsAvailable: ballot.seatsAvailable,
		totalVotes,
		candidates: candidateResults,
		rankedChoiceDetails,
	};
}

/**
 * Calculate results for a referendum ballot
 */
export function calculateReferendumResults(
	ballot: Ballot & { votes: Vote[] },
): PartialBallotResult {
	const totalVotes = ballot.votes.length;

	// Count YES and NO votes
	let yesVotes = 0;
	let noVotes = 0;

	for (const vote of ballot.votes) {
		const voteData = vote.voteData as { type: string };
		if (voteData.type === "YES") {
			yesVotes++;
		} else if (voteData.type === "NO") {
			noVotes++;
		}
	}

	const yesPercentage = totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0;
	const noPercentage = totalVotes > 0 ? (noVotes / totalVotes) * 100 : 0;

	const referendum: ReferendumResult = {
		yes: yesVotes,
		no: noVotes,
		yesPercentage: Math.round(yesPercentage * 100) / 100,
		noPercentage: Math.round(noPercentage * 100) / 100,
		totalVotes,
		passed: yesVotes > noVotes,
		isTied: yesVotes === noVotes && totalVotes > 0,
	};

	return {
		ballotId: ballot.id,
		ballotTitle: ballot.title,
		ballotType: "REFERENDUM",
		college: ballot.college,
		seatsAvailable: ballot.seatsAvailable,
		totalVotes,
		referendum,
	};
}

/**
 * Calculate complete election results
 */
export function calculateElectionResults(
	election: {
		id: string;
		name: string;
		isFinalized: boolean;
		isPublished: boolean;
		finalizedAt?: Date | null;
		publishedAt?: Date | null;
	},
	ballots: (Ballot & { candidates: Candidate[]; votes: Vote[] })[],
	eligibleVotersCount: number,
	votedCount: number,
	quorumSettings?: {
		executiveQuorum: number;
		directorQuorum: number;
		referendumQuorum: number;
	},
	collegeEligibleVoters?: Map<string, number>,
): ElectionResults {
	// Default quorum settings if not provided
	const settings = quorumSettings ?? {
		executiveQuorum: 10,
		directorQuorum: 10,
		referendumQuorum: 20,
	};

	const ballotResults: BallotResult[] = ballots.map((ballot) => {
		// Calculate eligible voters for this ballot
		const eligibleForBallot = ballot.college
			? (collegeEligibleVoters?.get(ballot.college) ?? 0)
			: eligibleVotersCount;

		// Get quorum percentage based on ballot type
		const quorumPercentage =
			ballot.type === "REFERENDUM"
				? settings.referendumQuorum
				: ballot.type === "DIRECTOR"
					? settings.directorQuorum
					: settings.executiveQuorum;

		const quorumThreshold = Math.ceil(
			(eligibleForBallot * quorumPercentage) / 100,
		);
		const totalVotes = ballot.votes.length;
		const hasReachedQuorum = totalVotes >= quorumThreshold;

		if (ballot.type === "REFERENDUM") {
			return {
				...calculateReferendumResults(ballot),
				eligibleVoters: eligibleForBallot,
				quorumThreshold,
				hasReachedQuorum,
				quorumPercentage,
			};
		}
		return {
			...calculateBallotResults(ballot),
			eligibleVoters: eligibleForBallot,
			quorumThreshold,
			hasReachedQuorum,
			quorumPercentage,
		};
	});

	const turnoutPercentage =
		eligibleVotersCount > 0 ? (votedCount / eligibleVotersCount) * 100 : 0;

	return {
		electionId: election.id,
		electionName: election.name,
		totalEligibleVoters: eligibleVotersCount,
		totalVoted: votedCount,
		turnoutPercentage: Math.round(turnoutPercentage * 100) / 100,
		ballots: ballotResults,
		isFinalized: election.isFinalized,
		isPublished: election.isPublished,
		finalizedAt: election.finalizedAt,
		publishedAt: election.publishedAt,
	};
}

/**
 * Get summary statistics for an election
 */
export function getResultsSummary(results: ElectionResults) {
	const totalBallots = results.ballots.length;
	const ballotsWithTies = results.ballots.filter(
		(b) => b.candidates?.some((c) => c.isTied) ?? false,
	).length;
	const referendumsCount = results.ballots.filter(
		(b) => b.ballotType === "REFERENDUM",
	).length;
	const referendumsPassed = results.ballots.filter(
		(b) => b.referendum?.passed,
	).length;

	return {
		totalBallots,
		ballotsWithTies,
		referendumsCount,
		referendumsPassed,
		turnout: {
			voted: results.totalVoted,
			eligible: results.totalEligibleVoters,
			percentage: results.turnoutPercentage,
		},
	};
}
