import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { AuditAction, logAudit } from "@/lib/audit/logger";
import {
	MAX_REPORTS_PER_VOTER,
	PAGE_REPORT_SOURCES,
	reportInput,
} from "@/lib/reports";
import {
	createTRPCRouter,
	croProcedure,
	protectedProcedure,
} from "@/server/api/trpc";

/**
 * Report router
 * Voters report problems with their own ballot to the CRO (e.g. someone else
 * voted for them). Reports are for investigation only, and only the CRO can
 * read them.
 */
export const reportRouter = createTRPCRouter({
	/**
	 * File a report about the current user's ballot in an election. Reports
	 * made while voting are filed by vote.castVotes instead.
	 */
	file: protectedProcedure
		.input(
			z.object({
				electionId: z.string(),
				source: z.enum(PAGE_REPORT_SOURCES),
				report: reportInput,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const email = ctx.session.user.email;
			if (!email) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "User email not found",
				});
			}

			const voter = await ctx.db.eligibleVoter.findUnique({
				where: {
					electionId_email: { electionId: input.electionId, email },
				},
				select: { id: true, firstName: true, lastName: true, email: true },
			});
			if (!voter) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You are not registered to vote in this election",
				});
			}

			const filed = await ctx.db.voterReport.count({
				where: { electionId: input.electionId, voterId: voter.id },
			});
			if (filed >= MAX_REPORTS_PER_VOTER) {
				throw new TRPCError({
					code: "TOO_MANY_REQUESTS",
					message:
						"You've already sent several reports for this election. The CRO will follow up with you about them.",
				});
			}

			const report = await ctx.db.voterReport.create({
				data: {
					electionId: input.electionId,
					voterId: voter.id,
					voterName: `${voter.firstName} ${voter.lastName}`,
					voterEmail: voter.email,
					reason: input.report.reason,
					details: input.report.details,
					source: input.source,
				},
			});

			// Not audit-logged: admins can read the audit log, and its timing
			// could tell them who reported. Only the CRO may know that.

			return { id: report.id, email: voter.email };
		}),

	/** Reports for the CRO, newest first */
	list: croProcedure
		.input(
			z.object({
				status: z.enum(["OPEN", "RESOLVED"]).optional(),
				electionId: z.string().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const where = {
				status: input.status,
				electionId: input.electionId,
			};
			const [reports, openCount] = await Promise.all([
				ctx.db.voterReport.findMany({
					where,
					orderBy: { createdAt: "desc" },
					include: { election: { select: { id: true, name: true } } },
				}),
				ctx.db.voterReport.count({
					where: { electionId: input.electionId, status: "OPEN" },
				}),
			]);
			return { reports, openCount };
		}),

	/** Mark a report resolved once the CRO has followed up, or reopen it */
	setStatus: croProcedure
		.input(
			z.object({
				id: z.string(),
				status: z.enum(["OPEN", "RESOLVED"]),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const existing = await ctx.db.voterReport.findUnique({
				where: { id: input.id },
				select: { electionId: true },
			});
			if (!existing) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Report not found",
				});
			}

			const resolved = input.status === "RESOLVED";
			const report = await ctx.db.voterReport.update({
				where: { id: input.id },
				data: {
					status: input.status,
					resolvedAt: resolved ? new Date() : null,
					resolvedById: resolved ? ctx.session.user.id : null,
					resolvedByEmail: resolved ? ctx.session.user.email : null,
				},
			});

			await logAudit(ctx.db, {
				electionId: existing.electionId,
				action: resolved
					? AuditAction.REPORT_RESOLVED
					: AuditAction.REPORT_REOPENED,
				userId: ctx.session.user.id,
				userEmail: ctx.session.user.email ?? undefined,
				userRole: ctx.session.user.role,
				details: { reportId: report.id },
			});

			return report;
		}),
});
