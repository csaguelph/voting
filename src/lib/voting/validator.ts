import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Validation errors for voting
 */
export class VoteValidationError extends Error {
	constructor(
		message: string,
		public code: VoteErrorCode,
	) {
		super(message);
		this.name = "VoteValidationError";
	}
}

export enum VoteErrorCode {
	NOT_ELIGIBLE = "NOT_ELIGIBLE",
	ALREADY_VOTED = "ALREADY_VOTED",
	ELECTION_NOT_ACTIVE = "ELECTION_NOT_ACTIVE",
	ELECTION_NOT_STARTED = "ELECTION_NOT_STARTED",
	ELECTION_ENDED = "ELECTION_ENDED",
	BALLOT_NOT_FOUND = "BALLOT_NOT_FOUND",
	CANDIDATE_NOT_FOUND = "CANDIDATE_NOT_FOUND",
	INVALID_COLLEGE = "INVALID_COLLEGE",
	MISSING_BALLOTS = "MISSING_BALLOTS",
	DUPLICATE_BALLOT = "DUPLICATE_BALLOT",
	INVALID_VOTE = "INVALID_VOTE",
}

/**
 * Check if a voter is eligible for an election
 */
export async function checkVoterEligibility(
	db: PrismaClient,
	electionId: string,
	voterEmail: string,
): Promise<{
	eligible: boolean;
	voter?: Prisma.EligibleVoterGetPayload<{ include: { election: true } }>;
	error?: VoteValidationError;
}> {
	// Find the voter record
	const voter = await db.eligibleVoter.findUnique({
		where: {
			electionId_email: {
				electionId,
				email: voterEmail,
			},
		},
		include: {
			election: true,
		},
	});

	// Not registered for this election
	if (!voter) {
		return {
			eligible: false,
			error: new VoteValidationError(
				"You are not registered to vote in this election",
				VoteErrorCode.NOT_ELIGIBLE,
			),
		};
	}

	// Already voted
	if (voter.hasVoted) {
		return {
			eligible: false,
			voter,
			error: new VoteValidationError(
				"You have already voted in this election",
				VoteErrorCode.ALREADY_VOTED,
			),
		};
	}

	// Check election time window
	const now = new Date();
	const election = voter.election;

	if (now < election.startTime) {
		return {
			eligible: false,
			voter,
			error: new VoteValidationError(
				"This election has not started yet",
				VoteErrorCode.ELECTION_NOT_STARTED,
			),
		};
	}

	if (now > election.endTime) {
		return {
			eligible: false,
			voter,
			error: new VoteValidationError(
				"This election has ended",
				VoteErrorCode.ELECTION_ENDED,
			),
		};
	}

	return {
		eligible: true,
		voter,
	};
}

export type CastVoteData =
	| { type: "YES" }
	| { type: "NO" }
	| { type: "ABSTAIN" }
	| { type: "RANKED"; rankings: string[] };

/**
 * Check that a submission only votes on ballots this voter may vote on, at
 * most once each, with a vote of the right kind for each ballot:
 * - any ballot accepts ABSTAIN
 * - referendums and single-candidate ballots accept YES or NO
 * - multi-candidate ballots accept a ranking of that ballot's candidates,
 *   with no repeats (withdrawn candidates may be ranked; counting skips them)
 *
 * Skipping ballots is allowed. Returns the first problem found, or null.
 */
export async function validateBallotSelections(
	db: PrismaClient,
	electionId: string,
	voterCollege: string,
	votes: Array<{ ballotId: string; voteData: CastVoteData }>,
): Promise<VoteValidationError | null> {
	const eligibleBallots = await getEligibleBallots(
		db,
		electionId,
		voterCollege,
	);
	const ballotsById = new Map(eligibleBallots.map((b) => [b.id, b]));
	const seen = new Set<string>();

	for (const { ballotId, voteData } of votes) {
		const ballot = ballotsById.get(ballotId);
		if (!ballot) {
			return new VoteValidationError(
				"One of these ballots isn't available to you in this election",
				VoteErrorCode.BALLOT_NOT_FOUND,
			);
		}
		if (seen.has(ballotId)) {
			return new VoteValidationError(
				`"${ballot.title}" was voted on more than once`,
				VoteErrorCode.DUPLICATE_BALLOT,
			);
		}
		seen.add(ballotId);

		if (voteData.type === "ABSTAIN") continue;

		const isYesNo =
			ballot.type === "REFERENDUM" || ballot.candidates.length === 1;
		if (voteData.type === "YES" || voteData.type === "NO") {
			if (!isYesNo) {
				return new VoteValidationError(
					`"${ballot.title}" needs a ranking, not a YES/NO vote`,
					VoteErrorCode.INVALID_VOTE,
				);
			}
			continue;
		}

		// RANKED
		if (isYesNo || ballot.candidates.length === 0) {
			return new VoteValidationError(
				`"${ballot.title}" doesn't accept a ranking`,
				VoteErrorCode.INVALID_VOTE,
			);
		}
		if (voteData.rankings.length === 0) {
			return new VoteValidationError(
				`Rank at least one candidate on "${ballot.title}", or abstain`,
				VoteErrorCode.INVALID_VOTE,
			);
		}
		const candidateIds = new Set(ballot.candidates.map((c) => c.id));
		if (!voteData.rankings.every((id) => candidateIds.has(id))) {
			return new VoteValidationError(
				`A ranked candidate isn't on "${ballot.title}"`,
				VoteErrorCode.CANDIDATE_NOT_FOUND,
			);
		}
		if (new Set(voteData.rankings).size !== voteData.rankings.length) {
			return new VoteValidationError(
				`A candidate was ranked more than once on "${ballot.title}"`,
				VoteErrorCode.INVALID_VOTE,
			);
		}
	}

	return null;
}

/**
 * Get eligible ballots for a voter
 */
export async function getEligibleBallots(
	db: PrismaClient,
	electionId: string,
	voterCollege: string,
) {
	const ballots = await db.ballot.findMany({
		where: {
			electionId,
			OR: [
				{ type: "EXECUTIVE" }, // Everyone can vote on executive
				{ type: "REFERENDUM" }, // Everyone can vote on referendums
				{ type: "DIRECTOR", college: voterCollege }, // Only your college for directors
			],
		},
		include: {
			candidates: {
				orderBy: { createdAt: "asc" },
			},
		},
		orderBy: [
			{ type: "asc" }, // EXECUTIVE first, then DIRECTOR, then REFERENDUM
			{ createdAt: "asc" },
		],
	});

	return ballots;
}
