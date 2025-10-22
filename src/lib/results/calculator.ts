import type { Ballot, Candidate, Vote } from "@prisma/client";

/**
 * Result for a single candidate in a ballot
 */
export interface CandidateResult {
	candidateId: string;
	name: string;
	votes: number;
	percentage: number;
	isWinner: boolean;
	isTied: boolean;
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
	totalVotes: number;
	eligibleVoters: number;
	quorumThreshold: number;
	hasReachedQuorum: boolean;
	quorumPercentage: number;
	candidates?: CandidateResult[];
	referendum?: ReferendumResult;
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
 */
export function calculateBallotResults(
	ballot: Ballot & { candidates: Candidate[]; votes: Vote[] },
): PartialBallotResult {
	const totalVotes = ballot.votes.length;

	// Count votes per candidate
	const voteCounts = new Map<string, number>();
	for (const candidate of ballot.candidates) {
		voteCounts.set(candidate.id, 0);
	}

	for (const vote of ballot.votes) {
		if (vote.candidateId) {
			const currentCount = voteCounts.get(vote.candidateId) ?? 0;
			voteCounts.set(vote.candidateId, currentCount + 1);
		}
	}

	// Find the maximum vote count to determine winner(s)
	const maxVotes = Math.max(...Array.from(voteCounts.values()), 0);

	// Check for ties
	const winnersCount = Array.from(voteCounts.values()).filter(
		(count) => count === maxVotes && count > 0,
	).length;
	const hasTie = winnersCount > 1;

	// Build candidate results
	const candidateResults: CandidateResult[] = ballot.candidates.map(
		(candidate) => {
			const votes = voteCounts.get(candidate.id) ?? 0;
			const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
			const isWinner = votes === maxVotes && votes > 0;

			return {
				candidateId: candidate.id,
				name: candidate.name,
				votes,
				percentage: Math.round(percentage * 100) / 100, // Round to 2 decimal places
				isWinner,
				isTied: hasTie && isWinner,
			};
		},
	);

	// Sort by votes descending, then alphabetically by name
	candidateResults.sort((a, b) => {
		if (b.votes !== a.votes) {
			return b.votes - a.votes;
		}
		return a.name.localeCompare(b.name);
	});

	return {
		ballotId: ballot.id,
		ballotTitle: ballot.title,
		ballotType: ballot.type as "EXECUTIVE" | "DIRECTOR",
		college: ballot.college,
		totalVotes,
		candidates: candidateResults,
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
		if (vote.voteType === "YES") {
			yesVotes++;
		} else if (vote.voteType === "NO") {
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
