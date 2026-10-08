import { Prisma, type PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
	buildCollegeEligibleMap,
	buildCollegeVotedMap,
} from "@/lib/elections/queries";
import { invalidateCachedResults } from "@/lib/results/invalidate";
import {
	getCachedElectionResults,
	invalidateElectionResults,
	setCachedElectionResults,
} from "@/lib/results/results-cache";
import type { ElectionResults } from "../../../lib/results/calculator";
import { calculateElectionResults } from "../../../lib/results/calculator";
import { fetchElectionForResults } from "../../../lib/results/fetch-election-for-results";
import {
	createSummaryReport,
	formatResultsAsCSV,
	formatResultsAsJSON,
} from "../../../lib/results/formatter";
import {
	adminProcedure,
	createTRPCRouter,
	croProcedure,
	publicProcedure,
} from "../trpc";

/**
 * Fetch an election and calculate its results from the database (uncached)
 */
async function computeElectionResults(db: PrismaClient, electionId: string) {
	const data = await fetchElectionForResults(db, electionId);
	if (!data) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Election not found",
		});
	}
	const { election, ballots, eligibleVotersCount, votedCount } = data;

	let settings = await db.globalSettings.findUnique({
		where: { id: "global" },
	});
	if (!settings) {
		settings = await db.globalSettings.create({
			data: {
				id: "global",
				executiveQuorum: 10,
				directorQuorum: 10,
				referendumQuorum: 20,
			},
		});
	}
	const [collegeEligibleMap, collegeVotedMap] = await Promise.all([
		buildCollegeEligibleMap(db, electionId),
		buildCollegeVotedMap(db, electionId),
	]);

	const results = calculateElectionResults(
		election,
		ballots,
		eligibleVotersCount,
		votedCount,
		{
			executiveQuorum: settings.executiveQuorum,
			directorQuorum: settings.directorQuorum,
			referendumQuorum: settings.referendumQuorum,
		},
		collegeEligibleMap,
		collegeVotedMap,
	);
	return { election, results };
}

export const resultsRouter = createTRPCRouter({
	/**
	 * Get election results
	 * Admin can always see results, public can only see published results
	 */
	getElectionResults: publicProcedure
		.input(z.object({ electionId: z.string() }))
		.query(async ({ ctx, input }) => {
			const isAdmin =
				ctx.session?.user.role === "ADMIN" || ctx.session?.user.role === "CRO";
			// Only the CRO records draws by lot (see recordTieBreakDraw)
			const canDecideTies = ctx.session?.user.role === "CRO";

			type CachedPayload = ElectionResults & {
				startTime: Date;
				endTime: Date;
			};
			let cached: CachedPayload | null = null;
			// Cache version seen before reading the database; results computed
			// below are cached under it (see results-cache.ts)
			let cacheVersion: string | null = null;
			try {
				const read = await getCachedElectionResults<CachedPayload>(
					input.electionId,
				);
				cached = read.value;
				cacheVersion = read.version;
			} catch (err) {
				console.error("[results-cache] getCachedElectionResults failed:", err);
			}
			if (cached) {
				const canView = isAdmin || cached.isPublished;
				if (!canView) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "Results are not yet published",
					});
				}
				return { ...cached, isAdmin, canDecideTies };
			}

			// Cache miss or Redis error: single DB fetch and compute
			const { election, results } = await computeElectionResults(
				ctx.db,
				input.electionId,
			);
			const canView = isAdmin || election.isPublished;
			if (!canView) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Results are not yet published",
				});
			}

			const payload = {
				...results,
				startTime: election.startTime,
				endTime: election.endTime,
			};
			try {
				if (cacheVersion !== null) {
					await setCachedElectionResults(
						input.electionId,
						cacheVersion,
						payload,
						{
							isFinalized: election.isFinalized,
							isPublished: election.isPublished,
						},
					);
				}
			} catch (err) {
				console.error("[results-cache] setCachedElectionResults failed:", err);
			}

			return { ...payload, isAdmin, canDecideTies };
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

			// Every tie must be decided before results are final
			const { results } = await computeElectionResults(
				ctx.db,
				input.electionId,
			);
			const tied = results.ballots.find((b) => b.pendingTieBreak);
			if (tied) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `The tie on "${tied.ballotTitle}" must be decided by lot before results can be finalized`,
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

			try {
				await invalidateElectionResults(input.electionId);
			} catch (err) {
				console.error("[results-cache] invalidateElectionResults failed:", err);
			}

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

			try {
				await invalidateElectionResults(input.electionId);
			} catch (err) {
				console.error("[results-cache] invalidateElectionResults failed:", err);
			}

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

			try {
				await invalidateElectionResults(input.electionId);
			} catch (err) {
				console.error("[results-cache] invalidateElectionResults failed:", err);
			}

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
	/**
	 * Record the outcome of a draw by lot for a tie that no count separates
	 * (Australian rule). CRO only, after voting closes and before finalizing.
	 * The tie itself is worked out on the server from the current results.
	 */
	recordTieBreakDraw: croProcedure
		.input(
			z.object({
				electionId: z.string(),
				ballotId: z.string(),
				selectedCandidateIds: z.array(z.string()).min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { election, results } = await computeElectionResults(
				ctx.db,
				input.electionId,
			);
			if (election.endTime > new Date()) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Ties can only be decided by lot once voting has closed",
				});
			}
			if (election.isFinalized) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Results are already finalized",
				});
			}

			const ballot = results.ballots.find((b) => b.ballotId === input.ballotId);
			if (!ballot) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Ballot not found in this election",
				});
			}
			const pending = ballot.pendingTieBreak;
			if (!pending) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "This ballot has no tie waiting to be decided by lot",
				});
			}
			const selected = [...new Set(input.selectedCandidateIds)];
			if (
				selected.length !== pending.select ||
				!selected.every((id) => pending.candidateIds.includes(id))
			) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Choose ${pending.select} of the tied candidates`,
				});
			}

			// The draw and its audit entry are saved together or not at all
			try {
				await ctx.db.$transaction(async (tx) => {
					await tx.tieBreakDraw.create({
						data: {
							ballotId: input.ballotId,
							kind: pending.kind,
							round: pending.round,
							candidateIds: pending.candidateIds,
							selectedCandidateIds: selected,
							decidedById: ctx.session.user.id,
							decidedByEmail: ctx.session.user.email,
						},
					});
					await tx.auditLog.create({
						data: {
							electionId: input.electionId,
							action: "results.tie_break_drawn",
							details: {
								ballotId: input.ballotId,
								ballotTitle: ballot.ballotTitle,
								kind: pending.kind,
								round: pending.round,
								candidateIds: pending.candidateIds,
								selectedCandidateIds: selected,
								drawnBy: ctx.session.user.email,
							},
						},
					});
				});
			} catch (error) {
				if (
					error instanceof Prisma.PrismaClientKnownRequestError &&
					error.code === "P2002"
				) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "This tie has already been decided",
					});
				}
				throw error;
			}
			await invalidateCachedResults(input.electionId);

			const { results: updated } = await computeElectionResults(
				ctx.db,
				input.electionId,
			);
			return updated.ballots.find((b) => b.ballotId === input.ballotId);
		}),

	exportResultsCSV: adminProcedure
		.input(z.object({ electionId: z.string() }))
		.query(async ({ ctx, input }) => {
			const { election, results } = await computeElectionResults(
				ctx.db,
				input.electionId,
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
			const { election, results } = await computeElectionResults(
				ctx.db,
				input.electionId,
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
			const { election, results } = await computeElectionResults(
				ctx.db,
				input.electionId,
			);

			// Generate summary report
			const report = createSummaryReport(results);

			return {
				report,
				filename: `election-summary-${election.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().split("T")[0]}.txt`,
			};
		}),
});
