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
		<div className="container mx-auto max-w-4xl py-8">
			{/* Header */}
			<div className="mb-8">
				<h1 className="font-bold text-3xl">Cast Your Vote</h1>
				<p className="mt-2 text-muted-foreground">
					Welcome, {voter.firstName} {voter.lastName}
				</p>
			</div>

			{/* Progress */}
			<div className="mb-8">
				<div className="mb-2 flex items-center justify-between text-sm">
					<span className="text-muted-foreground">
						Ballot {currentBallotIndex + 1} of {ballots.length}
					</span>
					<span className="text-muted-foreground">
						{completedCount} of {ballots.length} completed
					</span>
				</div>
				<Progress value={progress} className="h-2" />
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
			<div className="mb-8">
				<BallotCard ballot={currentBallot} />
			</div>

			{/* Navigation */}
			<div className="flex items-center justify-between">
				<Button
					variant="outline"
					onClick={handlePrevious}
					disabled={isFirstBallot}
				>
					Previous
				</Button>

				<div className="text-muted-foreground text-sm">
					{hasSelection(currentBallot.id) && (
						<span className="flex items-center gap-2 text-green-600">
							<CheckCircle className="h-4 w-4" />
							Selection made
						</span>
					)}
				</div>

				{isLastBallot ? (
					<Button onClick={handleReview} size="lg">
						Review Votes
					</Button>
				) : (
					<Button onClick={handleNext}>Next</Button>
				)}
			</div>

			{/* Quick Navigation */}
			<div className="mt-8 rounded-lg border p-4">
				<h3 className="mb-3 font-semibold text-sm">Quick Navigation</h3>
				<div className="grid grid-cols-2 gap-2 md:grid-cols-3">
					{ballots.map((ballot, index) => (
						<Button
							key={ballot.id}
							variant={index === currentBallotIndex ? "default" : "outline"}
							size="sm"
							onClick={() => setCurrentBallotIndex(index)}
							className="justify-start"
						>
							<span className="mr-2">{index + 1}.</span>
							<span className="truncate">{ballot.title}</span>
							{hasSelection(ballot.id) && (
								<CheckCircle className="ml-auto h-4 w-4 shrink-0" />
							)}
						</Button>
					))}
				</div>
			</div>
		</div>
	);
}

export function VotingInterface(props: VotingInterfaceProps) {
	return (
		<VotingProvider>
			<VotingInterfaceContent {...props} />
		</VotingProvider>
	);
}
