import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { hashStudentId } from "@/lib/voting/hash";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

/**
 * Admin router
 * Handles admin-only operations like voter imports
 * All procedures require ADMIN or CRO role
 */

// Input schema for bulk voter import
const voterImportSchema = z.object({
	electionId: z.string(),
	voters: z.array(
		z.object({
			studentId: z.string(),
			firstName: z.string(),
			lastName: z.string(),
			email: z.string().email(),
			college: z.string(),
		}),
	),
	// Allow replacing existing voters
	replaceExisting: z.boolean().default(false),
});

export const adminRouter = createTRPCRouter({
	/**
	 * Create a new election
	 */
	createElection: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1),
				description: z.string().optional(),
				startTime: z.date(),
				endTime: z.date(),
				isActive: z.boolean().default(false),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Check if user is admin or CRO
			const userRole = ctx.session.user.role;
			if (userRole !== "ADMIN" && userRole !== "CRO") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only admins and CROs can create elections",
				});
			}

			// Validate dates
			if (input.endTime <= input.startTime) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "End time must be after start time",
				});
			}

			const election = await ctx.db.election.create({
				data: {
					name: input.name,
					description: input.description,
					startTime: input.startTime,
					endTime: input.endTime,
					isActive: input.isActive,
				},
			});

			// Create audit log
			await ctx.db.auditLog.create({
				data: {
					action: "ELECTION_CREATE",
					electionId: election.id,
					details: {
						performedBy: ctx.session.user.id,
						performedByEmail: ctx.session.user.email,
						electionName: election.name,
					},
				},
			});

			return election;
		}),

	/**
	 * Update an election
	 */
	updateElection: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).optional(),
				description: z.string().optional(),
				startTime: z.date().optional(),
				endTime: z.date().optional(),
				isActive: z.boolean().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Check if user is admin or CRO
			const userRole = ctx.session.user.role;
			if (userRole !== "ADMIN" && userRole !== "CRO") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only admins and CROs can update elections",
				});
			}

			const { id, ...data } = input;

			const election = await ctx.db.election.update({
				where: { id },
				data,
			});

			return election;
		}),

	/**
	 * Delete an election
	 */
	deleteElection: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Check if user is admin or CRO
			const userRole = ctx.session.user.role;
			if (userRole !== "ADMIN" && userRole !== "CRO") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only admins and CROs can delete elections",
				});
			}

			await ctx.db.election.delete({
				where: { id: input.id },
			});

			return { success: true };
		}),

	/**
	 * Get all elections (admin view)
	 */
	getAllElections: protectedProcedure.query(async ({ ctx }) => {
		// Check if user is admin or CRO
		const userRole = ctx.session.user.role;
		if (userRole !== "ADMIN" && userRole !== "CRO") {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "Only admins and CROs can view all elections",
			});
		}

		return ctx.db.election.findMany({
			orderBy: { startTime: "desc" },
			include: {
				_count: {
					select: {
						ballots: true,
						votes: true,
						eligibleVoters: true,
					},
				},
			},
		});
	}),

	/**
	 * Bulk import voters for an election
	 * Optimized for large datasets (30,000+ rows)
	 * Uses batch processing and transactions
	 */
	importVoters: protectedProcedure
		.input(voterImportSchema)
		.mutation(async ({ ctx, input }) => {
			// Check if user is admin or CRO
			const userRole = ctx.session.user.role;
			if (userRole !== "ADMIN" && userRole !== "CRO") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only admins and CROs can import voters",
				});
			}

			// Verify election exists
			const election = await ctx.db.election.findUnique({
				where: { id: input.electionId },
			});

			if (!election) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Election not found",
				});
			}

			// If replace mode, delete existing voters first
			if (input.replaceExisting) {
				await ctx.db.eligibleVoter.deleteMany({
					where: { electionId: input.electionId },
				});
			}

			// Process in batches for large datasets
			const BATCH_SIZE = 1000; // Prisma recommends 1000-2000 for createMany
			const batches: (typeof input.voters)[] = [];

			for (let i = 0; i < input.voters.length; i += BATCH_SIZE) {
				batches.push(input.voters.slice(i, i + BATCH_SIZE));
			}

			let successCount = 0;
			const errors: Array<{ studentId: string; error: string }> = [];

			// Process batches sequentially (not in a transaction) to avoid Prisma Accelerate timeout limits
			for (const batch of batches) {
				try {
					const result = await ctx.db.eligibleVoter.createMany({
						data: batch.map((voter) => ({
							electionId: input.electionId,
							studentId: voter.studentId,
							studentIdHash: hashStudentId(voter.studentId),
							firstName: voter.firstName,
							lastName: voter.lastName,
							email: voter.email.toLowerCase(), // Normalize email
							college: voter.college,
						})),
						skipDuplicates: !input.replaceExisting, // Skip if not replacing
					});
					successCount += result.count;
				} catch (error) {
					// Log batch errors but continue
					console.error("Batch insert error:", error);
					// If a batch fails, record which voters failed
					for (const voter of batch) {
						errors.push({
							studentId: voter.studentId,
							error: "Database insert failed",
						});
					}
				}
			}

			// Create audit log entry separately
			await ctx.db.auditLog.create({
				data: {
					action: "VOTER_IMPORT",
					electionId: input.electionId,
					details: {
						performedBy: ctx.session.user.id,
						performedByEmail: ctx.session.user.email,
						voterCount: successCount,
						batchCount: batches.length,
						replaceMode: input.replaceExisting,
						errorCount: errors.length,
					},
				},
			});

			return {
				success: true,
				imported: successCount,
				total: input.voters.length,
				errors: errors.length > 0 ? errors.slice(0, 100) : [], // Return first 100 errors
			};
		}),

	/**
	 * Get all voters for an election
	 * Paginated for large datasets
	 */
	getVoters: protectedProcedure
		.input(
			z.object({
				electionId: z.string(),
				page: z.number().min(1).default(1),
				pageSize: z.number().min(10).max(1000).default(100),
				search: z.string().optional(),
				college: z.string().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Check if user is admin or CRO
			const userRole = ctx.session.user.role;
			if (userRole !== "ADMIN" && userRole !== "CRO") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only admins and CROs can view voter lists",
				});
			}

			const skip = (input.page - 1) * input.pageSize;

			// Build where clause for filtering
			const where: {
				electionId: string;
				college?: string;
				OR?: Array<{
					studentId?: { contains: string; mode: "insensitive" };
					firstName?: { contains: string; mode: "insensitive" };
					lastName?: { contains: string; mode: "insensitive" };
					email?: { contains: string; mode: "insensitive" };
				}>;
			} = {
				electionId: input.electionId,
			};

			if (input.college) {
				where.college = input.college;
			}

			if (input.search) {
				where.OR = [
					{ studentId: { contains: input.search, mode: "insensitive" } },
					{ firstName: { contains: input.search, mode: "insensitive" } },
					{ lastName: { contains: input.search, mode: "insensitive" } },
					{ email: { contains: input.search, mode: "insensitive" } },
				];
			}

			// Get total count and paginated data in parallel
			const [total, voters] = await Promise.all([
				ctx.db.eligibleVoter.count({ where }),
				ctx.db.eligibleVoter.findMany({
					where,
					skip,
					take: input.pageSize,
					orderBy: { lastName: "asc" },
				}),
			]);

			return {
				voters,
				pagination: {
					page: input.page,
					pageSize: input.pageSize,
					total,
					totalPages: Math.ceil(total / input.pageSize),
				},
			};
		}),

	/**
	 * Get voter statistics for an election
	 */
	getVoterStats: protectedProcedure
		.input(z.object({ electionId: z.string() }))
		.query(async ({ ctx, input }) => {
			// Check if user is admin or CRO
			const userRole = ctx.session.user.role;
			if (userRole !== "ADMIN" && userRole !== "CRO") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only admins and CROs can view voter statistics",
				});
			}

			// Get total counts
			const [totalVoters, totalVoted] = await Promise.all([
				ctx.db.eligibleVoter.count({
					where: { electionId: input.electionId },
				}),
				ctx.db.eligibleVoter.count({
					where: { electionId: input.electionId, hasVoted: true },
				}),
			]);

			// Get breakdown by college
			const colleges = await ctx.db.eligibleVoter.groupBy({
				by: ["college"],
				where: { electionId: input.electionId },
				_count: true,
			});

			// Get voted count per college
			const votedByCollege = await ctx.db.eligibleVoter.groupBy({
				by: ["college"],
				where: { electionId: input.electionId, hasVoted: true },
				_count: true,
			});

			const votedMap = new Map(
				votedByCollege.map((v) => [v.college, v._count]),
			);

			const byCollege = colleges.map((c) => ({
				college: c.college,
				totalVoters: c._count,
				totalVoted: votedMap.get(c.college) ?? 0,
			}));

			return {
				totalVoters,
				totalVoted,
				totalNotVoted: totalVoters - totalVoted,
				turnoutPercentage:
					totalVoters > 0 ? (totalVoted / totalVoters) * 100 : 0,
				byCollege,
			};
		}),

	/**
	 * Delete all voters for an election
	 */
	deleteAllVoters: protectedProcedure
		.input(z.object({ electionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Check if user is admin or CRO
			const userRole = ctx.session.user.role;
			if (userRole !== "ADMIN" && userRole !== "CRO") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only admins and CROs can delete voters",
				});
			}

			// Check if election has started
			const election = await ctx.db.election.findUnique({
				where: { id: input.electionId },
			});

			if (!election) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Election not found",
				});
			}

			if (election.startTime < new Date()) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cannot delete voters after election has started",
				});
			}

			// Delete all voters
			const result = await ctx.db.eligibleVoter.deleteMany({
				where: { electionId: input.electionId },
			});

			// Create audit log
			await ctx.db.auditLog.create({
				data: {
					action: "VOTER_DELETE_ALL",
					electionId: input.electionId,
					details: {
						performedBy: ctx.session.user.id,
						performedByEmail: ctx.session.user.email,
						deletedCount: result.count,
					},
				},
			});

			return {
				success: true,
				deleted: result.count,
			};
		}),

	/**
	 * Get real-time monitoring data for an election
	 * Includes turnout by ballot type and quorum status
	 */
	getMonitoringData: protectedProcedure
		.input(z.object({ electionId: z.string() }))
		.query(async ({ ctx, input }) => {
			// Check if user is admin or CRO
			const userRole = ctx.session.user.role;
			if (userRole !== "ADMIN" && userRole !== "CRO") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only admins and CROs can view monitoring data",
				});
			}

			// Get election with ballots
			const election = await ctx.db.election.findUnique({
				where: { id: input.electionId },
				include: {
					ballots: {
						include: {
							_count: {
								select: { votes: true },
							},
						},
						orderBy: [{ order: "asc" }, { createdAt: "asc" }],
					},
				},
			});

			if (!election) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Election not found",
				});
			}

			// Get global settings for quorum percentages
			let settings = await ctx.db.globalSettings.findUnique({
				where: { id: "global" },
			});

			// Create default settings if they don't exist
			if (!settings) {
				settings = await ctx.db.globalSettings.create({
					data: {
						id: "global",
						executiveQuorum: 10,
						directorQuorum: 10,
						referendumQuorum: 20,
					},
				});
			}

			// Get total eligible voters
			const totalEligibleVoters = await ctx.db.eligibleVoter.count({
				where: { electionId: input.electionId },
			});

			// Get total voters who have voted
			const totalVoted = await ctx.db.eligibleVoter.count({
				where: { electionId: input.electionId, hasVoted: true },
			});

			// Calculate turnout by college
			const collegeStats = await ctx.db.eligibleVoter.groupBy({
				by: ["college"],
				where: { electionId: input.electionId },
				_count: true,
			});

			const votedByCollege = await ctx.db.eligibleVoter.groupBy({
				by: ["college"],
				where: { electionId: input.electionId, hasVoted: true },
				_count: true,
			});

			const votedMap = new Map(
				votedByCollege.map((v) => [v.college, v._count]),
			);

			const collegeData = collegeStats.map((c) => {
				const voted = votedMap.get(c.college) ?? 0;
				const eligible = c._count;
				return {
					college: c.college,
					eligible,
					voted,
					turnoutPercentage: eligible > 0 ? (voted / eligible) * 100 : 0,
				};
			});

			// Create a map of college -> eligible voter count for college-specific ballots
			const collegeEligibleMap = new Map(
				collegeStats.map((c) => [c.college, c._count]),
			);

			// Calculate ballot-level statistics
			const ballotStats = election.ballots.map((ballot) => {
				// For college-specific ballots (DIRECTOR), use college eligible voters
				// For election-wide ballots (EXECUTIVE, REFERENDUM), use total eligible voters
				const eligibleVotersForBallot = ballot.college
					? (collegeEligibleMap.get(ballot.college) ?? 0)
					: totalEligibleVoters;

				// Get quorum percentage based on ballot type from global settings
				const quorumPercentage =
					ballot.type === "REFERENDUM"
						? settings.referendumQuorum
						: ballot.type === "DIRECTOR"
							? settings.directorQuorum
							: settings.executiveQuorum;

				const quorumThreshold = Math.ceil(
					(eligibleVotersForBallot * quorumPercentage) / 100,
				);
				const voteCount = ballot._count.votes;
				const hasReachedQuorum = voteCount >= quorumThreshold;
				const quorumProgress =
					quorumThreshold > 0 ? (voteCount / quorumThreshold) * 100 : 0;

				return {
					id: ballot.id,
					title: ballot.title,
					type: ballot.type,
					college: ballot.college,
					voteCount,
					eligibleVoters: eligibleVotersForBallot,
					quorumThreshold,
					hasReachedQuorum,
					quorumProgress: Math.min(quorumProgress, 100),
					quorumPercentage,
				};
			});

			return {
				totalEligibleVoters,
				totalVoted,
				turnoutPercentage:
					totalEligibleVoters > 0
						? (totalVoted / totalEligibleVoters) * 100
						: 0,
				collegeData,
				ballotStats,
				lastUpdated: new Date(),
			};
		}),

	/**
	 * Update election end time (extend deadline)
	 */
	updateElectionEndTime: protectedProcedure
		.input(
			z.object({
				electionId: z.string(),
				endTime: z.date(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Check if user is admin or CRO
			const userRole = ctx.session.user.role;
			if (userRole !== "ADMIN" && userRole !== "CRO") {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Only admins and CROs can update election times",
				});
			}

			const election = await ctx.db.election.findUnique({
				where: { id: input.electionId },
			});

			if (!election) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Election not found",
				});
			}

			// Validate new end time is after start time
			if (input.endTime <= election.startTime) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "End time must be after start time",
				});
			}

			// Update election
			const updated = await ctx.db.election.update({
				where: { id: input.electionId },
				data: { endTime: input.endTime },
			});

			// Create audit log
			await ctx.db.auditLog.create({
				data: {
					action: "ELECTION_DEADLINE_EXTENDED",
					electionId: input.electionId,
					details: {
						performedBy: ctx.session.user.id,
						performedByEmail: ctx.session.user.email,
						oldEndTime: election.endTime,
						newEndTime: input.endTime,
					},
				},
			});

			return updated;
		}),
});
