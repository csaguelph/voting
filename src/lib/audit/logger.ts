import type { PrismaClient } from "@prisma/client";

/**
 * Audit log action types
 */
export const AuditAction = {
	// Election actions
	ELECTION_CREATED: "election.created",
	ELECTION_UPDATED: "election.updated",
	ELECTION_DELETED: "election.deleted",
	ELECTION_ACTIVATED: "election.activated",
	ELECTION_DEACTIVATED: "election.deactivated",

	// Voter actions
	VOTERS_IMPORTED: "voters.imported",
	VOTER_ADDED: "voter.added",
	VOTER_REMOVED: "voter.removed",
	VOTER_UPDATED: "voter.updated",

	// Ballot actions
	BALLOT_CREATED: "ballot.created",
	BALLOT_UPDATED: "ballot.updated",
	BALLOT_DELETED: "ballot.deleted",
	BALLOT_REORDERED: "ballot.reordered",

	// Candidate actions
	CANDIDATE_ADDED: "candidate.added",
	CANDIDATE_UPDATED: "candidate.updated",
	CANDIDATE_REMOVED: "candidate.removed",

	// Voting actions
	VOTE_CAST: "vote.cast",
	VOTE_VERIFIED: "vote.verified",

	// Results actions
	RESULTS_FINALIZED: "results.finalized",
	RESULTS_PUBLISHED: "results.published",
	RESULTS_UNPUBLISHED: "results.unpublished",
	RESULTS_EXPORTED: "results.exported",

	// Settings actions
	SETTINGS_UPDATED: "settings.updated",

	// Authentication actions
	AUTH_LOGIN: "auth.login",
	AUTH_LOGOUT: "auth.logout",
	AUTH_FAILED: "auth.failed",
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

/**
 * Log an audit event
 */
export async function logAudit(
	db: PrismaClient,
	params: {
		electionId: string;
		action: AuditActionType;
		userId?: string;
		userEmail?: string;
		userRole?: string;
		details?: Record<string, unknown>;
	},
): Promise<void> {
	try {
		await db.auditLog.create({
			data: {
				electionId: params.electionId,
				action: params.action,
				details: {
					userId: params.userId,
					userEmail: params.userEmail,
					userRole: params.userRole,
					...params.details,
				},
			},
		});
	} catch (error) {
		// Log to console if database logging fails, but don't throw
		// We don't want audit logging failures to break the main operation
		console.error("Failed to log audit event:", error);
	}
}

/**
 * Helper function to log election-related actions
 */
export async function logElectionAction(
	db: PrismaClient,
	electionId: string,
	action: AuditActionType,
	userId?: string,
	userEmail?: string,
	userRole?: string,
	details?: Record<string, unknown>,
): Promise<void> {
	await logAudit(db, {
		electionId,
		action,
		userId,
		userEmail,
		userRole,
		details,
	});
}

/**
 * Helper function to log voter-related actions
 */
export async function logVoterAction(
	db: PrismaClient,
	electionId: string,
	action: AuditActionType,
	userId?: string,
	userEmail?: string,
	userRole?: string,
	details?: Record<string, unknown>,
): Promise<void> {
	await logAudit(db, {
		electionId,
		action,
		userId,
		userEmail,
		userRole,
		details,
	});
}

/**
 * Helper function to log ballot-related actions
 */
export async function logBallotAction(
	db: PrismaClient,
	electionId: string,
	action: AuditActionType,
	userId?: string,
	userEmail?: string,
	userRole?: string,
	details?: Record<string, unknown>,
): Promise<void> {
	await logAudit(db, {
		electionId,
		action,
		userId,
		userEmail,
		userRole,
		details,
	});
}

/**
 * Helper function to log results-related actions
 */
export async function logResultsAction(
	db: PrismaClient,
	electionId: string,
	action: AuditActionType,
	userId?: string,
	userEmail?: string,
	userRole?: string,
	details?: Record<string, unknown>,
): Promise<void> {
	await logAudit(db, {
		electionId,
		action,
		userId,
		userEmail,
		userRole,
		details,
	});
}

/**
 * Helper function to get formatted action display name
 */
export function getActionDisplayName(action: string): string {
	return action
		.split(".")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

/**
 * Helper function to categorize actions
 */
export function getActionCategory(
	action: string,
):
	| "election"
	| "voter"
	| "ballot"
	| "candidate"
	| "vote"
	| "results"
	| "auth"
	| "settings" {
	if (action.startsWith("election.")) return "election";
	if (action.startsWith("voter")) return "voter";
	if (action.startsWith("ballot.")) return "ballot";
	if (action.startsWith("candidate.")) return "candidate";
	if (action.startsWith("vote.")) return "vote";
	if (action.startsWith("results.")) return "results";
	if (action.startsWith("auth.")) return "auth";
	if (action.startsWith("settings.")) return "settings";
	return "election";
}
