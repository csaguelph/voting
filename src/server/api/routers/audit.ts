import { z } from "zod";
import {
	getActionCategory,
	getActionDisplayName,
} from "../../../lib/audit/logger";
import { adminProcedure, createTRPCRouter } from "../trpc";

export const auditRouter = createTRPCRouter({
	/**
	 * Get audit logs with filtering
	 */
	getAuditLogs: adminProcedure
		.input(
			z.object({
				electionId: z.string().optional(),
				action: z.string().optional(),
				search: z.string().optional(),
				startDate: z.date().optional(),
				endDate: z.date().optional(),
				limit: z.number().min(1).max(100).default(50),
				offset: z.number().min(0).default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			const where: {
				electionId?: string;
				action?: string;
				timestamp?: {
					gte?: Date;
					lte?: Date;
				};
				OR?: Array<{
					action?: { contains: string; mode: "insensitive" };
					details?: { string_contains: string };
				}>;
			} = {};

			if (input.electionId) {
				where.electionId = input.electionId;
			}

			if (input.action) {
				where.action = input.action;
			}

			if (input.startDate || input.endDate) {
				where.timestamp = {};
				if (input.startDate) {
					where.timestamp.gte = input.startDate;
				}
				if (input.endDate) {
					where.timestamp.lte = input.endDate;
				}
			}

			if (input.search) {
				where.OR = [
					{ action: { contains: input.search, mode: "insensitive" } },
				];
			}

			const [logs, total] = await Promise.all([
				ctx.db.auditLog.findMany({
					where,
					orderBy: { timestamp: "desc" },
					take: input.limit,
					skip: input.offset,
					include: {
						election: {
							select: {
								name: true,
							},
						},
					},
				}),
				ctx.db.auditLog.count({ where }),
			]);

			return {
				logs: logs.map((log) => ({
					...log,
					displayName: getActionDisplayName(log.action),
					category: getActionCategory(log.action),
				})),
				total,
				hasMore: input.offset + logs.length < total,
			};
		}),

	/**
	 * Get audit logs for a specific election
	 */
	getAuditLogsByElection: adminProcedure
		.input(
			z.object({
				electionId: z.string(),
				limit: z.number().min(1).max(100).default(50),
				offset: z.number().min(0).default(0),
			}),
		)
		.query(async ({ ctx, input }) => {
			const [logs, total] = await Promise.all([
				ctx.db.auditLog.findMany({
					where: { electionId: input.electionId },
					orderBy: { timestamp: "desc" },
					take: input.limit,
					skip: input.offset,
				}),
				ctx.db.auditLog.count({ where: { electionId: input.electionId } }),
			]);

			return {
				logs: logs.map((log) => ({
					...log,
					displayName: getActionDisplayName(log.action),
					category: getActionCategory(log.action),
				})),
				total,
				hasMore: input.offset + logs.length < total,
			};
		}),

	/**
	 * Get unique action types (for filter dropdown)
	 */
	getActionTypes: adminProcedure.query(async ({ ctx }) => {
		const actions = await ctx.db.auditLog.findMany({
			select: { action: true },
			distinct: ["action"],
			orderBy: { action: "asc" },
		});

		return actions.map((a) => ({
			value: a.action,
			label: getActionDisplayName(a.action),
			category: getActionCategory(a.action),
		}));
	}),

	/**
	 * Export audit logs as CSV
	 */
	exportAuditLogs: adminProcedure
		.input(
			z.object({
				electionId: z.string().optional(),
				action: z.string().optional(),
				startDate: z.date().optional(),
				endDate: z.date().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const where: {
				electionId?: string;
				action?: string;
				timestamp?: {
					gte?: Date;
					lte?: Date;
				};
			} = {};

			if (input.electionId) {
				where.electionId = input.electionId;
			}

			if (input.action) {
				where.action = input.action;
			}

			if (input.startDate || input.endDate) {
				where.timestamp = {};
				if (input.startDate) {
					where.timestamp.gte = input.startDate;
				}
				if (input.endDate) {
					where.timestamp.lte = input.endDate;
				}
			}

			const logs = await ctx.db.auditLog.findMany({
				where,
				orderBy: { timestamp: "desc" },
				include: {
					election: {
						select: {
							name: true,
						},
					},
				},
			});

			// Format as CSV
			const headers = [
				"Timestamp",
				"Election",
				"Action",
				"User Email",
				"User Role",
				"Details",
			];

			const rows = logs.map((log) => {
				const details = log.details as Record<string, unknown>;
				return [
					log.timestamp.toISOString(),
					log.election.name,
					log.action,
					details.userEmail ?? "",
					details.userRole ?? "",
					JSON.stringify(details),
				];
			});

			const csv = [
				headers.join(","),
				...rows.map((row) =>
					row
						.map((cell) =>
							typeof cell === "string" && cell.includes(",")
								? `"${cell.replace(/"/g, '""')}"`
								: cell,
						)
						.join(","),
				),
			].join("\n");

			return {
				csv,
				filename: `audit-logs-${new Date().toISOString().split("T")[0]}.csv`,
			};
		}),
});
