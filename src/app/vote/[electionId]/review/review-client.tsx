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
			// Store vote hashes in sessionStorage for receipt
			sessionStorage.setItem(
				`receipt-${electionId}`,
				JSON.stringify({
					votedAt: data.votedAt,
					voteCount: data.voteCount,
					votes: data.votes,
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
		const votes = selections
			.map((selection) => {
				// Skip ABSTAIN votes - they shouldn't be recorded
				if (
					selection.candidateId === "ABSTAIN" ||
					selection.referendumVote === "ABSTAIN"
				) {
					return null;
				}

				// For referendum votes
				if (selection.referendumVote) {
					// TODO: Need to handle referendum votes properly
					// For now, skip them as we need backend support
					return null;
				}

				// For candidate votes (including OPPOSE)
				return {
					ballotId: selection.ballotId,
					candidateId: selection.candidateId || "",
				};
			})
			.filter((v) => v !== null);

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
				name: selection.referendumVote,
				isReferendum: true,
			};
		}

		// Handle special values
		if (selection.candidateId === "ABSTAIN") {
			return {
				name: "ABSTAIN",
				isReferendum: false,
			};
		}

		if (selection.candidateId === "OPPOSE") {
			return {
				name: "OPPOSE (No Confidence)",
				isReferendum: false,
			};
		}

		const ballot = ballots.find((b) => b.id === ballotId);
		const candidate = ballot?.candidates.find(
			(c) => c.id === selection.candidateId,
		);
		return {
			name: candidate?.name || "Unknown",
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
		<div className="container mx-auto max-w-4xl py-8">
			{/* Header */}
			<div className="mb-8">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => router.back()}
					className="mb-4"
				>
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to Voting
				</Button>
				<h1 className="font-bold text-3xl">Review Your Votes</h1>
				<p className="mt-2 text-muted-foreground">
					Please review your selections before submitting
				</p>
			</div>

			{/* Warning if incomplete */}
			{incompleteCount > 0 && (
				<Alert variant="destructive" className="mb-6">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>
						You have not made selections for {incompleteCount} ballot
						{incompleteCount > 1 ? "s" : ""}. You can go back to complete them
						or submit your partial ballot.
					</AlertDescription>
				</Alert>
			)}

			{/* Success indicator */}
			{incompleteCount === 0 && (
				<Alert className="mb-6">
					<CheckCircle className="h-4 w-4" />
					<AlertDescription>
						All ballots completed! Review your selections below.
					</AlertDescription>
				</Alert>
			)}

			{/* Ballot Summary */}
			<div className="space-y-4">
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
										<div>
											<p className="font-medium">Your selection:</p>
											<p className="mt-1 text-muted-foreground text-sm">
												{selection.name}
											</p>
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
			</div>

			{/* Actions */}
			<div className="mt-8 flex items-center justify-between gap-4">
				<Button variant="outline" onClick={() => router.back()} size="lg">
					Back to Edit
				</Button>
				<Button
					onClick={handleSubmit}
					size="lg"
					disabled={selections.length === 0 || castVotesMutation.isPending}
				>
					{castVotesMutation.isPending ? (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							Submitting...
						</>
					) : (
						"Submit Votes"
					)}
				</Button>
			</div>

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
				<Alert variant="destructive" className="mt-6">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>
						{castVotesMutation.error?.message ||
							"An error occurred while submitting your votes. Please try again."}
					</AlertDescription>
				</Alert>
			)}
		</div>
	);
}
