import type { Ballot, Candidate } from "@prisma/client";
import type {
	TieBreakDrawForResults,
	VoteForResults,
} from "@/lib/results/calculator";

export type BallotWithResultsData = Ballot & {
	candidates: Candidate[];
	votes: VoteForResults[];
	tieBreakDraws?: TieBreakDrawForResults[];
};

const epoch = new Date("2026-01-01T00:00:00Z");
let sequence = 0;

export function candidate(
	id: string,
	overrides: Partial<Candidate> = {},
): Candidate {
	return {
		id,
		ballotId: "ballot",
		name: id,
		statement: null,
		status: "ACTIVE",
		statusReason: null,
		createdAt: epoch,
		updatedAt: epoch,
		...overrides,
	};
}

export function ballot(
	overrides: Partial<BallotWithResultsData> = {},
): BallotWithResultsData {
	return {
		id: `ballot-${sequence++}`,
		electionId: "election",
		title: "President",
		type: "EXECUTIVE",
		college: null,
		seatsAvailable: 1,
		order: 0,
		preamble: null,
		question: null,
		sponsor: null,
		createdAt: epoch,
		updatedAt: epoch,
		candidates: [],
		votes: [],
		...overrides,
	};
}

/** `count` votes with the same vote data */
export function votes(count: number, voteData: unknown): VoteForResults[] {
	return Array.from({ length: count }, () => ({
		id: `vote-${sequence++}`,
		voteData: voteData as VoteForResults["voteData"],
	}));
}

export const ranked = (...rankings: string[]) => ({ type: "RANKED", rankings });
export const YES = { type: "YES" };
export const NO = { type: "NO" };
export const ABSTAIN = { type: "ABSTAIN" };
