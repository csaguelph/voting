import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Before the ballot opens, voters re-enter their student ID. It's a deterrent
 * against someone else voting on a borrowed phone, not authentication: the
 * Microsoft sign-in already proved who owns the account.
 */

/** Wrong entries allowed before the ballot locks */
export const MAX_IDENTITY_ATTEMPTS = 5;

/** How long the ballot stays locked after too many wrong entries */
export const IDENTITY_LOCKOUT_MS = 30 * 60 * 1000;

/** How long a correct entry keeps the ballot open */
export const IDENTITY_CONFIRMATION_MS = 60 * 60 * 1000;

/**
 * Compare student IDs the way a person would: ignore spaces, dashes and
 * leading zeros (spreadsheets often drop them from the voters list)
 */
export function normalizeStudentId(studentId: string): string {
	const compact = studentId.replace(/[\s-]/g, "");
	return /^\d+$/.test(compact) ? compact.replace(/^0+(?=\d)/, "") : compact;
}

export function studentIdsMatch(entered: string, actual: string): boolean {
	const digest = (s: string) =>
		createHash("sha256").update(normalizeStudentId(s)).digest();
	return timingSafeEqual(digest(entered), digest(actual));
}

interface IdentityState {
	identityConfirmedAt: Date | null;
	identityLockedUntil: Date | null;
}

export function isIdentityConfirmed(voter: IdentityState, now: Date): boolean {
	return (
		voter.identityConfirmedAt !== null &&
		now.getTime() - voter.identityConfirmedAt.getTime() <
			IDENTITY_CONFIRMATION_MS
	);
}

/** When the lockout ends, or null if the voter isn't locked out */
export function identityLockedUntil(
	voter: IdentityState,
	now: Date,
): Date | null {
	return voter.identityLockedUntil && voter.identityLockedUntil > now
		? voter.identityLockedUntil
		: null;
}
