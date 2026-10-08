import type { Ballot, Candidate, Vote } from "@prisma/client";

import { getCanonicalCollege } from "@/lib/constants/colleges";
import {
	calculateRankedChoice,
	describeRound,
	type RankedVote,
	type TieBreakRule,
} from "./ranked-choice";

/** Minimal vote shape needed for results calculation (avoids loading full Vote in large elections) */
export type VoteForResults = Pick<Vote, "id" | "voteData">;

/** Withdrawn or disqualified; votes count for quorum only, not for candidate totals */
export type CandidateResultStatus = "ACTIVE" | "WITHDRAWN" | "DISQUALIFIED";

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
	/** When not ACTIVE, candidate is withdrawn/disqualified; votes are not shown, only count for quorum */
	status?: CandidateResultStatus;
	statusReason?: string | null;
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

/** A draw by lot recorded by the CRO (TieBreakDraw in schema.prisma) */
export interface TieBreakDrawForResults {
	kind: "EXCLUSION" | "SEAT";
	round: number;
	candidateIds: string[];
	selectedCandidateIds: string[];
}

/** How a tie was resolved */
export interface ResultTieBreak {
	kind: "EXCLUSION" | "SEAT";
	/** Instant-runoff round (0 for a multi-seat cutoff) */
	round: number;
	candidateIds: string[];
	/** EXCLUSION: the candidate excluded; SEAT: the candidates seated */
	selectedCandidateIds: string[];
	method: "PREVIOUS_COUNT" | "FIRST_CHOICES" | "LOT";
	/** PREVIOUS_COUNT: the earlier round whose counts decided it */
	decidedByRound?: number;
}

/** A tie no count separates: the CRO must decide it by lot */
export interface PendingTieBreak {
	kind: "EXCLUSION" | "SEAT";
	round: number;
	candidateIds: string[];
	/** How many of the tied candidates the draw selects */
	select: number;
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
	/** Total votes cast on this ballot (participation); used for display when same as counted */
	totalVotes: number;
	/** Votes counted toward the result (active candidates only, or YES+NO for referendum) */
	totalCountedVotes: number;
	eligibleVoters: number;
	/** Eligible voters who participated in the election (or in this college for college ballots) */
	participatedCount: number;
	quorumThreshold: number;
	hasReachedQuorum: boolean;
	quorumPercentage: number;
	candidates?: CandidateResult[];
	referendum?: ReferendumResult;
	rankedChoiceDetails?: RankedChoiceDetails; // Extra info for ranked choice
	/** Ties resolved while counting this ballot */
	tieBreaks?: ResultTieBreak[];
	/** Set when counting stopped on a tie the CRO must decide by lot */
	pendingTieBreak?: PendingTieBreak;
}

/** One entry for the public list of withdrawn/disqualified candidates */
export interface WithdrawalOrDisqualification {
	ballotId: string;
	ballotTitle: string;
	candidateId: string;
	candidateName: string;
	status: "WITHDRAWN" | "DISQUALIFIED";
	statusReason?: string | null;
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
	/** Withdrawn and disqualified candidates for display on public results */
	withdrawalsAndDisqualifications: WithdrawalOrDisqualification[];
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
	| "eligibleVoters"
	| "participatedCount"
	| "quorumThreshold"
	| "hasReachedQuorum"
	| "quorumPercentage"
>;

/**
 * Calculate results for a regular ballot (EXECUTIVE or DIRECTOR)
 * Now handles both single-candidate YES/NO/ABSTAIN and multi-candidate ranked choice
 */
export function calculateBallotResults(
	ballot: Ballot & {
		candidates: Candidate[];
		votes: VoteForResults[];
		tieBreakDraws?: TieBreakDrawForResults[];
	},
	rule: TieBreakRule = "AUSTRALIAN",
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

		const effectiveVotes = yesVotes + noVotes;
		const status =
			(candidate as Candidate & { status?: CandidateResultStatus }).status ??
			"ACTIVE";
		const isEligible = status === "ACTIVE";
		const candidateResult: CandidateResult = {
			candidateId: candidate.id,
			name: candidate.name,
			votes: isEligible ? yesVotes : 0,
			percentage:
				isEligible && effectiveVotes > 0
					? (yesVotes / effectiveVotes) * 100
					: 0,
			isWinner: isEligible && yesVotes > noVotes,
			isTied: isEligible && yesVotes === noVotes && effectiveVotes > 0,
			status,
			statusReason:
				(candidate as Candidate & { statusReason?: string | null })
					.statusReason ?? null,
		};

		return {
			ballotId: ballot.id,
			ballotTitle: ballot.title,
			ballotType: ballot.type as "EXECUTIVE" | "DIRECTOR",
			college: ballot.college,
			seatsAvailable: ballot.seatsAvailable,
			totalVotes,
			totalCountedVotes: effectiveVotes,
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

	const candidateList = ballot.candidates as Array<
		Candidate & { status?: CandidateResultStatus; statusReason?: string | null }
	>;
	const ineligibleCandidateIds = candidateList
		.filter((c) => c.status && c.status !== "ACTIVE")
		.map((c) => c.id);

	const isMultiSeat = ballot.seatsAvailable > 1;
	const draws = ballot.tieBreakDraws ?? [];
	const rankedResult = calculateRankedChoice(
		rankedVotes,
		ballot.candidates.map((c) => c.id),
		ineligibleCandidateIds,
		// Multi-seat ballots are decided by score below, not by instant runoff
		isMultiSeat
			? []
			: draws
					.filter((d) => d.kind === "EXCLUSION")
					.map((d) => ({
						round: d.round,
						candidateIds: d.candidateIds,
						excludedCandidateId: d.selectedCandidateIds[0] ?? "",
					})),
		rule,
	);

	const tieBreaks: ResultTieBreak[] = [];
	let pendingTieBreak: PendingTieBreak | undefined;
	if (!isMultiSeat) {
		for (const t of rankedResult.tieBreaks) {
			tieBreaks.push({
				kind: "EXCLUSION",
				round: t.round,
				candidateIds: t.candidateIds,
				selectedCandidateIds: [t.excluded],
				method: t.method,
				...(t.decidedByRound === undefined
					? {}
					: { decidedByRound: t.decidedByRound }),
			});
		}
		if (rankedResult.pendingLot) {
			pendingTieBreak = {
				kind: "EXCLUSION",
				round: rankedResult.pendingLot.round,
				candidateIds: rankedResult.pendingLot.candidateIds,
				select: 1,
			};
		}
	}
	const pendingIds = new Set(pendingTieBreak?.candidateIds ?? []);

	// Build candidate results from ranked choice results
	const candidateResults: CandidateResult[] = ballot.candidates.map(
		(candidate) => {
			const status: CandidateResultStatus =
				(candidate as Candidate & { status?: CandidateResultStatus }).status ??
				"ACTIVE";
			const statusReason =
				(candidate as Candidate & { statusReason?: string | null })
					.statusReason ?? null;
			// First round votes (0 for ineligible; they're pre-eliminated)
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
				isTied:
					pendingIds.has(candidate.id) || (rankedResult.isTie && isWinner),
				status,
				statusReason,
			};
		},
	);

	// For multi-seat elections, use first-choice voting instead of instant runoff
	// (Instant runoff is only designed for single-winner elections)
	if (ballot.seatsAvailable > 1) {
		// For multi-seat, calculate a score based on ranking positions (eligible candidates only)
		const candidateScores = new Map<string, number>();
		const ineligibleSet = new Set(ineligibleCandidateIds);
		const eligibleCount = ballot.candidates.length - ineligibleSet.size;

		for (const vote of rankedVotes) {
			// Build effective ranking: only eligible candidates, preserving order
			const eligibleRanking = vote.rankings.filter(
				(id) => !ineligibleSet.has(id),
			);
			// Give points: 1st eligible = eligibleCount pts, 2nd = eligibleCount-1, etc.
			for (let i = 0; i < eligibleRanking.length; i++) {
				const candidateId = eligibleRanking[i];
				if (candidateId) {
					const points = Math.max(0, eligibleCount - i);
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

		// Sort by score, then first-choice votes (names only order exact ties
		// for display; they never decide a seat)
		candidateResults.sort(
			(a, b) =>
				(b.score ?? 0) - (a.score ?? 0) ||
				b.votes - a.votes ||
				a.name.localeCompare(b.name),
		);

		// Clear any winner designation from instant runoff
		for (const candidate of candidateResults) {
			candidate.isWinner = false;
			candidate.isTied = false;
		}

		// Withdrawn/disqualified candidates can't win
		const eligibleResults = candidateResults.filter(
			(c) => c.status === "ACTIVE",
		);
		const seats = Math.min(ballot.seatsAvailable, eligibleResults.length);
		const cutoff = eligibleResults[seats - 1];
		if (rule === "LEGACY") {
			// Previous behaviour: top scorers win (ties fall to first choices,
			// then name), and candidates level on score at the cutoff are flagged
			for (const c of eligibleResults.slice(0, seats)) c.isWinner = true;
			const next = eligibleResults[seats];
			if (
				cutoff &&
				next &&
				next.score === cutoff.score &&
				(cutoff.score ?? 0) > 0
			) {
				for (const c of candidateResults) {
					if (c.score === cutoff.score) c.isTied = true;
				}
			}
		} else if (cutoff && rankedVotes.length > 0) {
			const level = (a: CandidateResult, b: CandidateResult) =>
				(a.score ?? 0) === (b.score ?? 0) && a.votes === b.votes;
			// Candidates level with the last seat on both score and first choices
			const tied = eligibleResults.filter((c) => level(c, cutoff));
			const ahead = eligibleResults.slice(
				0,
				eligibleResults.findIndex((c) => level(c, cutoff)),
			);
			const seatsLeft = seats - ahead.length;
			for (const c of ahead) c.isWinner = true;

			if (tied.length <= seatsLeft) {
				for (const c of tied) c.isWinner = true;
			} else {
				const tiedIds = tied.map((c) => c.candidateId).sort();
				const draw = draws.find(
					(d) =>
						d.kind === "SEAT" &&
						d.candidateIds.length === tiedIds.length &&
						[...d.candidateIds].sort().every((id, i) => id === tiedIds[i]) &&
						d.selectedCandidateIds.length === seatsLeft &&
						d.selectedCandidateIds.every((id) => tiedIds.includes(id)),
				);
				if (draw) {
					for (const c of tied) {
						c.isWinner = draw.selectedCandidateIds.includes(c.candidateId);
					}
					tieBreaks.push({
						kind: "SEAT",
						round: 0,
						candidateIds: tiedIds,
						selectedCandidateIds: [...draw.selectedCandidateIds].sort(),
						method: "LOT",
					});
				} else {
					// Tied on score and first choices: the CRO decides by lot
					for (const c of tied) c.isTied = true;
					pendingTieBreak = {
						kind: "SEAT",
						round: 0,
						candidateIds: tiedIds,
						select: seatsLeft,
					};
				}
			}

			// Record seats decided by first choices between candidates level on
			// score (not those seated by a draw)
			const lotGroup = tied.length > seatsLeft ? tied : [];
			const sameScore = eligibleResults.filter(
				(c) => (c.score ?? 0) === (cutoff.score ?? 0),
			);
			const seatedByFirstChoices = sameScore.filter(
				(c) => c.isWinner && !lotGroup.includes(c),
			);
			const notSeatedByFirstChoices = sameScore.filter(
				(c) => !seatedByFirstChoices.includes(c),
			);
			if (
				seatedByFirstChoices.length > 0 &&
				notSeatedByFirstChoices.length > 0
			) {
				tieBreaks.push({
					kind: "SEAT",
					round: 0,
					candidateIds: sameScore.map((c) => c.candidateId).sort(),
					selectedCandidateIds: seatedByFirstChoices
						.map((c) => c.candidateId)
						.sort(),
					method: "FIRST_CHOICES",
				});
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
		description: rankedResult.rounds.map((round) => {
			const text = describeRound(round, candidateNames);
			if (isMultiSeat) return text;
			const names = (ids: string[]) =>
				ids.map((id) => candidateNames.get(id) ?? "Unknown").join(", ");
			if (
				pendingTieBreak?.kind === "EXCLUSION" &&
				pendingTieBreak.round === round.round
			) {
				return `${text.replace(" (Final)", "")}. Tied for exclusion: ${names(pendingTieBreak.candidateIds)}, to be decided by lot`;
			}
			const tie = tieBreaks.find((t) => t.round === round.round);
			if (!tie) return text;
			const reason =
				tie.method === "LOT"
					? "decided by lot"
					: `fewer votes in round ${tie.decidedByRound}`;
			return `${text} (tied with ${names(tie.candidateIds.filter((id) => id !== round.eliminated))}; ${reason})`;
		}),
	};

	const totalCountedVotes = candidateResults
		.filter((c) => c.status === "ACTIVE" || !c.status)
		.reduce((sum, c) => sum + c.votes, 0);

	return {
		ballotId: ballot.id,
		ballotTitle: ballot.title,
		ballotType: ballot.type as "EXECUTIVE" | "DIRECTOR",
		college: ballot.college,
		seatsAvailable: ballot.seatsAvailable,
		totalVotes,
		totalCountedVotes,
		candidates: candidateResults,
		// Multi-seat ballots are decided by score, so instant-runoff rounds
		// would be misleading
		...(isMultiSeat ? {} : { rankedChoiceDetails }),
		tieBreaks,
		...(pendingTieBreak ? { pendingTieBreak } : {}),
	};
}

/**
 * Calculate results for a referendum ballot
 */
export function calculateReferendumResults(
	ballot: Ballot & { votes: VoteForResults[] },
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

	const effectiveVotes = yesVotes + noVotes;
	const yesPercentage =
		effectiveVotes > 0 ? (yesVotes / effectiveVotes) * 100 : 0;
	const noPercentage =
		effectiveVotes > 0 ? (noVotes / effectiveVotes) * 100 : 0;

	const referendum: ReferendumResult = {
		yes: yesVotes,
		no: noVotes,
		yesPercentage: Math.round(yesPercentage * 100) / 100,
		noPercentage: Math.round(noPercentage * 100) / 100,
		totalVotes,
		passed: yesVotes > noVotes,
		isTied: yesVotes === noVotes && effectiveVotes > 0,
	};

	const totalCountedVotes = yesVotes + noVotes;

	return {
		ballotId: ballot.id,
		ballotTitle: ballot.title,
		ballotType: "REFERENDUM",
		college: ballot.college,
		seatsAvailable: ballot.seatsAvailable,
		totalVotes,
		totalCountedVotes,
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
		tieBreakRule?: TieBreakRule;
	},
	ballots: (Ballot & {
		candidates: Candidate[];
		votes: VoteForResults[];
		tieBreakDraws?: TieBreakDrawForResults[];
	})[],
	eligibleVotersCount: number,
	votedCount: number,
	quorumSettings?: {
		executiveQuorum: number;
		directorQuorum: number;
		referendumQuorum: number;
	},
	collegeEligibleVoters?: Map<string, number>,
	collegeVotedCount?: Map<string, number>,
): ElectionResults {
	// Default quorum settings if not provided
	const settings = quorumSettings ?? {
		executiveQuorum: 10,
		directorQuorum: 10,
		referendumQuorum: 20,
	};

	const ballotResults: BallotResult[] = ballots.map((ballot) => {
		// Calculate eligible voters for this ballot (canonical lookup to match admin/results)
		const eligibleForBallot = ballot.college
			? (collegeEligibleVoters?.get(
					getCanonicalCollege(ballot.college) ?? ballot.college,
				) ?? 0)
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
		// Quorum is based on turnout (eligible voters who participated), not votes on this ballot.
		// Votes for withdrawn/disqualified candidates still count toward quorum (the voter participated).
		// REFERENDUM: same as exec—overall (or college) turnout. Director: college turnout.
		const participatedCount = ballot.college
			? (collegeVotedCount?.get(
					getCanonicalCollege(ballot.college) ?? ballot.college,
				) ?? 0)
			: votedCount;
		const hasReachedQuorum =
			eligibleForBallot > 0 && participatedCount >= quorumThreshold;

		if (ballot.type === "REFERENDUM") {
			return {
				...calculateReferendumResults(ballot),
				eligibleVoters: eligibleForBallot,
				participatedCount,
				quorumThreshold,
				hasReachedQuorum,
				quorumPercentage,
			};
		}
		return {
			...calculateBallotResults(ballot, election.tieBreakRule),
			eligibleVoters: eligibleForBallot,
			participatedCount,
			quorumThreshold,
			hasReachedQuorum,
			quorumPercentage,
		};
	});

	const turnoutPercentage =
		eligibleVotersCount > 0 ? (votedCount / eligibleVotersCount) * 100 : 0;

	const withdrawalsAndDisqualifications: WithdrawalOrDisqualification[] = [];
	for (const ballot of ballotResults) {
		if (ballot.candidates) {
			for (const c of ballot.candidates) {
				if (c.status === "WITHDRAWN" || c.status === "DISQUALIFIED") {
					withdrawalsAndDisqualifications.push({
						ballotId: ballot.ballotId,
						ballotTitle: ballot.ballotTitle,
						candidateId: c.candidateId,
						candidateName: c.name,
						status: c.status,
						statusReason: c.statusReason ?? null,
					});
				}
			}
		}
	}

	return {
		electionId: election.id,
		electionName: election.name,
		totalEligibleVoters: eligibleVotersCount,
		totalVoted: votedCount,
		turnoutPercentage: Math.round(turnoutPercentage * 100) / 100,
		ballots: ballotResults,
		withdrawalsAndDisqualifications,
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
