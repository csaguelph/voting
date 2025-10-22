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

	// Check election status
	const now = new Date();
	const election = voter.election;

	if (!election.isActive) {
		return {
			eligible: false,
			voter,
			error: new VoteValidationError(
				"This election is not currently active",
				VoteErrorCode.ELECTION_NOT_ACTIVE,
			),
		};
	}

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

/**
 * Validate a set of votes before casting
 */
export async function validateVotes(
	db: PrismaClient,
	electionId: string,
	voterEmail: string,
	voterCollege: string,
	votes: Array<{ ballotId: string; candidateId: string }>,
): Promise<{
	valid: boolean;
	error?: VoteValidationError;
}> {
	// Get all ballots for the election
	const ballots = await db.ballot.findMany({
		where: { electionId },
		include: {
			candidates: true,
		},
	});

	// Check if all required ballots have votes
	const ballotIds = new Set(votes.map((v) => v.ballotId));

	// Check for duplicate ballot votes
	if (ballotIds.size !== votes.length) {
		return {
			valid: false,
			error: new VoteValidationError(
				"You cannot vote on the same ballot twice",
				VoteErrorCode.DUPLICATE_BALLOT,
			),
		};
	}

	// Validate each vote
	for (const vote of votes) {
		const ballot = ballots.find((b) => b.id === vote.ballotId);

		if (!ballot) {
			return {
				valid: false,
				error: new VoteValidationError(
					`Ballot ${vote.ballotId} not found`,
					VoteErrorCode.BALLOT_NOT_FOUND,
				),
			};
		}

		// Check college restriction for DIRECTOR ballots
		if (ballot.type === "DIRECTOR" && ballot.college !== voterCollege) {
			return {
				valid: false,
				error: new VoteValidationError(
					`You are not eligible to vote on the ${ballot.title} ballot (${ballot.college} only)`,
					VoteErrorCode.INVALID_COLLEGE,
				),
			};
		}

		// For REFERENDUM ballots, candidateId should be "YES" or "NO"
		if (ballot.type === "REFERENDUM") {
			if (vote.candidateId !== "YES" && vote.candidateId !== "NO") {
				return {
					valid: false,
					error: new VoteValidationError(
						"Invalid referendum response: must be YES or NO",
						VoteErrorCode.CANDIDATE_NOT_FOUND,
					),
				};
			}
		} else {
			// For regular ballots, check if candidate exists
			const candidate = ballot.candidates.find(
				(c) => c.id === vote.candidateId,
			);

			if (!candidate) {
				return {
					valid: false,
					error: new VoteValidationError(
						`Candidate ${vote.candidateId} not found on ballot ${ballot.title}`,
						VoteErrorCode.CANDIDATE_NOT_FOUND,
					),
				};
			}
		}
	}

	return { valid: true };
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
