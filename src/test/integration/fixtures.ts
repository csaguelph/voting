import type { BallotType, CandidateStatus } from "@prisma/client";
import { hashStudentId } from "@/lib/voting/hash";
import { db } from "@/server/db";

const HOUR = 60 * 60 * 1000;

/** An election that is open for voting right now, unless overridden */
export function createElection(
	overrides: Partial<{
		name: string;
		startTime: Date;
		endTime: Date;
		isActive: boolean;
		isFinalized: boolean;
		isPublished: boolean;
	}> = {},
) {
	return db.election.create({
		data: {
			name: "Test Election",
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
		candidates?: Array<string | { name: string; status: CandidateStatus }>;
	} = {},
) {
	const { candidates = [], ...ballot } = options;
	return db.ballot.create({
		data: {
			electionId,
			type: ballot.type ?? "EXECUTIVE",
			title: ballot.title ?? `${ballot.type ?? "EXECUTIVE"} ballot`,
			college: ballot.college,
			seatsAvailable: ballot.seatsAvailable ?? 1,
			question:
				ballot.question ??
				(ballot.type === "REFERENDUM" ? "Do you agree?" : undefined),
			candidates: {
				create: candidates.map((c) =>
					typeof c === "string" ? { name: c } : c,
				),
			},
		},
		// Candidates created together can share a timestamp; ids keep the order
		include: {
			candidates: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
		},
	});
}

let voterCount = 0;

/** Add a voter to an election's roll (student ID is encrypted at rest) */
export function enrollVoter(
	electionId: string,
	options: {
		email: string;
		college?: string;
		studentId?: string;
	},
) {
	const studentId = options.studentId ?? `${1_000_000 + ++voterCount}`;
	return db.eligibleVoter.create({
		data: {
			electionId,
			email: options.email,
			studentId,
			studentIdHash: hashStudentId(studentId),
			firstName: "Test",
			lastName: "Voter",
			college: options.college ?? "COE",
		},
	});
}
