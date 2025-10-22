"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BallotCard } from "@/components/voting/ballot-card";
import { VotingProvider, useVoting } from "@/contexts/voting-context";
import { AlertCircle, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Ballot {
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
}

interface Voter {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	college: string;
	studentId: string;
}

interface VotingInterfaceProps {
	electionId: string;
	ballots: Ballot[];
	voter: Voter;
}

function VotingInterfaceContent({
	electionId,
	ballots,
	voter,
}: VotingInterfaceProps) {
	const router = useRouter();
	const { getAllSelections, hasSelection } = useVoting();
	const [currentBallotIndex, setCurrentBallotIndex] = useState(0);

	const currentBallot = ballots[currentBallotIndex];
	const isLastBallot = currentBallotIndex === ballots.length - 1;
	const isFirstBallot = currentBallotIndex === 0;
	const progress = ((currentBallotIndex + 1) / ballots.length) * 100;

	const completedCount = ballots.filter((b) => hasSelection(b.id)).length;

	const handleNext = () => {
		if (!isLastBallot) {
			setCurrentBallotIndex((prev) => prev + 1);
		}
	};

	const handlePrevious = () => {
		if (!isFirstBallot) {
			setCurrentBallotIndex((prev) => prev - 1);
		}
	};

	const handleReview = () => {
		router.push(`/vote/${electionId}/review`);
	};

	if (!currentBallot) {
		return null;
	}

	return (
		<main className="container mx-auto max-w-4xl py-8">
			{/* Skip to main content link for screen readers */}
			<a
				href="#ballot-content"
				className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
			>
				Skip to ballot
			</a>

			{/* Header */}
			<header className="mb-8">
				<h1 className="font-bold text-3xl">Cast Your Vote</h1>
				<p className="mt-2 text-muted-foreground">
					Welcome, {voter.firstName} {voter.lastName}
				</p>
			</header>

			{/* Progress */}
			{/* biome-ignore lint/a11y/useSemanticElements: a11y */}
			<div className="mb-8" role="status" aria-live="polite" aria-atomic="true">
				<div
					className="mb-2 flex items-center justify-between text-sm"
					aria-label={`Voting progress: ballot ${currentBallotIndex + 1} of ${ballots.length}, ${completedCount} completed`}
				>
					<span className="text-muted-foreground" aria-hidden="true">
						Ballot {currentBallotIndex + 1} of {ballots.length}
					</span>
					<span className="text-muted-foreground" aria-hidden="true">
						{completedCount} of {ballots.length} completed
					</span>
				</div>
				<Progress
					value={progress}
					className="h-2"
					aria-label={`${Math.round(progress)}% complete`}
				/>
			</div>

			{/* Info Alert */}
			<Alert className="mb-6">
				<AlertCircle className="h-4 w-4" />
				<AlertDescription>
					You can navigate between ballots and change your selections. Your
					votes will only be submitted when you review and confirm them.
				</AlertDescription>
			</Alert>

			{/* Current Ballot */}
			<section
				id="ballot-content"
				className="mb-8"
				aria-labelledby="ballot-title"
			>
				<BallotCard ballot={currentBallot} />
			</section>

			{/* Navigation */}
			<nav
				className="flex items-center justify-between"
				aria-label="Ballot navigation"
			>
				<Button
					variant="outline"
					onClick={handlePrevious}
					disabled={isFirstBallot}
					aria-label="Go to previous ballot"
				>
					Previous
				</Button>

				<div
					className="text-muted-foreground text-sm"
					// biome-ignore lint/a11y/useSemanticElements: a11y
					role="status"
					aria-live="polite"
				>
					{hasSelection(currentBallot.id) && (
						<span className="flex items-center gap-2 text-green-600">
							<CheckCircle className="h-4 w-4" aria-hidden="true" />
							<span>Selection made</span>
						</span>
					)}
				</div>

				{isLastBallot ? (
					<Button
						onClick={handleReview}
						size="lg"
						aria-label="Review all votes before submission"
					>
						Review Votes
					</Button>
				) : (
					<Button onClick={handleNext} aria-label="Go to next ballot">
						Next
					</Button>
				)}
			</nav>

			{/* Quick Navigation */}
			<nav
				className="mt-8 rounded-lg border p-4"
				aria-label="Jump to specific ballot"
			>
				<h2 className="mb-3 font-semibold text-sm">Quick Navigation</h2>
				{/* biome-ignore lint/a11y/useSemanticElements: a11y */}
				<div className="grid grid-cols-2 gap-2 md:grid-cols-3" role="list">
					{ballots.map((ballot, index) => (
						<Button
							key={ballot.id}
							variant={index === currentBallotIndex ? "default" : "outline"}
							size="sm"
							onClick={() => setCurrentBallotIndex(index)}
							className="justify-start"
							aria-label={`Jump to ballot ${index + 1}: ${ballot.title}${hasSelection(ballot.id) ? " (completed)" : ""}`}
							aria-current={index === currentBallotIndex ? "page" : undefined}
							// biome-ignore lint/a11y/useSemanticElements: a11y
							role="listitem"
						>
							<span className="mr-2" aria-hidden="true">
								{index + 1}.
							</span>
							<span className="truncate">{ballot.title}</span>
							{hasSelection(ballot.id) && (
								<CheckCircle
									className="ml-auto h-4 w-4 shrink-0"
									aria-hidden="true"
								/>
							)}
						</Button>
					))}
				</div>
			</nav>
		</main>
	);
}

export function VotingInterface(props: VotingInterfaceProps) {
	return (
		<VotingProvider>
			<VotingInterfaceContent {...props} />
		</VotingProvider>
	);
}
