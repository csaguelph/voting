/**
 * Who performed an audited action. Entries written by different routers name
 * the actor differently, so check each convention in turn.
 */
export function getAuditActor(details: unknown): {
	email: string | null;
	role: string | null;
} {
	const d = (details ?? {}) as Record<string, unknown>;
	const email = [
		d.userEmail,
		d.performedByEmail,
		d.finalizedBy,
		d.publishedBy,
		d.unpublishedBy,
		d.generatedBy,
		d.exportedBy,
		d.drawnBy,
	].find((value): value is string => typeof value === "string" && value !== "");
	const role = typeof d.userRole === "string" ? d.userRole : null;
	return { email: email ?? null, role };
}
