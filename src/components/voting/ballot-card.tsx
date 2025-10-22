"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useVoting } from "@/contexts/voting-context";
import { AlertCircle } from "lucide-react";
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
		seatsAvailable: number;
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
	const {
		setSelection,
		setReferendumVote,
		getSelection,
		toggleCandidate,
		isCandidateSelected,
	} = useVoting();
	const selection = getSelection(ballot.id);

	// Randomize candidates once on mount
	const randomizedCandidates = useMemo(() => {
		return shuffleArray(ballot.candidates);
	}, [ballot.candidates]);

	const isMultiSeat = ballot.seatsAvailable > 1;
	const isSingleCandidate = ballot.candidates.length === 1;
	const selectedCount = selection?.candidateIds.length ?? 0;

	const handleValueChange = (value: string) => {
		if (ballot.type === "REFERENDUM") {
			setReferendumVote(ballot.id, value as "YES" | "NO" | "ABSTAIN");
		} else {
			setSelection(ballot.id, value);
		}
	};

	const handleCheckboxChange = (candidateId: string, checked: boolean) => {
		if (checked) {
			// Only allow selection up to seatsAvailable
			if (selectedCount < ballot.seatsAvailable) {
				toggleCandidate(ballot.id, candidateId);
			}
		} else {
			toggleCandidate(ballot.id, candidateId);
		}
	};

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
		// biome-ignore lint/a11y/useSemanticElements: a11y
		<Card role="region" aria-labelledby="ballot-title">
			<CardHeader>
				<div className="flex items-start justify-between gap-4">
					<div className="flex-1">
						<CardTitle id="ballot-title" className="text-xl">
							{ballot.title}
						</CardTitle>
						{isMultiSeat && (
							<p
								className="mt-1 text-muted-foreground text-sm"
								id="ballot-instructions"
							>
								Select up to {ballot.seatsAvailable} candidate
								{ballot.seatsAvailable > 1 ? "s" : ""}
							</p>
						)}
					</div>
					<div
						className="flex flex-col gap-2"
						// biome-ignore lint/a11y/useSemanticElements: a11y
						role="group"
						aria-label="Ballot information"
					>
						<Badge
							variant={getBadgeVariant()}
							aria-label={`Ballot type: ${ballot.type}`}
						>
							{ballot.type}
						</Badge>
						{ballot.college && (
							<Badge
								variant="outline"
								aria-label={`College: ${ballot.college}`}
							>
								{ballot.college}
							</Badge>
						)}
						{isMultiSeat && (
							<Badge variant="outline" aria-live="polite" aria-atomic="true">
								<span className="sr-only">You have selected </span>
								{selectedCount}/{ballot.seatsAvailable}
								<span className="sr-only">
									{" "}
									out of {ballot.seatsAvailable} candidates
								</span>
							</Badge>
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
							aria-label={`Vote on referendum: ${ballot.question || ballot.title}`}
							aria-describedby={
								ballot.question ? "referendum-question" : undefined
							}
						>
							<div className="flex items-start gap-3">
								<RadioGroupItem
									value="YES"
									id={`${ballot.id}-yes`}
									className="mt-1"
									aria-label="Vote YES on this referendum"
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
									aria-label="Vote NO on this referendum"
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
							value={selection?.candidateIds[0] ?? ""}
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
											selection?.candidateIds[0] === randomizedCandidates[0]?.id
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
											selection?.candidateIds[0] === "OPPOSE"
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
											selection?.candidateIds[0] === "ABSTAIN"
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
				) : isMultiSeat ? (
					<div className="space-y-4">
						{/* Multi-seat election - use checkboxes */}
						{selectedCount >= ballot.seatsAvailable && (
							<div
								className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm"
								role="alert"
								aria-live="polite"
							>
								<AlertCircle
									className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
									aria-hidden="true"
								/>
								<p className="text-muted-foreground">
									You've selected the maximum number of candidates (
									{ballot.seatsAvailable}). Uncheck a candidate to select a
									different one.
								</p>
							</div>
						)}
						<fieldset
							className="space-y-3"
							aria-describedby="ballot-instructions"
						>
							<legend className="sr-only">
								Select up to {ballot.seatsAvailable} candidate
								{ballot.seatsAvailable > 1 ? "s" : ""} for {ballot.title}
							</legend>
							{randomizedCandidates.map((candidate) => {
								const isSelected = isCandidateSelected(ballot.id, candidate.id);
								const isDisabled =
									!isSelected && selectedCount >= ballot.seatsAvailable;

								return (
									<div key={candidate.id} className="flex items-start gap-3">
										<Checkbox
											id={`${ballot.id}-${candidate.id}`}
											checked={isSelected}
											onCheckedChange={(checked: boolean) =>
												handleCheckboxChange(candidate.id, checked)
											}
											disabled={isDisabled}
											className="mt-1"
											aria-label={`Select ${candidate.name}`}
											aria-describedby={
												candidate.statement
													? `${ballot.id}-${candidate.id}-statement`
													: undefined
											}
										/>
										<label
											htmlFor={`${ballot.id}-${candidate.id}`}
											className={`flex-1 ${isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
										>
											<Card
												className={`transition-all ${
													isSelected
														? "border-primary bg-primary/5"
														: isDisabled
															? ""
															: "hover:border-primary/50"
												}`}
											>
												<CardContent>
													<h4 className="font-semibold">{candidate.name}</h4>
													{candidate.statement && (
														<p
															className="mt-1 text-muted-foreground text-sm"
															id={`${ballot.id}-${candidate.id}-statement`}
														>
															{candidate.statement}
														</p>
													)}
												</CardContent>
											</Card>
										</label>
									</div>
								);
							})}
						</fieldset>
						<div className="mt-4 border-t pt-4">
							<p
								className="mb-3 text-muted-foreground text-sm"
								id="abstain-label"
							>
								Or choose to abstain:
							</p>
							<button
								type="button"
								onClick={() => setSelection(ballot.id, "ABSTAIN")}
								className="w-full rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
								aria-label="Abstain from voting on this ballot"
								aria-describedby="abstain-label"
							>
								<Card
									className={`transition-all ${
										selection?.candidateIds[0] === "ABSTAIN"
											? "border-primary bg-primary/5"
											: "hover:border-primary/50"
									}`}
									// biome-ignore lint/a11y/useSemanticElements: a11y
									role="button"
									tabIndex={-1}
								>
									<CardContent>
										<div className="font-semibold">ABSTAIN</div>
										<div className="mt-1 text-muted-foreground text-sm">
											I choose not to vote on this ballot
										</div>
									</CardContent>
								</Card>
							</button>
						</div>
					</div>
				) : (
					<RadioGroup
						value={selection?.candidateIds[0] ?? ""}
						onValueChange={handleValueChange}
						className="space-y-3"
						aria-label={`Select a candidate for ${ballot.title}`}
					>
						{randomizedCandidates.map((candidate) => (
							<CandidateCard
								key={candidate.id}
								id={candidate.id}
								name={candidate.name}
								statement={candidate.statement}
								isSelected={
									selection?.candidateIds.includes(candidate.id) ?? false
								}
								ballotId={ballot.id}
							/>
						))}
						<div className="flex items-start gap-3">
							<RadioGroupItem
								value="ABSTAIN"
								id={`${ballot.id}-abstain`}
								className="mt-1"
								aria-label="Abstain from voting on this ballot"
							/>
							<label
								htmlFor={`${ballot.id}-abstain`}
								className="flex-1 cursor-pointer"
							>
								<Card
									className={`transition-all ${
										selection?.candidateIds[0] === "ABSTAIN"
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
