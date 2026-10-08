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
			orderBy: {
				createdAt: "desc", // Order by most recently created
			},
		});

		// Get student info from the most recent eligible voter record. Only the
		// end of the student ID is shown: voters type it to open their ballot,
		// so whoever is holding their phone shouldn't be able to read it here.
		const mostRecentVoter = eligibleVoters[0];
		const studentInfo = mostRecentVoter
			? {
					studentIdEnding: mostRecentVoter.studentId.slice(-3),
					college: mostRecentVoter.college,
					firstName: mostRecentVoter.firstName,
					lastName: mostRecentVoter.lastName,
				}
			: null;

		return eligibleVoters.map((ev) => ({
			...ev.election,
			hasVoted: ev.hasVoted,
			votedAt: ev.votedAt,
			// Use consistent student info from most recent record
			studentIdEnding: studentInfo?.studentIdEnding ?? ev.studentId.slice(-3),
			college: studentInfo?.college ?? ev.college,
			firstName: studentInfo?.firstName ?? ev.firstName,
			lastName: studentInfo?.lastName ?? ev.lastName,
		}));
	}),
});
