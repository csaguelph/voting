import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { calculateElectionResults } from "../../../lib/results/calculator";
import {
	createSummaryReport,
	formatResultsAsCSV,
	formatResultsAsJSON,
} from "../../../lib/results/formatter";
import { adminProcedure, createTRPCRouter, publicProcedure } from "../trpc";

export const resultsRouter = createTRPCRouter({
	/**
	 * Get election results
	 * Admin can always see results, public can only see published results
	 */
	getElectionResults: publicProcedure
		.input(z.object({ electionId: z.string() }))
		.query(async ({ ctx, input }) => {
			const election = await ctx.db.election.findUnique({
				where: { id: input.electionId },
				include: {
					ballots: {
						include: {
							candidates: true,
							votes: true,
						},
						orderBy: { order: "asc" },
					},
					eligibleVoters: {
						select: {
							hasVoted: true,
						},
					},
				},
			});

			if (!election) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Election not found",
				});
			}

			// Check if user can view results
			const isAdmin =
				ctx.session?.user.role === "ADMIN" || ctx.session?.user.role === "CRO";
			const canView = isAdmin || election.isPublished;

			if (!canView) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Results are not yet published",
				});
			}

			// Calculate results
			const eligibleVotersCount = election.eligibleVoters.length;
			const votedCount = election.eligibleVoters.filter(
				(v) => v.hasVoted,
			).length;

			const results = calculateElectionResults(
				election,
				election.ballots,
				eligibleVotersCount,
				votedCount,
			);

			// Include election dates for checking if election has ended
			return {
				...results,
				startTime: election.startTime,
				endTime: election.endTime,
			};
		}),

	/**
	 * Get results status (without full results)
	 */
	getResultsStatus: publicProcedure
		.input(z.object({ electionId: z.string() }))
		.query(async ({ ctx, input }) => {
			const election = await ctx.db.election.findUnique({
				where: { id: input.electionId },
				select: {
					id: true,
					name: true,
					isFinalized: true,
					finalizedAt: true,
					isPublished: true,
					publishedAt: true,
					endTime: true,
				},
			});

			if (!election) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Election not found",
				});
			}

			return election;
		}),

	/**
	 * Finalize results (admin only)
	 * Locks results and prevents further changes
	 */
	finalizeResults: adminProcedure
		.input(z.object({ electionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const election = await ctx.db.election.findUnique({
				where: { id: input.electionId },
			});

			if (!election) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Election not found",
				});
			}

			if (election.isFinalized) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Results are already finalized",
				});
			}

			// Check if election has ended
			if (new Date() < election.endTime) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cannot finalize results before election ends",
				});
			}

			// Finalize the election
			const updated = await ctx.db.election.update({
				where: { id: input.electionId },
				data: {
					isFinalized: true,
					finalizedAt: new Date(),
				},
			});

			// Create audit log
			await ctx.db.auditLog.create({
				data: {
					electionId: input.electionId,
					action: "results.finalized",
					details: {
						finalizedBy: ctx.session.user.email,
						finalizedAt: updated.finalizedAt,
					},
				},
			});

			return updated;
		}),

	/**
	 * Publish results (admin only)
	 * Makes results visible to the public
	 */
	publishResults: adminProcedure
		.input(z.object({ electionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const election = await ctx.db.election.findUnique({
				where: { id: input.electionId },
			});

			if (!election) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Election not found",
				});
			}

			if (!election.isFinalized) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Results must be finalized before publishing",
				});
			}

			if (election.isPublished) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Results are already published",
				});
			}

			// Publish the results
			const updated = await ctx.db.election.update({
				where: { id: input.electionId },
				data: {
					isPublished: true,
					publishedAt: new Date(),
				},
			});

			// Create audit log
			await ctx.db.auditLog.create({
				data: {
					electionId: input.electionId,
					action: "results.published",
					details: {
						publishedBy: ctx.session.user.email,
						publishedAt: updated.publishedAt,
					},
				},
			});

			return updated;
		}),

	/**
	 * Unpublish results (admin only)
	 * Hides results from public view
	 */
	unpublishResults: adminProcedure
		.input(z.object({ electionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const election = await ctx.db.election.findUnique({
				where: { id: input.electionId },
			});

			if (!election) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Election not found",
				});
			}

			if (!election.isPublished) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Results are not published",
				});
			}

			// Unpublish the results
			const updated = await ctx.db.election.update({
				where: { id: input.electionId },
				data: {
					isPublished: false,
					publishedAt: null,
				},
			});

			// Create audit log
			await ctx.db.auditLog.create({
				data: {
					electionId: input.electionId,
					action: "results.unpublished",
					details: {
						unpublishedBy: ctx.session.user.email,
						unpublishedAt: new Date(),
					},
				},
			});

			return updated;
		}),

	/**
	 * Export results as CSV (admin only)
	 */
	exportResultsCSV: adminProcedure
		.input(z.object({ electionId: z.string() }))
		.query(async ({ ctx, input }) => {
			// Get full results
			const election = await ctx.db.election.findUnique({
				where: { id: input.electionId },
				include: {
					ballots: {
						include: {
							candidates: true,
							votes: true,
						},
						orderBy: { order: "asc" },
					},
					eligibleVoters: {
						select: {
							hasVoted: true,
						},
					},
				},
			});

			if (!election) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Election not found",
				});
			}

			// Calculate results
			const eligibleVotersCount = election.eligibleVoters.length;
			const votedCount = election.eligibleVoters.filter(
				(v) => v.hasVoted,
			).length;

			const results = calculateElectionResults(
				election,
				election.ballots,
				eligibleVotersCount,
				votedCount,
			);

			// Format as CSV
			const csv = formatResultsAsCSV(results);

			// Create audit log
			await ctx.db.auditLog.create({
				data: {
					electionId: input.electionId,
					action: "results.exported",
					details: {
						exportedBy: ctx.session.user.email,
						format: "csv",
						exportedAt: new Date(),
					},
				},
			});

			return {
				csv,
				filename: `election-results-${election.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`,
			};
		}),

	/**
	 * Export results as JSON (admin only)
	 */
	exportResultsJSON: adminProcedure
		.input(z.object({ electionId: z.string() }))
		.query(async ({ ctx, input }) => {
			// Get full results
			const election = await ctx.db.election.findUnique({
				where: { id: input.electionId },
				include: {
					ballots: {
						include: {
							candidates: true,
							votes: true,
						},
						orderBy: { order: "asc" },
					},
					eligibleVoters: {
						select: {
							hasVoted: true,
						},
					},
				},
			});

			if (!election) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Election not found",
				});
			}

			// Calculate results
			const eligibleVotersCount = election.eligibleVoters.length;
			const votedCount = election.eligibleVoters.filter(
				(v) => v.hasVoted,
			).length;

			const results = calculateElectionResults(
				election,
				election.ballots,
				eligibleVotersCount,
				votedCount,
			);

			// Format as JSON
			const json = formatResultsAsJSON(results);

			// Create audit log
			await ctx.db.auditLog.create({
				data: {
					electionId: input.electionId,
					action: "results.exported",
					details: {
						exportedBy: ctx.session.user.email,
						format: "json",
						exportedAt: new Date(),
					},
				},
			});

			return {
				json,
				filename: `election-results-${election.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().split("T")[0]}.json`,
			};
		}),

	/**
	 * Generate summary report (admin only)
	 */
	generateSummaryReport: adminProcedure
		.input(z.object({ electionId: z.string() }))
		.query(async ({ ctx, input }) => {
			// Get full results
			const election = await ctx.db.election.findUnique({
				where: { id: input.electionId },
				include: {
					ballots: {
						include: {
							candidates: true,
							votes: true,
						},
						orderBy: { order: "asc" },
					},
					eligibleVoters: {
						select: {
							hasVoted: true,
						},
					},
				},
			});

			if (!election) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Election not found",
				});
			}

			// Calculate results
			const eligibleVotersCount = election.eligibleVoters.length;
			const votedCount = election.eligibleVoters.filter(
				(v) => v.hasVoted,
			).length;

			const results = calculateElectionResults(
				election,
				election.ballots,
				eligibleVotersCount,
				votedCount,
			);

			// Generate summary report
			const report = createSummaryReport(results);

			return {
				report,
				filename: `election-summary-${election.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().split("T")[0]}.txt`,
			};
		}),
});
