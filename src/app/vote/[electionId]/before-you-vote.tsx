"use client";

import { ExternalLink, Loader2, Lock, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTimeInAppTz } from "@/lib/datetime";
import { api } from "@/trpc/react";

export const COMPLAINT_URL = "https://csaonline.ca/elections-complaint";

/** Minimum time on the notice before the ballot can be opened */
const READ_SECONDS = 5;

function ComplaintLink() {
	return (
		<a
			href={COMPLAINT_URL}
			target="_blank"
			rel="noopener noreferrer"
			className="inline-flex items-center gap-1 break-all font-medium underline underline-offset-4 hover:decoration-2"
		>
			csaonline.ca/elections-complaint
			<ExternalLink className="size-4 shrink-0" aria-hidden="true" />
			<span className="sr-only">(opens in a new tab)</span>
		</a>
	);
}

/**
 * Shown before the ballot: the campaign rules, then the voter re-enters their
 * student ID. Meant to make anyone voting on someone else's phone think twice.
 */
export function BeforeYouVote({
	electionId,
	voterName,
	lockedUntil: initialLockedUntil,
}: {
	electionId: string;
	voterName: string;
	lockedUntil: Date | null;
}) {
	const router = useRouter();
	const inputRef = useRef<HTMLInputElement>(null);
	const lockedRef = useRef<HTMLDivElement>(null);
	const [secondsLeft, setSecondsLeft] = useState(READ_SECONDS);
	const [lockedUntil, setLockedUntil] = useState(initialLockedUntil);
	const [error, setError] = useState<string | null>(null);
	const [confirmed, setConfirmed] = useState(false);
	// Move focus to the lockout message once it renders
	const focusLockout = useRef(false);

	useEffect(() => {
		if (secondsLeft <= 0) return;
		const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
		return () => clearTimeout(timer);
	}, [secondsLeft]);

	// Unlock once the lockout ends, without a reload
	useEffect(() => {
		if (!lockedUntil) return;
		const timer = setTimeout(
			() => setLockedUntil(null),
			Math.max(0, new Date(lockedUntil).getTime() - Date.now()),
		);
		return () => clearTimeout(timer);
	}, [lockedUntil]);

	useEffect(() => {
		if (lockedUntil && focusLockout.current) {
			focusLockout.current = false;
			lockedRef.current?.focus();
		}
	}, [lockedUntil]);

	const confirmIdentity = api.vote.confirmIdentity.useMutation({
		onSuccess: (result) => {
			if (result.status === "confirmed") {
				setConfirmed(true);
				// The page re-renders with the ballot
				router.refresh();
				return;
			}
			if (result.status === "locked") {
				setError(null);
				focusLockout.current = true;
				setLockedUntil(result.lockedUntil);
				return;
			}
			setError(
				`That student ID doesn't match this account. ${result.attemptsLeft} ${
					result.attemptsLeft === 1 ? "attempt" : "attempts"
				} left.`,
			);
			inputRef.current?.focus();
			inputRef.current?.select();
		},
		onError: (e) => {
			setError(e.message);
			inputRef.current?.focus();
		},
	});

	const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const studentId = inputRef.current?.value.trim() ?? "";
		if (!studentId) {
			setError("Enter your student ID.");
			inputRef.current?.focus();
			return;
		}
		setError(null);
		confirmIdentity.mutate({ electionId, studentId });
	};

	const busy = confirmIdentity.isPending || confirmed;

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<header>
				<h1 className="font-bold text-3xl">Before You Vote</h1>
				<p className="mt-2 text-muted-foreground">
					Voting as{" "}
					<strong className="break-words font-semibold text-foreground">
						{voterName}
					</strong>
				</p>
			</header>

			<section
				aria-labelledby="campaign-rules-heading"
				className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-950 sm:p-6"
			>
				<div className="flex flex-col gap-4 sm:flex-row">
					<span
						className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700"
						aria-hidden="true"
					>
						<TriangleAlert className="size-8 origin-bottom motion-safe:animate-attention" />
					</span>
					<div className="min-w-0 space-y-3">
						<h2
							id="campaign-rules-heading"
							className="text-balance font-semibold text-xl"
						>
							Only you can fill out your ballot
						</h2>
						<p>
							Nobody else may fill out this ballot on your behalf. Not a friend,
							not a candidate, not a campaign volunteer. If someone asks for
							your phone so they can vote for you, say no.
						</p>
						<p>
							Candidates and their volunteers must follow the campaign rules. To
							report someone for breaking them, fill out the elections complaint
							form at <ComplaintLink />
						</p>
					</div>
				</div>
			</section>

			{lockedUntil ? (
				<div
					ref={lockedRef}
					tabIndex={-1}
					role="alert"
					aria-labelledby="locked-heading"
					className="rounded-lg border border-destructive/50 bg-destructive/10 p-5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:p-6"
				>
					<h2
						id="locked-heading"
						className="flex items-center gap-2 font-semibold text-destructive text-xl"
					>
						<Lock className="size-5 shrink-0" aria-hidden="true" />
						Ballot locked for your security
					</h2>
					<p className="mt-2">
						There were too many incorrect student ID attempts on this account,
						so voting is paused until{" "}
						<strong className="tabular-nums">
							{formatTimeInAppTz(lockedUntil)}
						</strong>
						. This protects your vote if someone else has your phone.
					</p>
					<p className="mt-2">
						If someone was trying to vote as you, report it at <ComplaintLink />
					</p>
				</div>
			) : (
				<section
					aria-labelledby="confirm-identity-heading"
					className="rounded-lg border bg-card p-5 sm:p-6"
				>
					<h2 id="confirm-identity-heading" className="font-semibold text-xl">
						Confirm it's you
					</h2>
					<form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
						<div className="space-y-2">
							<Label htmlFor="student-id">Student ID</Label>
							<p id="student-id-hint" className="text-muted-foreground text-sm">
								It's on your student card.
							</p>
							<Input
								ref={inputRef}
								id="student-id"
								name="studentId"
								type="text"
								inputMode="numeric"
								autoComplete="off"
								autoCapitalize="none"
								autoCorrect="off"
								spellCheck={false}
								placeholder="1234567…"
								maxLength={64}
								aria-invalid={error ? true : undefined}
								aria-describedby={
									error ? "student-id-hint student-id-error" : "student-id-hint"
								}
								className="h-11 max-w-xs font-mono text-lg tabular-nums md:text-lg"
							/>
							<p
								id="student-id-error"
								aria-live="polite"
								className="text-destructive text-sm empty:hidden"
							>
								{error}
							</p>
						</div>
						<Button
							type="submit"
							size="lg"
							className="h-11 w-full sm:w-auto"
							disabled={secondsLeft > 0 || busy}
						>
							{busy && (
								<Loader2 className="size-4 animate-spin" aria-hidden="true" />
							)}
							Continue to Ballot
							{secondsLeft > 0 && (
								<span className="tabular-nums" aria-hidden="true">
									({secondsLeft})
								</span>
							)}
						</Button>
						{secondsLeft > 0 && (
							<p className="text-muted-foreground text-sm">
								Take a moment to read the notice above.
							</p>
						)}
					</form>
				</section>
			)}
		</div>
	);
}
