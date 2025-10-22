"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useVoting } from "@/contexts/voting-context";
import { useMemo } from "react";
import { CandidateCard } from "./candidate-card";

interface Candidate {
	id: string;
	name: string;
	statement: string | null;
}

interface BallotCardProps {
	ballot: {
		id: string;
		title: string;
		type: "EXECUTIVE" | "DIRECTOR" | "REFERENDUM";
		college: string | null;
		preamble: string | null;
		question: string | null;
		sponsor: string | null;
		candidates: Candidate[];
	};
}

// Fisher-Yates shuffle algorithm for randomizing candidates
function shuffleArray<T>(array: T[]): T[] {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const temp = shuffled[i];
		const swap = shuffled[j];
		if (temp && swap) {
			shuffled[i] = swap;
			shuffled[j] = temp;
		}
	}
	return shuffled;
}

export function BallotCard({ ballot }: BallotCardProps) {
	const { setSelection, setReferendumVote, getSelection } = useVoting();
	const selection = getSelection(ballot.id);

	// Randomize candidates once on mount
	const randomizedCandidates = useMemo(() => {
		return shuffleArray(ballot.candidates);
	}, [ballot.candidates]);

	const handleValueChange = (value: string) => {
		if (ballot.type === "REFERENDUM") {
			setReferendumVote(ballot.id, value as "YES" | "NO" | "ABSTAIN");
		} else {
			setSelection(ballot.id, value);
		}
	};

	const isSingleCandidate = ballot.candidates.length === 1;

	const getBadgeVariant = () => {
		switch (ballot.type) {
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
		<Card>
			<CardHeader>
				<div className="flex items-start justify-between gap-4">
					<div className="flex-1">
						<CardTitle className="text-xl">{ballot.title}</CardTitle>
					</div>
					<div className="flex flex-col gap-2">
						<Badge variant={getBadgeVariant()}>{ballot.type}</Badge>
						{ballot.college && (
							<Badge variant="outline">{ballot.college}</Badge>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{ballot.type === "REFERENDUM" ? (
					<div className="space-y-4">
						{ballot.preamble && (
							<div className="rounded-md bg-muted p-4">
								<p className="whitespace-pre-wrap text-sm">{ballot.preamble}</p>
							</div>
						)}
						{ballot.question && (
							<div className="font-medium">
								<p className="whitespace-pre-wrap">{ballot.question}</p>
							</div>
						)}
						{ballot.sponsor && (
							<p className="text-muted-foreground text-sm">
								Sponsored by: {ballot.sponsor}
							</p>
						)}
						<RadioGroup
							value={selection?.referendumVote ?? ""}
							onValueChange={handleValueChange}
							className="space-y-3"
						>
							<div className="flex items-start gap-3">
								<RadioGroupItem
									value="YES"
									id={`${ballot.id}-yes`}
									className="mt-1"
								/>
								<label
									htmlFor={`${ballot.id}-yes`}
									className="flex-1 cursor-pointer"
								>
									<Card
										className={`transition-all ${
											selection?.referendumVote === "YES"
												? "border-primary bg-primary/5"
												: "hover:border-primary/50"
										}`}
									>
										<CardContent>
											<div className="font-semibold">YES</div>
											<div className="mt-1 text-muted-foreground text-sm">
												I support this proposal
											</div>
										</CardContent>
									</Card>
								</label>
							</div>
							<div className="flex items-start gap-3">
								<RadioGroupItem
									value="NO"
									id={`${ballot.id}-no`}
									className="mt-1"
								/>
								<label
									htmlFor={`${ballot.id}-no`}
									className="flex-1 cursor-pointer"
								>
									<Card
										className={`transition-all ${
											selection?.referendumVote === "NO"
												? "border-primary bg-primary/5"
												: "hover:border-primary/50"
										}`}
									>
										<CardContent>
											<div className="font-semibold">NO</div>
											<div className="mt-1 text-muted-foreground text-sm">
												I oppose this proposal
											</div>
										</CardContent>
									</Card>
								</label>
							</div>
							<div className="flex items-start gap-3">
								<RadioGroupItem
									value="ABSTAIN"
									id={`${ballot.id}-abstain`}
									className="mt-1"
								/>
								<label
									htmlFor={`${ballot.id}-abstain`}
									className="flex-1 cursor-pointer"
								>
									<Card
										className={`transition-all ${
											selection?.referendumVote === "ABSTAIN"
												? "border-primary bg-primary/5"
												: "hover:border-primary/50"
										}`}
									>
										<CardContent>
											<div className="font-semibold">ABSTAIN</div>
											<div className="mt-1 text-muted-foreground text-sm">
												I choose not to vote on this proposal
											</div>
										</CardContent>
									</Card>
								</label>
							</div>
						</RadioGroup>
					</div>
				) : isSingleCandidate ? (
					<div className="space-y-4">
						{/* Single candidate - show approve/oppose/abstain */}
						{randomizedCandidates[0] && (
							<div className="rounded-md border p-4">
								<h4 className="font-semibold">
									{randomizedCandidates[0].name}
								</h4>
								{randomizedCandidates[0].statement && (
									<p className="mt-2 text-muted-foreground text-sm">
										{randomizedCandidates[0].statement}
									</p>
								)}
							</div>
						)}
						<RadioGroup
							value={selection?.candidateId ?? ""}
							onValueChange={handleValueChange}
							className="space-y-3"
						>
							<div className="flex items-start gap-3">
								<RadioGroupItem
									value={randomizedCandidates[0]?.id ?? ""}
									id={`${ballot.id}-approve`}
									className="mt-1"
								/>
								<label
									htmlFor={`${ballot.id}-approve`}
									className="flex-1 cursor-pointer"
								>
									<Card
										className={`transition-all ${
											selection?.candidateId === randomizedCandidates[0]?.id
												? "border-primary bg-primary/5"
												: "hover:border-primary/50"
										}`}
									>
										<CardContent>
											<div className="font-semibold">APPROVE</div>
											<div className="mt-1 text-muted-foreground text-sm">
												I support this candidate
											</div>
										</CardContent>
									</Card>
								</label>
							</div>
							<div className="flex items-start gap-3">
								<RadioGroupItem
									value="OPPOSE"
									id={`${ballot.id}-oppose`}
									className="mt-1"
								/>
								<label
									htmlFor={`${ballot.id}-oppose`}
									className="flex-1 cursor-pointer"
								>
									<Card
										className={`transition-all ${
											selection?.candidateId === "OPPOSE"
												? "border-primary bg-primary/5"
												: "hover:border-primary/50"
										}`}
									>
										<CardContent>
											<div className="font-semibold">OPPOSE</div>
											<div className="mt-1 text-muted-foreground text-sm">
												Vote of no confidence
											</div>
										</CardContent>
									</Card>
								</label>
							</div>
							<div className="flex items-start gap-3">
								<RadioGroupItem
									value="ABSTAIN"
									id={`${ballot.id}-abstain`}
									className="mt-1"
								/>
								<label
									htmlFor={`${ballot.id}-abstain`}
									className="flex-1 cursor-pointer"
								>
									<Card
										className={`transition-all ${
											selection?.candidateId === "ABSTAIN"
												? "border-primary bg-primary/5"
												: "hover:border-primary/50"
										}`}
									>
										<CardContent>
											<div className="font-semibold">ABSTAIN</div>
											<div className="mt-1 text-muted-foreground text-sm">
												I choose not to vote on this ballot
											</div>
										</CardContent>
									</Card>
								</label>
							</div>
						</RadioGroup>
					</div>
				) : (
					<RadioGroup
						value={selection?.candidateId ?? ""}
						onValueChange={handleValueChange}
						className="space-y-3"
					>
						{randomizedCandidates.map((candidate) => (
							<CandidateCard
								key={candidate.id}
								id={candidate.id}
								name={candidate.name}
								statement={candidate.statement}
								isSelected={selection?.candidateId === candidate.id}
							/>
						))}
						<div className="flex items-start gap-3">
							<RadioGroupItem
								value="ABSTAIN"
								id={`${ballot.id}-abstain`}
								className="mt-1"
							/>
							<label
								htmlFor={`${ballot.id}-abstain`}
								className="flex-1 cursor-pointer"
							>
								<Card
									className={`transition-all ${
										selection?.candidateId === "ABSTAIN"
											? "border-primary bg-primary/5"
											: "hover:border-primary/50"
									}`}
								>
									<CardContent>
										<div className="font-semibold">ABSTAIN</div>
										<div className="mt-1 text-muted-foreground text-sm">
											I choose not to vote on this ballot
										</div>
									</CardContent>
								</Card>
							</label>
						</div>
					</RadioGroup>
				)}
			</CardContent>
		</Card>
	);
}
