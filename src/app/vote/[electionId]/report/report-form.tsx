"use client";

import { CheckCircle, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	type ReportDraft,
	ReportFields,
} from "@/components/voting/report-fields";
import {
	type PageReportSource,
	type ReportInput,
	reportError,
} from "@/lib/reports";
import { api } from "@/trpc/react";

export function ReportForm({
	electionId,
	electionName,
	source,
	defaultReason,
}: {
	electionId: string;
	electionName: string;
	source: PageReportSource;
	defaultReason: string;
}) {
	const [report, setReport] = useState<ReportDraft>({
		reason: defaultReason,
		details: "",
	});
	const [fieldError, setFieldError] =
		useState<ReturnType<typeof reportError>>(null);
	const reasonRef = useRef<HTMLSelectElement>(null);
	const detailsRef = useRef<HTMLTextAreaElement>(null);
	const sentRef = useRef<HTMLHeadingElement>(null);

	const fileReport = api.report.file.useMutation();
	const sent = fileReport.isSuccess;

	useEffect(() => {
		if (sent) sentRef.current?.focus();
	}, [sent]);

	// Warn before leaving with a report typed but not sent
	const dirty = report.details.trim() !== "" && !sent;
	useEffect(() => {
		if (!dirty) return;
		const warn = (e: BeforeUnloadEvent) => e.preventDefault();
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [dirty]);

	const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const problem = reportError(report);
		setFieldError(problem);
		if (problem) {
			(problem.field === "reason" ? reasonRef : detailsRef).current?.focus();
			return;
		}
		fileReport.mutate({
			electionId,
			source,
			report: {
				reason: report.reason as ReportInput["reason"],
				details: report.details.trim(),
			},
		});
	};

	if (sent) {
		return (
			<div className="mx-auto max-w-2xl rounded-lg border bg-card p-6">
				<h1
					ref={sentRef}
					tabIndex={-1}
					className="flex items-center gap-2 font-bold text-2xl outline-none"
				>
					<CheckCircle
						className="size-6 shrink-0 text-green-700"
						aria-hidden="true"
					/>
					Report Sent
				</h1>
				<p className="mt-2 text-muted-foreground">
					Thank you. The Chief Returning Officer will follow up with you at{" "}
					<strong className="break-all font-medium text-foreground">
						{fileReport.data.email}
					</strong>
					.
				</p>
				<Button asChild variant="outline" className="mt-6">
					<Link href="/dashboard">Back to Dashboard</Link>
				</Button>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<header>
				<h1 className="text-balance font-bold text-3xl">
					Report a Problem to the CRO
				</h1>
				<p className="mt-2 break-words text-muted-foreground">{electionName}</p>
			</header>

			<div className="space-y-3">
				<p>
					Tell the Chief Returning Officer (CRO) if someone else voted for you,
					asked for your phone or login, or pressured you while you voted.
				</p>
				<p>
					The CRO will see your name and email with this report, and may link
					your ballot to you while they investigate. They'll follow up with you.
				</p>
				<p className="text-muted-foreground text-sm">
					To report a candidate or volunteer for breaking other campaign rules,
					use the elections complaint form at{" "}
					<a
						href="https://csaonline.ca/elections-complaint"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4"
					>
						csaonline.ca/elections-complaint
						<ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
						<span className="sr-only">(opens in a new tab)</span>
					</a>
					.
				</p>
			</div>

			<form
				onSubmit={handleSubmit}
				noValidate
				className="space-y-6 rounded-lg border bg-card p-5 sm:p-6"
			>
				<ReportFields
					idPrefix="report"
					value={report}
					onChange={(value) => {
						setReport(value);
						if (fieldError) setFieldError(reportError(value));
					}}
					error={fieldError}
					reasonRef={reasonRef}
					detailsRef={detailsRef}
				/>

				{fileReport.isError && (
					<Alert variant="destructive" aria-live="polite">
						<AlertDescription>{fileReport.error.message}</AlertDescription>
					</Alert>
				)}

				<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
					<Button asChild type="button" variant="outline" className="h-11">
						<Link href="/dashboard">Cancel</Link>
					</Button>
					<Button
						type="submit"
						className="h-11"
						disabled={fileReport.isPending}
					>
						{fileReport.isPending && (
							<Loader2 className="size-4 animate-spin" aria-hidden="true" />
						)}
						Send Report
					</Button>
				</div>
			</form>
		</div>
	);
}
