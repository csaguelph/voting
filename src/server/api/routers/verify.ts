import { z } from "zod";

import { hashStudentId, verifyVoteHash } from "@/lib/voting/hash";
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
	 * Verify vote integrity
	 * Checks if the stored vote data matches its hash (tamper detection)
	 * Note: Requires knowing the voter's student ID (only voter should have this)
	 */
	verifyVoteIntegrity: publicProcedure
		.input(
			z.object({
				voteHash: z.string(),
				voterId: z.string(), // Student ID of the voter
			}),
		)
		.query(async ({ ctx, input }) => {
			// Find the vote by hash
			const vote = await ctx.db.vote.findUnique({
				where: { voteHash: input.voteHash },
				select: {
					id: true,
					electionId: true,
					ballotId: true,
					voteData: true,
					voteHash: true,
					timestamp: true,
					election: {
						select: {
							name: true,
						},
					},
					ballot: {
						select: {
							title: true,
						},
					},
				},
			});

			if (!vote) {
				return {
					exists: false,
					message: "Vote hash not found in our records",
				};
			}

			// Check if the student ID exists in eligible voters for this election
			// Use the hashed studentId for lookup (encrypted field can't be queried efficiently)
			const studentIdHash = hashStudentId(input.voterId);
			const eligibleVoter = await ctx.db.eligibleVoter.findFirst({
				where: {
					electionId: vote.electionId,
					studentIdHash,
				},
			});

			if (!eligibleVoter) {
				return {
					exists: true,
					isValid: false,
					message:
						"Student ID not found for this election. Please verify you entered it correctly.",
					election: vote.election.name,
					ballot: vote.ballot.title,
					timestamp: vote.timestamp,
				};
			}

			// Recompute the hash with stored vote data
			const isValid = verifyVoteHash(vote.voteHash, {
				electionId: vote.electionId,
				ballotId: vote.ballotId,
				voteData: vote.voteData,
				voterId: input.voterId,
				timestamp: vote.timestamp,
			});

			if (!isValid) {
				return {
					exists: true,
					isValid: false,
					message:
						"⚠️ TAMPERING DETECTED: Vote hash does not match the stored vote data. This vote may have been modified after it was cast.",
					election: vote.election.name,
					ballot: vote.ballot.title,
					timestamp: vote.timestamp,
				};
			}

			return {
				exists: true,
				isValid: true,
				message:
					"✓ Vote integrity verified: Hash matches the stored vote data. No tampering detected.",
				election: vote.election.name,
				ballot: vote.ballot.title,
				timestamp: vote.timestamp,
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
