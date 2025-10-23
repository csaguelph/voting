import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
	type MerkleProofData,
	batchGenerateMerkleProofs,
	buildMerkleTree,
	generateElectionMerkleTree,
	generateMerkleProof,
	getMerkleTreeStats,
	verifyMerkleProof,
} from "@/lib/crypto/merkle";
import {
	adminProcedure,
	createTRPCRouter,
	publicProcedure,
} from "@/server/api/trpc";

/**
 * Proof router
 * Handles Merkle tree generation and proof verification
 * for cryptographic vote inclusion verification
 */
export const proofRouter = createTRPCRouter({
	/**
	 * Generate Merkle tree for an election (Admin only)
	 * Creates a Merkle tree from all votes and stores the root in the database
	 */
	generateMerkleTree: adminProcedure
		.input(z.object({ electionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			// Get the election
			const election = await ctx.db.election.findUnique({
				where: { id: input.electionId },
				include: {
					votes: {
						select: { voteHash: true },
						orderBy: { timestamp: "asc" }, // Consistent ordering
					},
				},
			});

			if (!election) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Election not found",
				});
			}

			// Check if election has votes
			if (election.votes.length === 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cannot generate Merkle tree for election with no votes",
				});
			}

			// Check if tree already exists
			if (election.merkleRoot) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Merkle tree already generated for this election. Cannot regenerate to maintain integrity.",
				});
			}

			try {
				// Generate Merkle tree
				const voteHashes = election.votes.map((v) => v.voteHash);
				const { root, totalVotes, treeDepth } =
					generateElectionMerkleTree(voteHashes);

				// Store the root in the database
				const updatedElection = await ctx.db.election.update({
					where: { id: input.electionId },
					data: {
						merkleRoot: root,
						merkleTreeGeneratedAt: new Date(),
						merkleTreeVoteCount: totalVotes,
					},
				});

				// Log the action
				await ctx.db.auditLog.create({
					data: {
						electionId: input.electionId,
						action: "merkle_tree.generated",
						details: {
							merkleRoot: root,
							voteCount: totalVotes,
							treeDepth,
							generatedBy: ctx.session.user.email,
							timestamp: new Date().toISOString(),
						},
					},
				});

				return {
					success: true,
					merkleRoot: root,
					voteCount: totalVotes,
					treeDepth,
					generatedAt: updatedElection.merkleTreeGeneratedAt,
				};
			} catch (error) {
				console.error("Error generating Merkle tree:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to generate Merkle tree",
				});
			}
		}),

	/**
	 * Get recent elections with Merkle trees (Public)
	 */
	getRecentElections: publicProcedure.query(async ({ ctx }) => {
		const oneYearAgo = new Date();
		oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

		const elections = await ctx.db.election.findMany({
			where: {
				endTime: {
					gte: oneYearAgo,
				},
				merkleRoot: {
					not: null,
				},
			},
			select: {
				id: true,
				name: true,
				startTime: true,
				endTime: true,
				merkleRoot: true,
				merkleTreeGeneratedAt: true,
				merkleTreeVoteCount: true,
			},
			orderBy: {
				endTime: "desc",
			},
		});

		return elections.map((election) => ({
			id: election.id,
			name: election.name,
			startTime: election.startTime,
			endTime: election.endTime,
			hasMerkleTree: true,
			merkleTreeGeneratedAt: election.merkleTreeGeneratedAt,
			voteCount: election.merkleTreeVoteCount,
		}));
	}),

	/**
	 * Get Merkle tree information for an election (Public)
	 */
	getMerkleTreeInfo: publicProcedure
		.input(z.object({ electionId: z.string() }))
		.query(async ({ ctx, input }) => {
			const election = await ctx.db.election.findUnique({
				where: { id: input.electionId },
				select: {
					id: true,
					name: true,
					merkleRoot: true,
					merkleTreeGeneratedAt: true,
					merkleTreeVoteCount: true,
					isFinalized: true,
					finalizedAt: true,
				},
			});

			if (!election) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Election not found",
				});
			}

			return {
				electionId: election.id,
				electionName: election.name,
				hasMerkleTree: !!election.merkleRoot,
				merkleRoot: election.merkleRoot,
				generatedAt: election.merkleTreeGeneratedAt,
				voteCount: election.merkleTreeVoteCount,
				isFinalized: election.isFinalized,
				finalizedAt: election.finalizedAt,
			};
		}),

	/**
	 * Generate proof for a specific vote hash (Public)
	 * Anyone can generate a proof for any vote hash
	 */
	generateProof: publicProcedure
		.input(z.object({ electionId: z.string(), voteHash: z.string() }))
		.query(async ({ ctx, input }) => {
			// Get election and verify Merkle tree exists
			const election = await ctx.db.election.findUnique({
				where: { id: input.electionId },
				select: { merkleRoot: true },
			});

			if (!election) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Election not found",
				});
			}

			if (!election.merkleRoot) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Merkle tree not yet generated for this election",
				});
			}

			// Verify the vote hash exists
			const vote = await ctx.db.vote.findUnique({
				where: { voteHash: input.voteHash },
				select: {
					id: true,
					voteHash: true,
					electionId: true,
					timestamp: true,
				},
			});

			if (!vote) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Vote hash not found",
				});
			}

			if (vote.electionId !== input.electionId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Vote hash does not belong to this election",
				});
			}

			// Get all vote hashes for the election (in same order as tree generation)
			const allVotes = await ctx.db.vote.findMany({
				where: { electionId: input.electionId },
				select: { voteHash: true },
				orderBy: { timestamp: "asc" },
			});

			// Rebuild tree and generate proof
			try {
				const voteHashes = allVotes.map((v) => v.voteHash);
				const tree = buildMerkleTree(voteHashes);
				const proof = generateMerkleProof(tree, input.voteHash);

				if (!proof) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to generate proof for vote",
					});
				}

				return {
					proof,
					voteTimestamp: vote.timestamp,
					electionId: input.electionId,
				};
			} catch (error) {
				console.error("Error generating Merkle proof:", error);
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to generate Merkle proof",
				});
			}
		}),

	/**
	 * Batch generate proofs for multiple vote hashes (Public)
	 */
	batchGenerateProofs: publicProcedure
		.input(
			z.object({
				electionId: z.string(),
				voteHashes: z.array(z.string()).max(100),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Get election and verify Merkle tree exists
			const election = await ctx.db.election.findUnique({
				where: { id: input.electionId },
				select: { merkleRoot: true },
			});

			if (!election) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Election not found",
				});
			}

			if (!election.merkleRoot) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Merkle tree not yet generated for this election",
				});
			}

			// Get all vote hashes for the election
			const allVotes = await ctx.db.vote.findMany({
				where: { electionId: input.electionId },
				select: { voteHash: true, timestamp: true },
				orderBy: { timestamp: "asc" },
			});

			// Build tree
			const voteHashes = allVotes.map((v) => v.voteHash);
			const tree = buildMerkleTree(voteHashes);

			// Generate proofs for requested hashes
			const proofs = batchGenerateMerkleProofs(tree, input.voteHashes);

			// Match proofs with timestamps
			const results = proofs.map((proof, index) => {
				const hash = input.voteHashes[index];
				const vote = allVotes.find((v) => v.voteHash === hash);
				return {
					voteHash: hash,
					proof,
					timestamp: vote?.timestamp,
					found: !!proof,
				};
			});

			return {
				electionId: input.electionId,
				total: results.length,
				found: results.filter((r) => r.found).length,
				notFound: results.filter((r) => !r.found).length,
				results,
			};
		}),

	/**
	 * Verify a Merkle proof (Public)
	 */
	verifyProof: publicProcedure
		.input(
			z.object({
				proof: z.object({
					leaf: z.string(),
					proof: z.array(z.string()),
					root: z.string(),
					position: z.enum(["left", "right"]),
					positions: z.array(z.number()),
				}),
			}),
		)
		.query(async ({ input }) => {
			try {
				const isValid = verifyMerkleProof(input.proof as MerkleProofData);

				return {
					valid: isValid,
					message: isValid
						? "Proof is valid - vote was included in the Merkle tree"
						: "Proof is invalid - vote may not have been included",
				};
			} catch (error) {
				console.error("Error verifying Merkle proof:", error);
				return {
					valid: false,
					message: "Error verifying proof",
				};
			}
		}),

	/**
	 * Get Merkle tree statistics (Public)
	 */
	getTreeStats: publicProcedure
		.input(z.object({ electionId: z.string() }))
		.query(async ({ ctx, input }) => {
			const election = await ctx.db.election.findUnique({
				where: { id: input.electionId },
				select: {
					merkleRoot: true,
					merkleTreeVoteCount: true,
					merkleTreeGeneratedAt: true,
				},
			});

			if (!election || !election.merkleRoot) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Merkle tree not found for this election",
				});
			}

			// Get all votes to rebuild tree for stats
			const votes = await ctx.db.vote.findMany({
				where: { electionId: input.electionId },
				select: { voteHash: true },
				orderBy: { timestamp: "asc" },
			});

			const tree = buildMerkleTree(votes.map((v) => v.voteHash));
			const stats = getMerkleTreeStats(tree);

			return {
				...stats,
				storedRoot: election.merkleRoot,
				voteCount: election.merkleTreeVoteCount,
				generatedAt: election.merkleTreeGeneratedAt,
				rootMatches: stats.root === election.merkleRoot,
			};
		}),
});
