"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useVoting } from "@/contexts/voting-context";
import { api } from "@/trpc/react";
import { AlertCircle, ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export function ReviewPage({
	ballots,
}: {
	ballots: {
		id: string;
		title: string;
		type: "EXECUTIVE" | "DIRECTOR" | "REFERENDUM";
		college: string | null;
		seatsAvailable: number;
		preamble: string | null;
		question: string | null;
		sponsor: string | null;
		candidates: {
			id: string;
			name: string;
			statement: string | null;
		}[];
	}[];
}) {
	const router = useRouter();
	const params = useParams();
	const electionId = params.electionId as string;
	const { getAllSelections, clearAllSelections } = useVoting();
	const [showConfirmDialog, setShowConfirmDialog] = useState(false);

	const selections = getAllSelections();

	const castVotesMutation = api.vote.castVotes.useMutation({
		onSuccess: (data) => {
			clearAllSelections();
			// Create ballot titles mapping
			const ballotTitles = Object.fromEntries(
				ballots.map((b) => [b.id, b.title]),
			);
			// Store vote hashes and ballot titles in sessionStorage for receipt
			sessionStorage.setItem(
				`receipt-${electionId}`,
				JSON.stringify({
					votedAt: data.votedAt,
					voteCount: data.voteCount,
					votes: data.votes,
					ballotTitles,
				}),
			);
			router.push(`/vote/${electionId}/receipt`);
		},
		onError: (error) => {
			console.error("Error casting votes:", error);
		},
	});

	const handleSubmit = () => {
		setShowConfirmDialog(true);
	};

	const handleConfirm = () => {
		type VoteSubmission = {
			ballotId: string;
			candidateId: string | null;
			voteType: "CANDIDATE" | "APPROVE" | "OPPOSE" | "ABSTAIN" | "YES" | "NO";
		};

		const votes: VoteSubmission[] = selections
			.flatMap((selection) => {
				const ballot = ballots.find((b) => b.id === selection.ballotId);
				if (!ballot) return [];

				// Skip ABSTAIN votes - they shouldn't be recorded in the database
				if (
					selection.candidateIds[0] === "ABSTAIN" ||
					selection.referendumVote === "ABSTAIN"
				) {
					return [];
				}

				// Handle referendum votes
				if (selection.referendumVote) {
					return [
						{
							ballotId: selection.ballotId,
							candidateId: null,
							voteType: selection.referendumVote as "YES" | "NO",
						},
					];
				}

				// Handle OPPOSE vote (single candidate)
				if (selection.candidateIds[0] === "OPPOSE") {
					const candidateId = ballot.candidates[0]?.id;
					return [
						{
							ballotId: selection.ballotId,
							candidateId: candidateId || null,
							voteType: "OPPOSE" as const,
						},
					];
				}

				// Handle APPROVE vote (single candidate)
				if (ballot.candidates.length === 1 && selection.candidateIds[0]) {
					return [
						{
							ballotId: selection.ballotId,
							candidateId: selection.candidateIds[0],
							voteType: "APPROVE" as const,
						},
					];
				}

				// Handle multi-candidate selections (returns multiple votes for multi-seat)
				return selection.candidateIds.map(
					(candidateId): VoteSubmission => ({
						ballotId: selection.ballotId,
						candidateId,
						voteType: "CANDIDATE" as const,
					}),
				);
			})
			.filter((v): v is VoteSubmission => Boolean(v));

		castVotesMutation.mutate({
			electionId,
			votes,
		});
	};

	const incompleteCount = ballots.length - selections.length;

	const getSelectionDisplay = (ballotId: string) => {
		const selection = selections.find((s) => s.ballotId === ballotId);
		if (!selection) return null;

		if (selection.referendumVote) {
			return {
				names: [selection.referendumVote],
				isReferendum: true,
			};
		}

		// Handle special values
		if (selection.candidateIds[0] === "ABSTAIN") {
			return {
				names: ["ABSTAIN"],
				isReferendum: false,
			};
		}

		if (selection.candidateIds[0] === "OPPOSE") {
			return {
				names: ["OPPOSE (No Confidence)"],
				isReferendum: false,
			};
		}

		// Handle multi-candidate selections
		const ballot = ballots.find((b) => b.id === ballotId);
		const candidateNames = selection.candidateIds
			.map((id) => {
				const candidate = ballot?.candidates.find((c) => c.id === id);
				return candidate?.name || "Unknown";
			})
			.filter(Boolean);

		return {
			names: candidateNames,
			isReferendum: false,
		};
	};

	const getBadgeVariant = (type: string) => {
		switch (type) {
			case "EXECUTIVE":
				return "default";
			case "DIRECTOR":
				return "secondary";
			case "REFERENDUM":
				return "destructive";
			default:
				return "default";
		}
	};

	return (
		<main className="container mx-auto max-w-4xl py-8">
			{/* Skip to review content */}
			<a
				href="#review-content"
				className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
			>
				Skip to review
			</a>

			{/* Header */}
			<header className="mb-8">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => router.back()}
					className="mb-4"
					aria-label="Go back to voting interface"
				>
					<ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
					Back to Voting
				</Button>
				<h1 className="font-bold text-3xl">Review Your Votes</h1>
				<p className="mt-2 text-muted-foreground">
					Please review your selections before submitting
				</p>
			</header>

			{/* Warning if incomplete */}
			{incompleteCount > 0 && (
				<Alert
					variant="destructive"
					className="mb-6"
					role="alert"
					aria-live="polite"
				>
					<AlertCircle className="h-4 w-4" aria-hidden="true" />
					<AlertDescription>
						You have not made selections for {incompleteCount} ballot
						{incompleteCount > 1 ? "s" : ""}. You can go back to complete them
						or submit your partial ballot.
					</AlertDescription>
				</Alert>
			)}

			{/* Success indicator */}
			{incompleteCount === 0 && (
				// biome-ignore lint/a11y/useSemanticElements: a11y
				<Alert className="mb-6" role="status" aria-live="polite">
					<CheckCircle className="h-4 w-4" aria-hidden="true" />
					<AlertDescription>
						All ballots completed! Review your selections below.
					</AlertDescription>
				</Alert>
			)}

			{/* Ballot Summary */}
			<section
				id="review-content"
				className="space-y-4"
				aria-label="Vote summary"
			>
				{ballots.map((ballot) => {
					const selection = getSelectionDisplay(ballot.id);
					return (
						<Card key={ballot.id}>
							<CardHeader>
								<div className="flex items-start justify-between gap-4">
									<CardTitle className="text-lg">{ballot.title}</CardTitle>
									<div className="flex gap-2">
										<Badge variant={getBadgeVariant(ballot.type)}>
											{ballot.type}
										</Badge>
										{ballot.college && (
											<Badge variant="outline">{ballot.college}</Badge>
										)}
									</div>
								</div>
							</CardHeader>
							<CardContent>
								{selection ? (
									<div className="flex items-center justify-between">
										<div className="flex-1">
											<p className="font-medium">
												Your selection{selection.names.length > 1 ? "s" : ""}:
											</p>
											<div className="mt-1 text-muted-foreground text-sm">
												{selection.names.map((name) => (
													<div key={name}>{name}</div>
												))}
											</div>
										</div>
										<CheckCircle className="h-5 w-5 text-green-600" />
									</div>
								) : (
									<p className="text-muted-foreground text-sm">
										No selection made
									</p>
								)}
							</CardContent>
						</Card>
					);
				})}
			</section>

			{/* Actions */}
			<nav
				className="mt-8 flex items-center justify-between gap-4"
				aria-label="Review actions"
			>
				<Button
					variant="outline"
					onClick={() => router.back()}
					size="lg"
					aria-label="Go back to edit your votes"
				>
					Back to Edit
				</Button>
				<Button
					onClick={handleSubmit}
					size="lg"
					disabled={selections.length === 0 || castVotesMutation.isPending}
					aria-label={
						castVotesMutation.isPending
							? "Submitting your votes..."
							: "Submit all votes"
					}
				>
					{castVotesMutation.isPending ? (
						<>
							<Loader2
								className="mr-2 h-4 w-4 animate-spin"
								aria-hidden="true"
							/>
							Submitting...
						</>
					) : (
						"Submit Votes"
					)}
				</Button>
			</nav>

			{/* Confirmation Dialog */}
			<Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Confirm Vote Submission</DialogTitle>
						<DialogDescription>
							Are you sure you want to submit your votes? This action cannot be
							undone. You will not be able to change your votes after
							submission.
						</DialogDescription>
					</DialogHeader>
					{incompleteCount > 0 && (
						<Alert variant="destructive">
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>
								You have not voted on {incompleteCount} ballot
								{incompleteCount > 1 ? "s" : ""}. These will be skipped.
							</AlertDescription>
						</Alert>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowConfirmDialog(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={handleConfirm}
							disabled={castVotesMutation.isPending}
						>
							{castVotesMutation.isPending ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Submitting...
								</>
							) : (
								"Confirm & Submit"
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Error Display */}
			{castVotesMutation.isError && (
				<Alert
					variant="destructive"
					className="mt-6"
					role="alert"
					aria-live="assertive"
				>
					<AlertCircle className="h-4 w-4" aria-hidden="true" />
					<AlertDescription>
						{castVotesMutation.error?.message ||
							"An error occurred while submitting your votes. Please try again."}
					</AlertDescription>
				</Alert>
			)}
		</main>
	);
}
