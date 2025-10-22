import { z } from "zod";

import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
} from "@/server/api/trpc";

/**
 * Election router
 * Handles election CRUD operations and queries
 */
export const electionRouter = createTRPCRouter({
	/**
	 * Get all elections (public)
	 */
	getAll: publicProcedure.query(async ({ ctx }) => {
		return ctx.db.election.findMany({
			orderBy: { startTime: "desc" },
			include: {
				ballots: {
					include: {
						candidates: true,
					},
				},
			},
		});
	}),

	/**
	 * Get active elections
	 */
	getActive: publicProcedure.query(async ({ ctx }) => {
		const now = new Date();
		return ctx.db.election.findMany({
			where: {
				isActive: true,
				startTime: { lte: now },
				endTime: { gte: now },
			},
			include: {
				ballots: {
					include: {
						candidates: true,
					},
				},
			},
		});
	}),

	/**
	 * Get election by ID
	 */
	getById: publicProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.election.findUnique({
				where: { id: input.id },
				include: {
					ballots: {
						include: {
							candidates: true,
						},
					},
				},
			});
		}),

	/**
	 * Get elections for authenticated user
	 */
	getMyElections: protectedProcedure.query(async ({ ctx }) => {
		// Find elections where user is an eligible voter
		const eligibleVoters = await ctx.db.eligibleVoter.findMany({
			where: { email: ctx.session.user.email ?? "" },
			include: {
				election: {
					include: {
						ballots: {
							include: {
								candidates: true,
							},
						},
					},
				},
			},
		});

		return eligibleVoters.map((ev) => ({
			...ev.election,
			hasVoted: ev.hasVoted,
			votedAt: ev.votedAt,
		}));
	}),
});
