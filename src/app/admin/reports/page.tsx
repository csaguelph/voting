import { Mail } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCRO } from "@/lib/auth/permissions";
import { formatInAppTz } from "@/lib/datetime";
import { REPORT_REASON_LABELS, REPORT_SOURCE_LABELS } from "@/lib/reports";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/server";
import { ReportStatusButton } from "./report-status-button";

const FILTERS = [
	{ value: "open", label: "Open", status: "OPEN" },
	{ value: "resolved", label: "Resolved", status: "RESOLVED" },
	{ value: "all", label: "All", status: undefined },
] as const;

/**
 * Voters' reports about their own ballots (e.g. someone else voted for them),
 * for the CRO to follow up on. CRO only: reports name the voter.
 */
export default async function ReportsPage({
	searchParams,
}: {
	searchParams: Promise<{ status?: string }>;
}) {
	await requireCRO();
	const { status } = await searchParams;
	const filter = FILTERS.find((f) => f.value === status) ?? FILTERS[0];
	const { reports, openCount } = await api.report.list({
		status: filter.status,
	});

	return (
		<div className="container mx-auto space-y-6 p-6">
			<div>
				<h1 className="mb-2 font-bold text-4xl">Voter Reports</h1>
				<p className="text-muted-foreground">
					Students reporting a problem with their own ballot, such as someone
					else voting for them. Follow up with each student by email. Reports
					are for investigation only and never change the count.
				</p>
			</div>

			<nav aria-label="Filter reports" className="flex flex-wrap gap-2">
				{FILTERS.map((f) => (
					<Link
						key={f.value}
						href={`/admin/reports?status=${f.value}`}
						aria-current={f === filter ? "page" : undefined}
						className={cn(
							"inline-flex h-9 items-center gap-2 rounded-md border px-4 font-medium text-sm",
							f === filter
								? "border-primary bg-primary text-primary-foreground"
								: "bg-white hover:bg-accent",
						)}
					>
						{f.label}
						{f.value === "open" && (
							<span className="tabular-nums">({openCount})</span>
						)}
					</Link>
				))}
			</nav>

			{reports.length === 0 ? (
				<Card>
					<CardContent className="py-10 text-center text-muted-foreground">
						{filter.value === "open"
							? "No open reports."
							: filter.value === "resolved"
								? "No resolved reports yet."
								: "No reports yet."}
					</CardContent>
				</Card>
			) : (
				<ul className="space-y-4">
					{reports.map((report) => (
						<li key={report.id}>
							<Card>
								<CardHeader className="gap-3">
									<div className="flex flex-wrap items-start justify-between gap-3">
										<CardTitle className="min-w-0 text-lg">
											<h2>{REPORT_REASON_LABELS[report.reason]}</h2>
										</CardTitle>
										<Badge
											variant="secondary"
											className={
												report.status === "OPEN"
													? "bg-amber-100 text-amber-800"
													: "bg-green-100 text-green-700"
											}
										>
											{report.status === "OPEN" ? "Open" : "Resolved"}
										</Badge>
									</div>
									<p className="text-muted-foreground text-sm">
										<span className="tabular-nums">
											{formatInAppTz(report.createdAt)}
										</span>{" "}
										· {report.election.name} ·{" "}
										{REPORT_SOURCE_LABELS[report.source]}
									</p>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
										<span className="font-medium">{report.voterName}</span>
										<a
											href={`mailto:${report.voterEmail}`}
											className="inline-flex min-w-0 items-center gap-1 break-all text-sm underline underline-offset-4"
										>
											<Mail className="size-4 shrink-0" aria-hidden="true" />
											{report.voterEmail}
										</a>
									</div>
									{report.details ? (
										<p className="whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-sm">
											{report.details}
										</p>
									) : (
										<p className="text-muted-foreground text-sm italic">
											No details given.
										</p>
									)}
									<div className="flex flex-wrap items-center justify-between gap-3">
										<p className="text-muted-foreground text-sm">
											{report.status === "RESOLVED" && report.resolvedAt
												? `Resolved ${formatInAppTz(report.resolvedAt)}${
														report.resolvedByEmail
															? ` by ${report.resolvedByEmail}`
															: ""
													}`
												: null}
										</p>
										<ReportStatusButton id={report.id} status={report.status} />
									</div>
								</CardContent>
							</Card>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
