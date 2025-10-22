import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

/**
 * Public verification router
 * Allows anyone to verify that a vote hash exists in the database
 * This provides transparency without revealing voter identity
 */
export const verifyRouter = createTRPCRouter({
	/**
	 * Verify a single vote hash
	 * Returns whether the hash exists and when it was recorded
	 */
	verifyHash: publicProcedure
		.input(z.object({ voteHash: z.string() }))
		.query(async ({ ctx, input }) => {
			const vote = await ctx.db.vote.findUnique({
				where: { voteHash: input.voteHash },
				select: {
					id: true,
					timestamp: true,
					electionId: true,
					election: {
						select: {
							name: true,
							startTime: true,
							endTime: true,
						},
					},
				},
			});

			if (!vote) {
				return {
					exists: false,
					message: "This vote hash was not found in our records",
				};
			}

			return {
				exists: true,
				timestamp: vote.timestamp,
				election: {
					id: vote.electionId,
					name: vote.election.name,
					startTime: vote.election.startTime,
					endTime: vote.election.endTime,
				},
				message: "This vote was successfully recorded and counted",
			};
		}),

	/**
	 * Verify multiple vote hashes at once
	 * Useful for batch verification
	 */
	verifyBatch: publicProcedure
		.input(
			z.object({
				voteHashes: z.array(z.string()).max(100), // Limit to 100 at a time
			}),
		)
		.query(async ({ ctx, input }) => {
			const votes = await ctx.db.vote.findMany({
				where: {
					voteHash: {
						in: input.voteHashes,
					},
				},
				select: {
					voteHash: true,
					timestamp: true,
					electionId: true,
					election: {
						select: {
							name: true,
						},
					},
				},
			});

			const results = input.voteHashes.map((hash) => {
				const vote = votes.find((v) => v.voteHash === hash);

				if (!vote) {
					return {
						voteHash: hash,
						exists: false,
						message: "Not found",
					};
				}

				return {
					voteHash: hash,
					exists: true,
					timestamp: vote.timestamp,
					election: {
						id: vote.electionId,
						name: vote.election.name,
					},
					message: "Verified",
				};
			});

			return {
				total: input.voteHashes.length,
				verified: results.filter((r) => r.exists).length,
				notFound: results.filter((r) => !r.exists).length,
				results,
			};
		}),

	/**
	 * Get election verification statistics
	 * Shows total votes, verification rate, etc.
	 */
	getElectionStats: publicProcedure
		.input(z.object({ electionId: z.string() }))
		.query(async ({ ctx, input }) => {
			const election = await ctx.db.election.findUnique({
				where: { id: input.electionId },
				include: {
					_count: {
						select: {
							votes: true,
							eligibleVoters: true,
							ballots: true,
						},
					},
				},
			});

			if (!election) {
				return null;
			}

			// Count voters who have voted
			const votedCount = await ctx.db.eligibleVoter.count({
				where: {
					electionId: input.electionId,
					hasVoted: true,
				},
			});

			// Calculate turnout
			const totalEligible = election._count.eligibleVoters;
			const turnoutPercentage =
				totalEligible > 0 ? (votedCount / totalEligible) * 100 : 0;

			return {
				election: {
					id: election.id,
					name: election.name,
					startTime: election.startTime,
					endTime: election.endTime,
					isActive: election.isActive,
				},
				statistics: {
					totalEligibleVoters: totalEligible,
					totalVoted: votedCount,
					turnoutPercentage: Math.round(turnoutPercentage * 100) / 100,
					totalVotes: election._count.votes,
					totalBallots: election._count.ballots,
				},
			};
		}),
});
