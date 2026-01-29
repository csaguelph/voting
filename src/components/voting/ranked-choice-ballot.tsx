"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	AlertCircle,
	ChevronDown,
	ChevronUp,
	GripVertical,
	Plus,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";

interface Candidate {
	id: string;
	name: string;
	statement: string | null;
}

interface RankedChoiceBallotProps {
	ballot: {
		id: string;
		title: string;
		type: "EXECUTIVE" | "DIRECTOR" | "REFERENDUM";
		college: string | null;
		seatsAvailable: number;
		candidates: Candidate[];
	};
	rankedCandidates: string[];
	onRankingChange: (rankings: string[]) => void;
	onAbstain: () => void;
	onCancelAbstain: () => void;
	isAbstain: boolean;
	randomizedCandidates: Candidate[];
}

export function RankedChoiceBallot({
	ballot,
	rankedCandidates,
	onRankingChange,
	onAbstain,
	onCancelAbstain,
	isAbstain,
	randomizedCandidates,
}: RankedChoiceBallotProps) {
	const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

	// Get unranked candidates
	const unrankedCandidates = randomizedCandidates.filter(
		(c) => !rankedCandidates.includes(c.id),
	);

	// Get candidate by ID
	const getCandidateById = (id: string) => {
		return ballot.candidates.find((c) => c.id === id);
	};

	const handleDragStart = (index: number, e: React.DragEvent) => {
		setDraggedIndex(index);
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", index.toString());

		// Make dragged element semi-transparent
		if (e.currentTarget instanceof HTMLElement) {
			e.currentTarget.style.opacity = "0.4";
		}
	};

	const handleDragEnd = (e: React.DragEvent) => {
		setDraggedIndex(null);
		setDragOverIndex(null);

		// Reset opacity
		if (e.currentTarget instanceof HTMLElement) {
			e.currentTarget.style.opacity = "1";
		}
	};

	const handleDragOver = (index: number, e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		setDragOverIndex(index);
	};

	const handleDragLeave = () => {
		setDragOverIndex(null);
	};

	const handleDrop = (dropIndex: number, e: React.DragEvent) => {
		e.preventDefault();
		setDragOverIndex(null);

		if (draggedIndex === null || draggedIndex === dropIndex) {
			return;
		}

		const newRankings = [...rankedCandidates];
		const draggedItem = newRankings[draggedIndex];

		if (!draggedItem) return;

		// Remove from old position
		newRankings.splice(draggedIndex, 1);
		// Insert at new position
		newRankings.splice(dropIndex, 0, draggedItem);

		onRankingChange(newRankings);
		setDraggedIndex(null);
	};

	const moveUp = (index: number) => {
		if (index === 0) return;
		const newRankings = [...rankedCandidates];
		const item = newRankings[index];
		const prevItem = newRankings[index - 1];
		if (item && prevItem) {
			newRankings[index - 1] = item;
			newRankings[index] = prevItem;
			onRankingChange(newRankings);
		}
	};

	const moveDown = (index: number) => {
		if (index === rankedCandidates.length - 1) return;
		const newRankings = [...rankedCandidates];
		const item = newRankings[index];
		const nextItem = newRankings[index + 1];
		if (item && nextItem) {
			newRankings[index + 1] = item;
			newRankings[index] = nextItem;
			onRankingChange(newRankings);
		}
	};

	const removeRanking = (candidateId: string) => {
		onRankingChange(rankedCandidates.filter((id) => id !== candidateId));
	};

	const addCandidate = (candidateId: string) => {
		onRankingChange([...rankedCandidates, candidateId]);
	};

	// Keyboard navigation state
	const [focusedRankedIndex, setFocusedRankedIndex] = useState<number | null>(
		null,
	);

	const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
		switch (e.key) {
			case "ArrowUp":
				e.preventDefault();
				if (e.shiftKey || e.metaKey || e.ctrlKey) {
					// Move item up
					moveUp(index);
				} else {
					// Focus previous item
					setFocusedRankedIndex(Math.max(0, index - 1));
				}
				break;
			case "ArrowDown":
				e.preventDefault();
				if (e.shiftKey || e.metaKey || e.ctrlKey) {
					// Move item down
					moveDown(index);
				} else {
					// Focus next item
					setFocusedRankedIndex(
						Math.min(rankedCandidates.length - 1, index + 1),
					);
				}
				break;
			case "Delete":
			case "Backspace": {
				e.preventDefault();
				const candidateId = rankedCandidates[index];
				if (candidateId) {
					removeRanking(candidateId);
					// Focus previous item or next item
					setFocusedRankedIndex(
						index > 0 ? index - 1 : rankedCandidates.length > 1 ? 0 : null,
					);
				}
				break;
			}
			case " ":
			case "Enter":
				// Handled by button onClick
				break;
		}
	};

	// Auto-focus when focused index changes
	useEffect(() => {
		if (focusedRankedIndex !== null) {
			const element = document.querySelector(
				`[data-ranked-index="${focusedRankedIndex}"]`,
			);
			if (element instanceof HTMLElement) {
				element.focus();
			}
		}
	}, [focusedRankedIndex]);

	if (isAbstain) {
		return (
			<div className="space-y-4">
				<Card className="border-primary bg-primary/5">
					<CardContent className="py-6">
						<div className="text-center">
							<p className="font-semibold">You have chosen to abstain</p>
							<p className="mt-2 text-muted-foreground text-sm">
								You will not rank any candidates for this ballot
							</p>
						</div>
					</CardContent>
				</Card>
				<Button
					variant="outline"
					onClick={onCancelAbstain}
					className="w-full"
					aria-label="Cancel abstention and rank candidates"
				>
					Rank Candidates Instead
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Instructions */}
			<div className="rounded-lg bg-muted/50 p-4">
				<div className="flex items-start gap-3">
					<AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
					<div className="space-y-2 text-sm">
						<p className="font-medium">Ranked Choice Voting Instructions:</p>
						<ul className="ml-4 list-disc space-y-1 text-muted-foreground">
							<li>
								Rank candidates in order of preference (1st choice, 2nd choice,
								etc.)
							</li>
							<li>
								You don't need to rank all candidates—rank only those you
								support
							</li>
							<li>
								Drag candidates to reorder, or use the arrow buttons and
								keyboard
							</li>
							<li>
								Use{" "}
								<kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
									↑
								</kbd>{" "}
								/
								<kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
									↓
								</kbd>{" "}
								to navigate,{" "}
								<kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
									⌘↑
								</kbd>{" "}
								/
								<kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
									⌘↓
								</kbd>{" "}
								to reorder
							</li>
						</ul>
					</div>
				</div>
			</div>

			{/* Ranked candidates */}
			{rankedCandidates.length > 0 && (
				<div>
					<h3 className="mb-3 font-semibold text-sm">
						Your Rankings ({rankedCandidates.length})
					</h3>
					<ul className="space-y-2" aria-label="Your ranked candidates">
						{rankedCandidates.map((candidateId, index) => {
							const candidate = getCandidateById(candidateId);
							if (!candidate) return null;

							const isFirst = index === 0;
							const isLast = index === rankedCandidates.length - 1;
							const isDraggedOver = dragOverIndex === index;

							return (
								<li
									key={candidateId}
									className={`relative ${isDraggedOver ? "border-primary border-t-2" : ""}`}
									onDragOver={(e) => handleDragOver(index, e)}
									onDragLeave={handleDragLeave}
									onDrop={(e) => handleDrop(index, e)}
								>
									<div
										className={`w-full text-left transition-all ${
											draggedIndex === index
												? "opacity-40"
												: "hover:border-primary/50"
										}`}
										draggable
										onDragStart={(e) => handleDragStart(index, e)}
										onDragEnd={handleDragEnd}
										tabIndex={0}
										data-ranked-index={index}
										onKeyDown={(e) => handleKeyDown(index, e)}
										// biome-ignore lint/a11y/useSemanticElements: Can't use button due to nested Button components for actions
										role="button"
										aria-label={`${index + 1}${getOrdinalSuffix(index + 1)} choice: ${candidate.name}. Press Control or Command with up or down arrow to reorder. Press Delete or Backspace to remove.`}
									>
										<Card
											className={draggedIndex === index ? "opacity-40" : ""}
										>
											<CardContent className="py-3">
												<div className="flex items-start gap-3">
													<div
														className="flex shrink-0 cursor-grab touch-none select-none flex-col items-center active:cursor-grabbing"
														aria-hidden="true"
													>
														<GripVertical className="h-5 w-5 text-muted-foreground" />
													</div>

													<Badge
														variant="secondary"
														className="mt-0.5 shrink-0 tabular-nums"
														aria-hidden="true"
													>
														{index + 1}
														{getOrdinalSuffix(index + 1)}
													</Badge>

													<div className="min-w-0 flex-1">
														<p className="font-semibold">{candidate.name}</p>
														{candidate.statement && (
															<p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
																{candidate.statement}
															</p>
														)}
													</div>

													<div className="flex shrink-0 gap-1">
														<Button
															variant="ghost"
															size="icon"
															className="h-8 w-8"
															onClick={(e) => {
																e.stopPropagation();
																moveUp(index);
															}}
															disabled={isFirst}
															aria-label={`Move ${candidate.name} up in ranking`}
														>
															<ChevronUp className="h-4 w-4" />
														</Button>
														<Button
															variant="ghost"
															size="icon"
															className="h-8 w-8"
															onClick={(e) => {
																e.stopPropagation();
																moveDown(index);
															}}
															disabled={isLast}
															aria-label={`Move ${candidate.name} down in ranking`}
														>
															<ChevronDown className="h-4 w-4" />
														</Button>
														<Button
															variant="ghost"
															size="icon"
															className="h-8 w-8"
															onClick={(e) => {
																e.stopPropagation();
																removeRanking(candidateId);
															}}
															aria-label={`Remove ${candidate.name} from rankings`}
														>
															<X className="h-4 w-4" />
														</Button>
													</div>
												</div>
											</CardContent>
										</Card>
									</div>
								</li>
							);
						})}
					</ul>
				</div>
			)}

			{/* Unranked candidates */}
			{unrankedCandidates.length > 0 && (
				<div>
					<h3 className="mb-3 font-semibold text-sm">
						Available Candidates ({unrankedCandidates.length})
					</h3>
					<ul className="space-y-2" aria-label="Available candidates to rank">
						{unrankedCandidates.map((candidate) => (
							<li key={candidate.id}>
								<Card className="transition-all hover:border-primary/50">
									<CardContent className="py-3">
										<div className="flex items-start gap-3">
											<div className="min-w-0 flex-1">
												<p className="font-semibold">{candidate.name}</p>
												{candidate.statement && (
													<p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
														{candidate.statement}
													</p>
												)}
											</div>
											<Button
												variant="outline"
												size="sm"
												onClick={() => addCandidate(candidate.id)}
												className="shrink-0"
												aria-label={`Add ${candidate.name} to your rankings`}
											>
												<Plus className="mr-1 h-4 w-4" />
												Rank
											</Button>
										</div>
									</CardContent>
								</Card>
							</li>
						))}
					</ul>
				</div>
			)}

			{/* Abstain option */}
			<div className="border-t pt-4">
				<p className="mb-3 text-muted-foreground text-sm">
					Or choose to abstain from this ballot:
				</p>
				<Button
					variant="outline"
					onClick={onAbstain}
					className="w-full"
					aria-label="Abstain from voting on this ballot"
				>
					Abstain
				</Button>
			</div>
		</div>
	);
}

function getOrdinalSuffix(n: number): string {
	const s = ["th", "st", "nd", "rd"];
	const v = n % 100;
	return s[(v - 20) % 10] ?? s[v] ?? s[0] ?? "th";
}
