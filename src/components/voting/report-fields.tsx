"use client";

import type { KeyboardEvent, Ref } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { REPORT_DETAILS_MAX, REPORT_REASONS } from "@/lib/reports";
import { cn } from "@/lib/utils";

export interface ReportDraft {
	reason: string;
	details: string;
}

export const EMPTY_REPORT: ReportDraft = { reason: "", details: "" };

/**
 * What happened and a short description, for a report to the CRO. The parent
 * owns the form, validation (see `reportError`) and submission.
 */
export function ReportFields({
	idPrefix,
	value,
	onChange,
	error,
	reasonRef,
	detailsRef,
}: {
	idPrefix: string;
	value: ReportDraft;
	onChange: (value: ReportDraft) => void;
	error: { field: "reason" | "details"; message: string } | null;
	reasonRef?: Ref<HTMLSelectElement>;
	detailsRef?: Ref<HTMLTextAreaElement>;
}) {
	const reasonId = `${idPrefix}-reason`;
	const detailsId = `${idPrefix}-details`;
	const errorId = (field: "reason" | "details") =>
		error?.field === field ? `${idPrefix}-${field}-error` : undefined;
	const length = value.details.trim().length;
	const detailsOptional = value.reason !== "OTHER";

	// ⌘/Ctrl+Enter submits, as in a single-line field
	const submitOnModEnter = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			e.currentTarget.form?.requestSubmit();
		}
	};

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor={reasonId}>What happened?</Label>
				<select
					ref={reasonRef}
					id={reasonId}
					name="reason"
					value={value.reason}
					onChange={(e) => onChange({ ...value, reason: e.target.value })}
					aria-invalid={errorId("reason") ? true : undefined}
					aria-describedby={errorId("reason")}
					className="h-11 w-full min-w-0 rounded-md border border-input bg-white px-3 text-base text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive"
				>
					<option value="" disabled>
						Choose one…
					</option>
					{REPORT_REASONS.map((r) => (
						<option key={r.value} value={r.value}>
							{r.label}
						</option>
					))}
				</select>
				{errorId("reason") && (
					<p
						id={errorId("reason")}
						className="text-destructive text-sm"
						aria-live="polite"
					>
						{error?.message}
					</p>
				)}
			</div>

			<div className="space-y-2">
				<div className="flex items-baseline justify-between gap-2">
					<Label htmlFor={detailsId}>
						Tell the CRO more
						{detailsOptional && (
							<span className="font-normal text-muted-foreground">
								{" "}
								(optional)
							</span>
						)}
					</Label>
					<span
						className={cn(
							"text-muted-foreground text-xs tabular-nums",
							length > REPORT_DETAILS_MAX && "text-destructive",
						)}
						aria-hidden="true"
					>
						{length.toLocaleString("en-CA")}/
						{REPORT_DETAILS_MAX.toLocaleString("en-CA")}
					</span>
				</div>
				<Textarea
					ref={detailsRef}
					id={detailsId}
					name="details"
					rows={3}
					value={value.details}
					onChange={(e) => onChange({ ...value, details: e.target.value })}
					onKeyDown={submitOnModEnter}
					placeholder="Who was involved, and when…"
					aria-invalid={errorId("details") ? true : undefined}
					aria-describedby={errorId("details")}
					className="min-h-20 text-base md:text-base"
				/>
				{errorId("details") && (
					<p
						id={errorId("details")}
						className="text-destructive text-sm"
						aria-live="polite"
					>
						{error?.message}
					</p>
				)}
			</div>
		</div>
	);
}
