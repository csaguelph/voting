import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { generateVoteHash } from "@/lib/voting/hash";
import {
	VoteErrorCode,
	checkVoterEligibility,
	getEligibleBallots,
} from "@/lib/voting/validator";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

/**
 * Vote router
 * Handles vote casting, eligibility checking, and receipt generation
 */
export const voteRouter = createTRPCRouter({
	/**
	 * Check if the current user is eligible to vote in an election
	 */
	checkEligibility: protectedProcedure
		.input(z.object({ electionId: z.string() }))
		.query(async ({ ctx, input }) => {
			const userEmail = ctx.session.user.email;
			if (!userEmail) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "User email not found",
				});
			}

			const { eligible, voter, error } = await checkVoterEligibility(
				ctx.db,
				input.electionId,
				userEmail,
			);

			if (!eligible) {
				return {
					eligible: false,
					reason: error?.message,
					errorCode: error?.code,
					hasVoted: voter?.hasVoted ?? false,
					votedAt: voter?.votedAt ?? null,
				};
			}

			if (!voter) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Voter record not found after eligibility check",
				});
			}

			// Get ballots the voter is eligible for
			const ballots = await getEligibleBallots(
				ctx.db,
				input.electionId,
				voter.college,
			);

			return {
				eligible: true,
				voter: {
					id: voter.id,
					email: voter.email,
					firstName: voter.firstName,
					lastName: voter.lastName,
					college: voter.college,
					studentId: voter.studentId,
				},
				ballots: ballots.map((ballot) => ({
					id: ballot.id,
					title: ballot.title,
					type: ballot.type,
					college: ballot.college,
					seatsAvailable: ballot.seatsAvailable,
					preamble: ballot.preamble,
					question: ballot.question,
					sponsor: ballot.sponsor,
					candidates: ballot.candidates.map((c) => ({
						id: c.id,
						name: c.name,
						statement: c.statement,
					})),
				})),
			};
		}),

	/**
	 * Get eligible ballots for a specific election
	 * (Separate from eligibility check for convenience)
	 */
	getBallots: protectedProcedure
		.input(z.object({ electionId: z.string() }))
		.query(async ({ ctx, input }) => {
			const userEmail = ctx.session.user.email;
			if (!userEmail) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "User email not found",
				});
			}

			// Check eligibility first
			const { eligible, voter, error } = await checkVoterEligibility(
				ctx.db,
				input.electionId,
				userEmail,
			);

			if (!eligible || !voter) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: error?.message ?? "Not eligible to vote",
				});
			}

			const ballots = await getEligibleBallots(
				ctx.db,
				input.electionId,
				voter.college,
			);

			return ballots;
		}),

	/**
	 * Cast votes for an election (atomic transaction)
	 * All votes must be valid or none are recorded
	 */
	castVotes: protectedProcedure
		.input(
			z.object({
				electionId: z.string(),
				votes: z.array(
					z.object({
						ballotId: z.string(),
						voteData: z.union([
							z.object({ type: z.literal("YES") }),
							z.object({ type: z.literal("NO") }),
							z.object({ type: z.literal("ABSTAIN") }),
							z.object({
								type: z.literal("RANKED"),
								rankings: z.array(z.string()),
							}),
						]),
					}),
				),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const voterEmail = ctx.session.user.email;
			if (!voterEmail) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "User email not found",
				});
			}

			const now = new Date();

			// Step 1: Check eligibility
			const {
				eligible,
				voter,
				error: eligibilityError,
			} = await checkVoterEligibility(ctx.db, input.electionId, voterEmail);

			if (!eligible || !voter) {
				throw new TRPCError({
					code:
						eligibilityError?.code === VoteErrorCode.ALREADY_VOTED
							? "CONFLICT"
							: "FORBIDDEN",
					message:
						eligibilityError?.message ??
						"Not eligible to vote in this election",
				});
			}

			// Step 2: Validate all votes (TODO: Update validator for new format)
			// For now, basic validation
			if (input.votes.length === 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "No votes provided",
				});
			}

			// Step 3: Cast all votes in an atomic transaction
			try {
				const voteRecords = await ctx.db.$transaction(async (tx) => {
					const createdVotes: Array<{
						ballotId: string;
						voteData: unknown;
						voteHash: string;
						timestamp: Date;
					}> = [];

					// Create vote records with hashes
					for (const vote of input.votes) {
						// Generate vote hash (deterministic, no salt)
						const voteHash = generateVoteHash({
							electionId: input.electionId,
							ballotId: vote.ballotId,
							voteData: vote.voteData,
							voterId: voter.studentId, // Use student ID for consistency
							timestamp: now,
						});

						// Create vote record
						const createdVote = await tx.vote.create({
							data: {
								electionId: input.electionId,
								ballotId: vote.ballotId,
								voteData: vote.voteData,
								voteHash,
								timestamp: now,
							},
						});

						createdVotes.push({
							ballotId: vote.ballotId,
							voteData: vote.voteData,
							voteHash,
							timestamp: now,
						});
					}

					// Mark voter as having voted
					await tx.eligibleVoter.update({
						where: { id: voter.id },
						data: {
							hasVoted: true,
							votedAt: now,
						},
					});

					// Create audit log entry
					await tx.auditLog.create({
						data: {
							electionId: input.electionId,
							action: "votes.cast",
							details: {
								voterId: voter.id,
								voterEmail: voterEmail,
								voterStudentId: voter.studentId,
								ballotCount: input.votes.length,
								timestamp: now.toISOString(),
								// Don't log which candidates were voted for (privacy)
								ballotIds: input.votes.map((v) => v.ballotId),
							},
						},
					});

					return createdVotes;
				});

				return {
					success: true,
					voteCount: voteRecords.length,
					votes: voteRecords.map((v) => ({
						ballotId: v.ballotId,
						voteHash: v.voteHash,
						timestamp: v.timestamp,
					})),
					votedAt: now,
				};
			} catch (error) {
				// If transaction fails, throw error
				console.error("Vote casting failed:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to cast votes. Please try again.",
				});
			}
		}),

	/**
	 * Get vote receipt for a voter
	 * Shows verification hashes for all votes cast
	 */
	getReceipt: protectedProcedure
		.input(z.object({ electionId: z.string() }))
		.query(async ({ ctx, input }) => {
			const voterEmail = ctx.session.user.email;
			if (!voterEmail) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "User email not found",
				});
			}

			// Get voter record
			const voter = await ctx.db.eligibleVoter.findUnique({
				where: {
					electionId_email: {
						electionId: input.electionId,
						email: voterEmail,
					},
				},
				include: {
					election: true,
				},
			});

			if (!voter) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Voter record not found",
				});
			}

			if (!voter.hasVoted) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "You have not voted in this election yet",
				});
			}

			// We can't directly link votes to voters (privacy)
			// So we just return the voter's voting timestamp
			// The actual verification hashes are returned when votes are cast
			return {
				election: {
					id: voter.election.id,
					name: voter.election.name,
				},
				voter: {
					firstName: voter.firstName,
					lastName: voter.lastName,
					email: voter.email,
					studentId: voter.studentId,
				},
				votedAt: voter.votedAt,
				hasVoted: voter.hasVoted,
			};
		}),

	/**
	 * Get voting status for current user across all elections
	 */
	getVotingStatus: protectedProcedure.query(async ({ ctx }) => {
		const voterEmail = ctx.session.user.email;
		if (!voterEmail) {
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "User email not found",
			});
		}

		const eligibleVoters = await ctx.db.eligibleVoter.findMany({
			where: {
				email: voterEmail,
			},
			include: {
				election: {
					select: {
						id: true,
						name: true,
						startTime: true,
						endTime: true,
						isActive: true,
					},
				},
			},
			orderBy: {
				election: {
					startTime: "desc",
				},
			},
		});

		return eligibleVoters.map((voter) => ({
			election: voter.election,
			hasVoted: voter.hasVoted,
			votedAt: voter.votedAt,
			eligible: true,
		}));
	}),
});
