import { z } from "zod";

/**
 * Voters' reports to the CRO about their own ballot (someone else voted for
 * them, pressured them, …). Shared by the forms and the API.
 */

export const REPORT_REASONS = [
	{
		value: "SOMEONE_ELSE_VOTED",
		label: "Someone else voted for me",
	},
	{
		value: "ASKED_FOR_ACCESS",
		label: "Someone asked for my phone or login",
	},
	{ value: "PRESSURED", label: "Someone pressured or watched me" },
	{ value: "OTHER", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export const REPORT_REASON_LABELS = Object.fromEntries(
	REPORT_REASONS.map((r) => [r.value, r.label]),
) as Record<ReportReason, string>;

export const REPORT_SOURCE_LABELS = {
	SUBMISSION: "When submitting their ballot",
	RECEIPT: "From their receipt",
	ALREADY_VOTED: "From the “already voted” page",
	DASHBOARD: "From their dashboard",
} as const;

/** Reports filed from a page (reports made while voting come with the ballot) */
export const PAGE_REPORT_SOURCES = [
	"RECEIPT",
	"ALREADY_VOTED",
	"DASHBOARD",
] as const;
export type PageReportSource = (typeof PAGE_REPORT_SOURCES)[number];

export const REPORT_DETAILS_MAX = 1000;

/** Reports one voter can file per election, to stop the CRO being flooded */
export const MAX_REPORTS_PER_VOTER = 5;

export const reportInput = z
	.object({
		reason: z.enum(
			REPORT_REASONS.map((r) => r.value) as [ReportReason, ...ReportReason[]],
		),
		details: z.string().trim().max(REPORT_DETAILS_MAX),
	})
	.refine((r) => r.reason !== "OTHER" || r.details.length > 0, {
		message: "Tell the CRO what happened.",
		path: ["details"],
	});

export type ReportInput = z.infer<typeof reportInput>;

/** The first problem with a report, worded for the voter, or null if it's fine */
export function reportError(report: {
	reason: string;
	details: string;
}): { field: "reason" | "details"; message: string } | null {
	if (!report.reason) {
		return { field: "reason", message: "Choose what happened." };
	}
	const details = report.details.trim();
	if (report.reason === "OTHER" && !details) {
		return { field: "details", message: "Tell the CRO what happened." };
	}
	if (details.length > REPORT_DETAILS_MAX) {
		return {
			field: "details",
			message: `Keep it under ${REPORT_DETAILS_MAX.toLocaleString("en-CA")} characters.`,
		};
	}
	return null;
}
