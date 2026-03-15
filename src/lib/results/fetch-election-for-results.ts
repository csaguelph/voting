import type { Ballot, Candidate } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import type { VoteForResults } from "./calculator";

const VOTE_CHUNK_SIZE = 2000;

export type ElectionForResults = {
	id: string;
	name: string;
	startTime: Date;
	endTime: Date;
	isFinalized: boolean;
	isPublished: boolean;
	finalizedAt: Date | null;
	publishedAt: Date | null;
};

export type BallotWithCandidatesAndVotes = Ballot & {
	candidates: Candidate[];
	votes: VoteForResults[];
};

export type FetchElectionForResultsResult = {
	election: ElectionForResults;
	ballots: BallotWithCandidatesAndVotes[];
	eligibleVotersCount: number;
	votedCount: number;
};

/**
 * Fetches election data needed for results calculation using separate queries
 * and chunked vote loading to stay under Prisma's response size limit (~5MB).
 * Use this instead of a single findUnique with nested include of ballots/votes.
 *
 * Processing requires: all votes (id + voteData) to compute counts, YES/NO, and
 * ranked-choice rounds. We cannot return "less" for processing—only the computed
 * summary is sent to the client (no raw votes). Response size is already the
 * minimal summary the UI needs; for heavy traffic use results-cache.
 */
export async function fetchElectionForResults(
	db: PrismaClient,
	electionId: string,
): Promise<FetchElectionForResultsResult | null> {
	const election = await db.election.findUnique({
		where: { id: electionId },
		select: {
			id: true,
			name: true,
			startTime: true,
			endTime: true,
			isFinalized: true,
			finalizedAt: true,
			isPublished: true,
			publishedAt: true,
		},
	});

	if (!election) {
		return null;
	}

	const [eligibleVotersCount, votedCount, ballots] = await Promise.all([
		db.eligibleVoter.count({ where: { electionId } }),
		db.eligibleVoter.count({
			where: { electionId, hasVoted: true },
		}),
		db.ballot.findMany({
			where: { electionId },
			include: { candidates: true },
			orderBy: { order: "asc" },
		}),
	]);

	// Load votes in chunks to avoid exceeding Prisma response size limit
	const ballotIds = ballots.map((b) => b.id);
	const votesByBallotId = new Map<string, VoteForResults[]>();
	for (const id of ballotIds) {
		votesByBallotId.set(id, []);
	}

	let cursor: string | undefined;
	do {
		const chunk = await db.vote.findMany({
			where: { electionId },
			select: { id: true, voteData: true, ballotId: true },
			take: VOTE_CHUNK_SIZE,
			...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
			orderBy: { id: "asc" },
		});

		for (const vote of chunk) {
			const list = votesByBallotId.get(vote.ballotId);
			if (list) {
				list.push({ id: vote.id, voteData: vote.voteData });
			}
		}

		cursor =
			chunk.length === VOTE_CHUNK_SIZE
				? chunk[chunk.length - 1]?.id
				: undefined;
	} while (cursor);

	const ballotsWithVotes: BallotWithCandidatesAndVotes[] = ballots.map(
		(ballot) => ({
			...ballot,
			votes: votesByBallotId.get(ballot.id) ?? [],
		}),
	);

	return {
		election,
		ballots: ballotsWithVotes,
		eligibleVotersCount,
		votedCount,
	};
}
