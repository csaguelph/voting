import { createHmac, randomBytes, randomUUID } from "node:crypto";
import {
	type BallotType,
	type CandidateStatus,
	PrismaClient,
	type UserRole,
} from "@prisma/client";
import { fieldEncryptionExtension } from "prisma-field-encryption";
import {
	E2E_DATABASE_URL,
	E2E_ENCRYPTION_KEY,
	E2E_VOTE_HASH_SECRET,
} from "./env";

/** Same encryption as the app, so seeded voters decrypt in the browser */
export const db = new PrismaClient({
	datasourceUrl: E2E_DATABASE_URL,
}).$extends(fieldEncryptionExtension({ encryptionKey: E2E_ENCRYPTION_KEY }));

const HOUR = 60 * 60 * 1000;

/** A short suffix that keeps names unique across parallel tests */
export const uniqueId = () => randomUUID().slice(0, 8);

export async function createUser(role: UserRole, email?: string) {
	const id = uniqueId();
	return db.user.create({
		data: {
			email: email ?? `${role.toLowerCase()}-${id}@uoguelph.ca`,
			name: `E2E ${role} ${id}`,
			role,
		},
	});
}

/** A database session, as NextAuth creates after a Microsoft sign-in */
export async function createSession(userId: string) {
	const sessionToken = randomBytes(32).toString("hex");
	await db.session.create({
		data: {
			sessionToken,
			userId,
			expires: new Date(Date.now() + 24 * HOUR),
		},
	});
	return sessionToken;
}

/** An election open for voting right now, unless overridden */
export function createElection(
	overrides: Partial<{
		name: string;
		description: string;
		startTime: Date;
		endTime: Date;
		isActive: boolean;
		isFinalized: boolean;
		isPublished: boolean;
	}> = {},
) {
	return db.election.create({
		data: {
			name: `E2E Election ${uniqueId()}`,
			startTime: new Date(Date.now() - HOUR),
			endTime: new Date(Date.now() + HOUR),
			isActive: true,
			...overrides,
		},
	});
}

export async function createBallot(
	electionId: string,
	options: {
		type?: BallotType;
		title?: string;
		college?: string;
		seatsAvailable?: number;
		question?: string;
		order?: number;
		candidates?: Array<string | { name: string; status: CandidateStatus }>;
	} = {},
) {
	const { candidates = [], type = "EXECUTIVE", ...ballot } = options;
	return db.ballot
		.create({
			data: {
				electionId,
				type,
				title: ballot.title ?? `${type} ballot`,
				college: ballot.college,
				seatsAvailable: ballot.seatsAvailable ?? 1,
				order: ballot.order ?? 0,
				question:
					ballot.question ??
					(type === "REFERENDUM" ? "Do you agree?" : undefined),
			},
		})
		.then(async (created) => {
			// One at a time so creation order (the display order) is stable
			const rows = [];
			for (const c of candidates) {
				rows.push(
					await db.candidate.create({
						data: {
							ballotId: created.id,
							...(typeof c === "string" ? { name: c } : c),
						},
					}),
				);
			}
			return { ...created, candidates: rows };
		});
}

const hashStudentId = (studentId: string) =>
	createHmac("sha256", E2E_VOTE_HASH_SECRET).update(studentId).digest("hex");

/** Add a voter to an election's roll (student ID is encrypted at rest) */
export function enrollVoter(
	electionId: string,
	options: {
		email: string;
		college?: string;
		studentId?: string;
		firstName?: string;
		lastName?: string;
		hasVoted?: boolean;
	},
) {
	const studentId =
		options.studentId ?? `${1_000_000 + Math.floor(Math.random() * 8_999_999)}`;
	return db.eligibleVoter.create({
		data: {
			electionId,
			email: options.email,
			studentId,
			studentIdHash: hashStudentId(studentId),
			firstName: options.firstName ?? "Test",
			lastName: options.lastName ?? "Voter",
			college: options.college ?? "COE",
			hasVoted: options.hasVoted ?? false,
			votedAt: options.hasVoted ? new Date() : null,
		},
	});
}

type VoteData =
	| { type: "YES" | "NO" | "ABSTAIN" }
	| { type: "RANKED"; rankings: string[] };

/**
 * Votes inserted directly, for tests about counting rather than casting.
 * The hashes are random: these votes aren't meant to be verified.
 */
export async function seedVotes(
	electionId: string,
	ballotId: string,
	votes: VoteData[],
) {
	await db.vote.createMany({
		data: votes.map((voteData) => ({
			electionId,
			ballotId,
			voteData,
			voteHash: randomBytes(32).toString("hex"),
		})),
	});
}

/** Ranked votes, each a list of candidate ids in order of preference */
export const ranked = (...rankings: string[][]): VoteData[] =>
	rankings.map((r) => ({ type: "RANKED", rankings: r }));
