import { TRPCError } from "@trpc/server";
import { z } from "zod";

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

			// Use transaction for atomicity
			await ctx.db.$transaction(
				async (tx) => {
					for (const batch of batches) {
						try {
							const result = await tx.eligibleVoter.createMany({
								data: batch.map((voter) => ({
									electionId: input.electionId,
									studentId: voter.studentId,
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

					// Create audit log entry
					await tx.auditLog.create({
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
				},
				{
					// Increase timeout for large imports
					timeout: 60000, // 60 seconds
				},
			);

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
			const [totalVoters, totalVoted, byCollege] = await Promise.all([
				ctx.db.eligibleVoter.count({
					where: { electionId: input.electionId },
				}),
				ctx.db.eligibleVoter.count({
					where: { electionId: input.electionId, hasVoted: true },
				}),
				ctx.db.eligibleVoter.groupBy({
					by: ["college"],
					where: { electionId: input.electionId },
					_count: true,
				}),
			]);

			return {
				totalVoters,
				totalVoted,
				totalNotVoted: totalVoters - totalVoted,
				turnoutPercentage:
					totalVoters > 0 ? (totalVoted / totalVoters) * 100 : 0,
				byCollege: byCollege.map((c) => ({
					college: c.college,
					count: c._count,
				})),
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
});
