import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { isValidCollege } from "@/lib/constants/colleges";
import {
	adminProcedure,
	createTRPCRouter,
	protectedProcedure,
} from "@/server/api/trpc";

/**
 * Ballot router
 * Handles ballot and candidate management
 */
export const ballotRouter = createTRPCRouter({
	/**
	 * Get all ballots for an election (with candidates)
	 */
	getByElection: protectedProcedure
		.input(z.object({ electionId: z.string() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.ballot.findMany({
				where: { electionId: input.electionId },
				include: {
					candidates: {
						orderBy: { position: "asc" },
					},
					_count: {
						select: { votes: true },
					},
				},
				orderBy: { createdAt: "asc" },
			});
		}),

	/**
	 * Get a single ballot by ID (with candidates)
	 */
	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const ballot = await ctx.db.ballot.findUnique({
				where: { id: input.id },
				include: {
					candidates: {
						orderBy: { position: "asc" },
					},
					election: {
						select: {
							id: true,
							name: true,
						},
					},
				},
			});

			if (!ballot) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Ballot not found",
				});
			}

			return ballot;
		}),

	/**
	 * Create a new ballot (admin only)
	 */
	create: adminProcedure
		.input(
			z.object({
				electionId: z.string(),
				title: z.string().min(1, "Title is required"),
				type: z.enum(["EXECUTIVE", "DIRECTOR"]),
				college: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Validate college for DIRECTOR ballots
			if (input.type === "DIRECTOR") {
				if (!input.college) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "College is required for DIRECTOR ballots",
					});
				}

				if (!isValidCollege(input.college)) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Invalid college code",
					});
				}
			}

			// Create ballot
			const ballot = await ctx.db.ballot.create({
				data: {
					electionId: input.electionId,
					title: input.title,
					type: input.type,
					college: input.type === "DIRECTOR" ? input.college : null,
				},
				include: {
					candidates: true,
				},
			});

			// Log to audit
			await ctx.db.auditLog.create({
				data: {
					electionId: input.electionId,
					action: "ballot.created",
					details: {
						ballotId: ballot.id,
						title: ballot.title,
						type: ballot.type,
						college: ballot.college,
						userId: ctx.session.user.id,
						userEmail: ctx.session.user.email,
					},
				},
			});

			return ballot;
		}),

	/**
	 * Update a ballot (admin only)
	 */
	update: adminProcedure
		.input(
			z.object({
				id: z.string(),
				title: z.string().min(1, "Title is required").optional(),
				college: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existingBallot = await ctx.db.ballot.findUnique({
				where: { id: input.id },
			});

			if (!existingBallot) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Ballot not found",
				});
			}

			// Validate college if updating DIRECTOR ballot
			if (existingBallot.type === "DIRECTOR" && input.college) {
				if (!isValidCollege(input.college)) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Invalid college code",
					});
				}
			}

			const ballot = await ctx.db.ballot.update({
				where: { id: input.id },
				data: {
					title: input.title,
					college:
						existingBallot.type === "DIRECTOR" ? input.college : undefined,
				},
				include: {
					candidates: {
						orderBy: { position: "asc" },
					},
				},
			});

			// Log to audit
			await ctx.db.auditLog.create({
				data: {
					electionId: existingBallot.electionId,
					action: "ballot.updated",
					details: {
						ballotId: ballot.id,
						changes: {
							title: input.title,
							college: input.college,
						},
						userId: ctx.session.user.id,
						userEmail: ctx.session.user.email,
					},
				},
			});

			return ballot;
		}),

	/**
	 * Delete a ballot (admin only)
	 * Prevents deletion if votes exist
	 */
	delete: adminProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const ballot = await ctx.db.ballot.findUnique({
				where: { id: input.id },
				include: {
					_count: {
						select: { votes: true },
					},
				},
			});

			if (!ballot) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Ballot not found",
				});
			}

			// Prevent deletion if votes exist
			if (ballot._count.votes > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Cannot delete ballot with ${ballot._count.votes} existing votes`,
				});
			}

			await ctx.db.ballot.delete({
				where: { id: input.id },
			});

			// Log to audit
			await ctx.db.auditLog.create({
				data: {
					electionId: ballot.electionId,
					action: "ballot.deleted",
					details: {
						ballotId: ballot.id,
						title: ballot.title,
						type: ballot.type,
						college: ballot.college,
						userId: ctx.session.user.id,
						userEmail: ctx.session.user.email,
					},
				},
			});

			return { success: true };
		}),

	/**
	 * Add a candidate to a ballot (admin only)
	 */
	addCandidate: adminProcedure
		.input(
			z.object({
				ballotId: z.string(),
				name: z.string().min(1, "Name is required"),
				statement: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const ballot = await ctx.db.ballot.findUnique({
				where: { id: input.ballotId },
				include: {
					candidates: {
						orderBy: { position: "desc" },
						take: 1,
					},
				},
			});

			if (!ballot) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Ballot not found",
				});
			}

			// Get next position
			const nextPosition =
				ballot.candidates.length > 0 && ballot.candidates[0]
					? ballot.candidates[0].position + 1
					: 0;

			const candidate = await ctx.db.candidate.create({
				data: {
					ballotId: input.ballotId,
					name: input.name,
					statement: input.statement,
					position: nextPosition,
				},
			});

			// Log to audit
			await ctx.db.auditLog.create({
				data: {
					electionId: ballot.electionId,
					action: "candidate.added",
					details: {
						candidateId: candidate.id,
						ballotId: input.ballotId,
						name: candidate.name,
						userId: ctx.session.user.id,
						userEmail: ctx.session.user.email,
					},
				},
			});

			return candidate;
		}),

	/**
	 * Update a candidate (admin only)
	 */
	updateCandidate: adminProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1, "Name is required").optional(),
				statement: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existingCandidate = await ctx.db.candidate.findUnique({
				where: { id: input.id },
				include: {
					ballot: {
						select: {
							electionId: true,
						},
					},
				},
			});

			if (!existingCandidate) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Candidate not found",
				});
			}

			const candidate = await ctx.db.candidate.update({
				where: { id: input.id },
				data: {
					name: input.name,
					statement: input.statement,
				},
			});

			// Log to audit
			await ctx.db.auditLog.create({
				data: {
					electionId: existingCandidate.ballot.electionId,
					action: "candidate.updated",
					details: {
						candidateId: candidate.id,
						changes: {
							name: input.name,
							statement: input.statement,
						},
						userId: ctx.session.user.id,
						userEmail: ctx.session.user.email,
					},
				},
			});

			return candidate;
		}),

	/**
	 * Delete a candidate (admin only)
	 * Prevents deletion if votes exist
	 */
	deleteCandidate: adminProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const candidate = await ctx.db.candidate.findUnique({
				where: { id: input.id },
				include: {
					ballot: {
						select: {
							electionId: true,
						},
					},
					_count: {
						select: { votes: true },
					},
				},
			});

			if (!candidate) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Candidate not found",
				});
			}

			// Prevent deletion if votes exist
			if (candidate._count.votes > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Cannot delete candidate with ${candidate._count.votes} existing votes`,
				});
			}

			await ctx.db.candidate.delete({
				where: { id: input.id },
			});

			// Log to audit
			await ctx.db.auditLog.create({
				data: {
					electionId: candidate.ballot.electionId,
					action: "candidate.deleted",
					details: {
						candidateId: candidate.id,
						name: candidate.name,
						userId: ctx.session.user.id,
						userEmail: ctx.session.user.email,
					},
				},
			});

			return { success: true };
		}),

	/**
	 * Reorder candidates within a ballot (admin only)
	 */
	reorderCandidates: adminProcedure
		.input(
			z.object({
				ballotId: z.string(),
				candidateIds: z.array(z.string()),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const ballot = await ctx.db.ballot.findUnique({
				where: { id: input.ballotId },
				select: { electionId: true },
			});

			if (!ballot) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Ballot not found",
				});
			}

			// Update positions in a transaction
			await ctx.db.$transaction(
				input.candidateIds.map((candidateId, index) =>
					ctx.db.candidate.update({
						where: { id: candidateId },
						data: { position: index },
					}),
				),
			);

			// Log to audit
			await ctx.db.auditLog.create({
				data: {
					electionId: ballot.electionId,
					action: "candidates.reordered",
					details: {
						ballotId: input.ballotId,
						newOrder: input.candidateIds,
						userId: ctx.session.user.id,
						userEmail: ctx.session.user.email,
					},
				},
			});

			return { success: true };
		}),
});
