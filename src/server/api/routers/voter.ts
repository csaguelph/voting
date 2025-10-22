import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

/**
 * Voter router
 * Handles voter eligibility and voting status
 */
export const voterRouter = createTRPCRouter({
	/**
	 * Check if current user is eligible to vote in an election
	 */
	checkEligibility: protectedProcedure
		.input(z.object({ electionId: z.string() }))
		.query(async ({ ctx, input }) => {
			const voter = await ctx.db.eligibleVoter.findUnique({
				where: {
					electionId_email: {
						electionId: input.electionId,
						email: ctx.session.user.email ?? "",
					},
				},
			});

			return {
				isEligible: !!voter,
				hasVoted: voter?.hasVoted ?? false,
				votedAt: voter?.votedAt,
				college: voter?.college,
			};
		}),

	/**
	 * Get voter details for current user in an election
	 */
	getMyDetails: protectedProcedure
		.input(z.object({ electionId: z.string() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.eligibleVoter.findUnique({
				where: {
					electionId_email: {
						electionId: input.electionId,
						email: ctx.session.user.email ?? "",
					},
				},
			});
		}),
});
