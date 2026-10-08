import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { AuditAction, logAudit } from "@/lib/audit/logger";
import { getCanonicalCollege } from "@/lib/constants/colleges";
import { reportInput } from "@/lib/reports";
import { generateVoteHash } from "@/lib/voting/hash";
import {
	IDENTITY_LOCKOUT_MS,
	identityLockedUntil,
	isIdentityConfirmed,
	MAX_IDENTITY_ATTEMPTS,
	studentIdsMatch,
} from "@/lib/voting/identity";
import {
	checkVoterEligibility,
	getEligibleBallots,
	VoteErrorCode,
	validateBallotSelections,
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
			const voterCollegeCanonical =
				getCanonicalCollege(voter.college) ?? voter.college;
			const ballots = await getEligibleBallots(
				ctx.db,
				input.electionId,
				voterCollegeCanonical,
			);

			const now = new Date();
			return {
				eligible: true,
				// The student ID is never sent to the browser: voters must type it
				// to open their ballot
				voter: {
					id: voter.id,
					email: voter.email,
					firstName: voter.firstName,
					lastName: voter.lastName,
					college: voter.college,
				},
				identity: {
					confirmed: isIdentityConfirmed(voter, now),
					lockedUntil: identityLockedUntil(voter, now),
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
	 * Confirm the voter's identity by having them re-enter their student ID
	 * before the ballot opens. Too many wrong entries lock the ballot for a
	 * while, and each one is audit-logged for the CRO.
	 */
	confirmIdentity: protectedProcedure
		.input(
			z.object({
				electionId: z.string(),
				studentId: z.string().max(64),
			}),
		)
		.mutation(async ({ ctx, input }) => {
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
			if (!eligible || !voter) {
				throw new TRPCError({
					code:
						error?.code === VoteErrorCode.ALREADY_VOTED
							? "CONFLICT"
							: "FORBIDDEN",
					message: error?.message ?? "Not eligible to vote in this election",
				});
			}

			const now = new Date();
			const lockedUntil = identityLockedUntil(voter, now);
			if (lockedUntil) {
				return { status: "locked" as const, lockedUntil };
			}

			if (studentIdsMatch(input.studentId, voter.studentId)) {
				await ctx.db.eligibleVoter.update({
					where: { id: voter.id },
					data: {
						identityConfirmedAt: now,
						identityCheckFailures: 0,
						identityLockedUntil: null,
					},
				});
				return { status: "confirmed" as const };
			}

			// Count atomically, so parallel guesses can't exceed the limit
			const { identityCheckFailures: failures } =
				await ctx.db.eligibleVoter.update({
					where: { id: voter.id },
					data: { identityCheckFailures: { increment: 1 } },
					select: { identityCheckFailures: true },
				});
			const audit = {
				electionId: input.electionId,
				userId: ctx.session.user.id,
				userEmail,
				userRole: ctx.session.user.role,
			};

			if (failures >= MAX_IDENTITY_ATTEMPTS) {
				const until = new Date(now.getTime() + IDENTITY_LOCKOUT_MS);
				await ctx.db.eligibleVoter.update({
					where: { id: voter.id },
					data: {
						identityLockedUntil: until,
						identityCheckFailures: 0,
						identityConfirmedAt: null,
					},
				});
				await logAudit(ctx.db, {
					...audit,
					action: AuditAction.VOTER_IDENTITY_LOCKED,
					details: { voterId: voter.id, lockedUntil: until.toISOString() },
				});
				return { status: "locked" as const, lockedUntil: until };
			}

			// The ID that was typed isn't logged: it may be another student's
			await logAudit(ctx.db, {
				...audit,
				action: AuditAction.VOTER_IDENTITY_FAILED,
				details: { voterId: voter.id, attempt: failures },
			});
			return {
				status: "incorrect" as const,
				attemptsLeft: MAX_IDENTITY_ATTEMPTS - failures,
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

			const voterCollegeCanonical =
				getCanonicalCollege(voter.college) ?? voter.college;
			const ballots = await getEligibleBallots(
				ctx.db,
				input.electionId,
				voterCollegeCanonical,
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
				// The voter can report this ballot to the CRO as they submit it
				report: reportInput.optional(),
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

			// Step 2: The voter must have re-entered their student ID recently
			if (!isIdentityConfirmed(voter, now)) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message:
						"Please confirm your student ID again before submitting your votes.",
				});
			}

			// Step 3: Validate the submission against the voter's eligible ballots
			if (input.votes.length === 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "No votes provided",
				});
			}

			const invalid = await validateBallotSelections(
				ctx.db,
				input.electionId,
				getCanonicalCollege(voter.college) ?? voter.college,
				input.votes,
			);
			if (invalid) {
				throw new TRPCError({ code: "BAD_REQUEST", message: invalid.message });
			}

			// Step 4: Cast all votes in an atomic transaction
			try {
				const voteRecords = await ctx.db.$transaction(async (tx) => {
					// Hold a share lock on the election while recording, so publishing
					// its Merkle tree (which takes an exclusive lock) waits for votes
					// already in progress. If the tree was published while this
					// request was in flight, voting has closed.
					const [election] = await tx.$queryRaw<
						{ merkleRoot: string | null }[]
					>`SELECT "merkleRoot" FROM elections WHERE id = ${input.electionId} FOR SHARE`;
					if (election?.merkleRoot) {
						throw new TRPCError({
							code: "FORBIDDEN",
							message: "This election has ended",
						});
					}

					// Claim the voter's single vote first. The eligibility check above
					// ran outside this transaction, so concurrent submissions can all
					// pass it; this conditional update lets only one of them through
					// (the others wait on the row lock, then match nothing).
					const claimed = await tx.eligibleVoter.updateMany({
						where: { id: voter.id, hasVoted: false },
						data: {
							hasVoted: true,
							votedAt: now,
						},
					});
					if (claimed.count === 0) {
						throw new TRPCError({
							code: "CONFLICT",
							message: "You have already voted in this election",
						});
					}

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
						await tx.vote.create({
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

					if (input.report) {
						// Not audit-logged: next to the votes.cast entry, it would tell
						// admins who reported. Only the CRO may know that.
						await tx.voterReport.create({
							data: {
								electionId: input.electionId,
								voterId: voter.id,
								voterName: `${voter.firstName} ${voter.lastName}`,
								voterEmail: voter.email,
								reason: input.report.reason,
								details: input.report.details,
								source: "SUBMISSION",
							},
						});
					}

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
					reported: Boolean(input.report),
				};
			} catch (error) {
				if (error instanceof TRPCError) throw error;
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
