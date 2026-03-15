"use client";

import { Edit2, MoreHorizontal, PlusCircle, Trash2, Users } from "lucide-react";
import { useState } from "react";

import { BallotForm } from "@/components/admin/ballot-form";
import { CandidateForm } from "@/components/admin/candidate-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";
import { toast } from "sonner";

interface BallotsManagerProps {
	electionId: string;
}

export function BallotsManager({ electionId }: BallotsManagerProps) {
	const [ballotFormOpen, setBallotFormOpen] = useState(false);
	const [editingBallot, setEditingBallot] = useState<{
		id: string;
		title: string;
		type: "EXECUTIVE" | "DIRECTOR" | "REFERENDUM";
		college?: string | null;
		seatsAvailable: number;
		preamble?: string | null;
		question?: string | null;
		sponsor?: string | null;
	} | null>(null);
	const [candidateFormOpen, setCandidateFormOpen] = useState(false);
	const [selectedBallotId, setSelectedBallotId] = useState<string | null>(null);
	const [editingCandidate, setEditingCandidate] = useState<{
		id: string;
		name: string;
		statement?: string | null;
	} | null>(null);
	const [statusDialog, setStatusDialog] = useState<{
		candidateId: string;
		candidateName: string;
		status: "WITHDRAWN" | "DISQUALIFIED";
	} | null>(null);
	const [statusReasonInput, setStatusReasonInput] = useState("");

	const {
		data: ballots,
		isLoading,
		error,
	} = api.ballot.getByElection.useQuery({
		electionId,
	});

	const utils = api.useUtils();

	const deleteBallot = api.ballot.delete.useMutation({
		onSuccess: async () => {
			await utils.ballot.getByElection.invalidate({ electionId });
		},
	});

	const deleteCandidate = api.ballot.deleteCandidate.useMutation({
		onSuccess: async () => {
			await utils.ballot.getByElection.invalidate({ electionId });
		},
	});

	const setCandidateStatus = api.ballot.setCandidateStatus.useMutation({
		onSuccess: async () => {
			await utils.ballot.getByElection.invalidate({ electionId });
			setStatusDialog(null);
		},
		onError: (error) => {
			toast.error("Failed to update candidate status", {
				description: error.message,
			});
		},
	});

	const handleDeleteBallot = async (ballotId: string) => {
		if (
			confirm(
				"Are you sure you want to delete this ballot? This action cannot be undone.",
			)
		) {
			await deleteBallot.mutateAsync({ id: ballotId });
		}
	};

	const handleDeleteCandidate = async (candidateId: string) => {
		if (
			confirm(
				"Are you sure you want to delete this candidate? This action cannot be undone.",
			)
		) {
			await deleteCandidate.mutateAsync({ id: candidateId });
		}
	};

	const handleEditBallot = (ballot: {
		id: string;
		title: string;
		type: "EXECUTIVE" | "DIRECTOR" | "REFERENDUM";
		college?: string | null;
		seatsAvailable: number;
		preamble?: string | null;
		question?: string | null;
		sponsor?: string | null;
	}) => {
		setEditingBallot(ballot);
		setBallotFormOpen(true);
	};

	const handleAddCandidate = (ballotId: string) => {
		setSelectedBallotId(ballotId);
		setEditingCandidate(null);
		setCandidateFormOpen(true);
	};

	const handleEditCandidate = (
		ballotId: string,
		candidate: { id: string; name: string; statement?: string | null },
	) => {
		setSelectedBallotId(ballotId);
		setEditingCandidate(candidate);
		setCandidateFormOpen(true);
	};

	const handleCloseBallotForm = () => {
		setBallotFormOpen(false);
		setEditingBallot(null);
	};

	const handleCloseCandidateForm = () => {
		setCandidateFormOpen(false);
		setSelectedBallotId(null);
		setEditingCandidate(null);
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<p className="text-muted-foreground">Loading ballots...</p>
			</div>
		);
	}

	if (error) {
		return (
			<Alert variant="destructive">
				<AlertTitle>Error</AlertTitle>
				<AlertDescription>
					Failed to load ballots. Please try again.
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<>
			<div className="flex justify-end">
				<Button onClick={() => setBallotFormOpen(true)}>
					<PlusCircle className="mr-2 h-4 w-4" />
					Create Ballot
				</Button>
			</div>

			{ballots && ballots.length === 0 ? (
				<Card>
					<CardHeader>
						<CardTitle>No ballots yet</CardTitle>
						<CardDescription>
							Create your first ballot to start adding candidates
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button onClick={() => setBallotFormOpen(true)}>
							<PlusCircle className="mr-2 h-4 w-4" />
							Create Your First Ballot
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-6 md:grid-cols-2">
					{ballots?.map((ballot) => (
						<Card key={ballot.id}>
							<CardHeader>
								<div className="flex items-start justify-between">
									<div className="space-y-1">
										<CardTitle>{ballot.title}</CardTitle>
										<div className="flex gap-2">
											<Badge
												variant={
													ballot.type === "EXECUTIVE"
														? "default"
														: ballot.type === "REFERENDUM"
															? "destructive"
															: "secondary"
												}
											>
												{ballot.type}
											</Badge>
											{ballot.college && (
												<Badge variant="outline">{ballot.college}</Badge>
											)}
										</div>
										{ballot.type === "REFERENDUM" && ballot.question && (
											<p className="mt-2 whitespace-pre-wrap text-muted-foreground text-sm">
												{ballot.question}
											</p>
										)}
										{ballot.sponsor && (
											<p className="text-muted-foreground text-xs">
												Sponsored by: {ballot.sponsor}
											</p>
										)}
									</div>
									<div className="flex gap-2">
										<Button
											variant="ghost"
											size="icon"
											onClick={() =>
												handleEditBallot({
													id: ballot.id,
													title: ballot.title,
													type: ballot.type,
													college: ballot.college,
													seatsAvailable: ballot.seatsAvailable,
													preamble: ballot.preamble,
													question: ballot.question,
													sponsor: ballot.sponsor,
												})
											}
										>
											<Edit2 className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => handleDeleteBallot(ballot.id)}
											disabled={deleteBallot.isPending}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
							</CardHeader>
							<CardContent>
								{ballot.type === "REFERENDUM" ? (
									<div className="space-y-3">
										{ballot.preamble && (
											<div>
												<h4 className="font-medium text-sm">Preamble</h4>
												<p className="mt-1 whitespace-pre-wrap text-muted-foreground text-sm">
													{ballot.preamble}
												</p>
											</div>
										)}
										<p className="text-muted-foreground text-sm">
											Referendum ballots use Yes/No options automatically. No
											candidates needed.
										</p>
									</div>
								) : (
									<div className="space-y-3">
										<div className="flex items-center justify-between">
											<h4 className="font-medium text-sm">Candidates</h4>
											<Button
												variant="outline"
												size="sm"
												onClick={() => handleAddCandidate(ballot.id)}
											>
												<PlusCircle className="mr-2 h-3 w-3" />
												Add Candidate
											</Button>
										</div>

										{ballot.candidates.length === 0 ? (
											<p className="text-muted-foreground text-sm">
												No candidates yet
											</p>
										) : (
											<div className="space-y-2">
												{ballot.candidates.map((candidate) => {
													const status =
														"status" in candidate ? candidate.status : "ACTIVE";
													const statusReason =
														"statusReason" in candidate
															? candidate.statusReason
															: null;
													const isWithdrawnOrDisqualified =
														status === "WITHDRAWN" || status === "DISQUALIFIED";
													return (
														<div
															key={candidate.id}
															className="flex items-start justify-between rounded-lg border p-3"
														>
															<div className="space-y-1">
																<div className="flex flex-wrap items-center gap-2">
																	<p className="font-medium text-sm">
																		{candidate.name}
																	</p>
																	{isWithdrawnOrDisqualified && (
																		<Badge
																			variant={
																				status === "DISQUALIFIED"
																					? "destructive"
																					: "secondary"
																			}
																			className="text-xs"
																		>
																			{status === "WITHDRAWN"
																				? "Withdrawn"
																				: "Disqualified"}
																		</Badge>
																	)}
																</div>
																{statusReason && (
																	<p className="text-muted-foreground text-xs">
																		{statusReason}
																	</p>
																)}
																{candidate.statement && (
																	<p className="whitespace-pre-wrap text-muted-foreground text-xs">
																		{candidate.statement}
																	</p>
																)}
															</div>
															<div className="flex gap-1">
																<Button
																	variant="ghost"
																	size="icon"
																	className="h-8 w-8"
																	onClick={() =>
																		handleEditCandidate(ballot.id, candidate)
																	}
																	aria-label={`Edit ${candidate.name}`}
																>
																	<Edit2 className="h-3 w-3" />
																</Button>
																<DropdownMenu>
																	<DropdownMenuTrigger asChild>
																		<Button
																			variant="ghost"
																			size="icon"
																			className="h-8 w-8"
																			aria-label={`Set status for ${candidate.name}`}
																		>
																			<MoreHorizontal className="h-3 w-3" />
																		</Button>
																	</DropdownMenuTrigger>
																	<DropdownMenuContent align="end">
																		<DropdownMenuItem
																			onClick={() => {
																				if (
																					confirm(
																						`Mark ${candidate.name} as active again?`,
																					)
																				) {
																					setCandidateStatus.mutate({
																						id: candidate.id,
																						status: "ACTIVE",
																					});
																				}
																			}}
																			disabled={
																				setCandidateStatus.isPending ||
																				status === "ACTIVE"
																			}
																		>
																			Mark active
																		</DropdownMenuItem>
																		<DropdownMenuItem
																			onClick={() => {
																				setStatusDialog({
																					candidateId: candidate.id,
																					candidateName: candidate.name,
																					status: "WITHDRAWN",
																				});
																				setStatusReasonInput("");
																			}}
																		>
																			Mark withdrawn…
																		</DropdownMenuItem>
																		<DropdownMenuItem
																			variant="destructive"
																			onClick={() => {
																				setStatusDialog({
																					candidateId: candidate.id,
																					candidateName: candidate.name,
																					status: "DISQUALIFIED",
																				});
																				setStatusReasonInput("");
																			}}
																		>
																			Mark disqualified…
																		</DropdownMenuItem>
																	</DropdownMenuContent>
																</DropdownMenu>
																<Button
																	variant="ghost"
																	size="icon"
																	className="h-8 w-8"
																	onClick={() =>
																		handleDeleteCandidate(candidate.id)
																	}
																	disabled={deleteCandidate.isPending}
																	aria-label={`Delete ${candidate.name}`}
																>
																	<Trash2 className="h-3 w-3" />
																</Button>
															</div>
														</div>
													);
												})}
											</div>
										)}
									</div>
								)}
							</CardContent>
							<CardFooter className="flex items-center gap-2 text-muted-foreground text-sm">
								<Users className="h-4 w-4" />
								<span>
									{ballot._count.votes}{" "}
									{ballot._count.votes === 1 ? "vote" : "votes"}
								</span>
							</CardFooter>
						</Card>
					))}
				</div>
			)}

			<BallotForm
				electionId={electionId}
				ballot={editingBallot ?? undefined}
				open={ballotFormOpen}
				onOpenChange={handleCloseBallotForm}
			/>

			{selectedBallotId && (
				<CandidateForm
					electionId={electionId}
					ballotId={selectedBallotId}
					candidate={editingCandidate ?? undefined}
					open={candidateFormOpen}
					onOpenChange={handleCloseCandidateForm}
				/>
			)}

			<Dialog
				open={statusDialog !== null}
				onOpenChange={(open) => {
					if (!open) setStatusDialog(null);
				}}
			>
				<DialogContent className="sm:max-w-[425px]">
					<DialogHeader>
						<DialogTitle>
							Mark as{" "}
							{statusDialog?.status === "WITHDRAWN"
								? "Withdrawn"
								: "Disqualified"}
						</DialogTitle>
						<DialogDescription>
							{statusDialog && (
								<>
									Set <strong>{statusDialog.candidateName}</strong> as{" "}
									{statusDialog.status === "WITHDRAWN"
										? "withdrawn"
										: "disqualified"}
									. Votes for this candidate will count for quorum only; on
									ranked ballots, votes will flow to the next choice.
								</>
							)}
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="status-reason">Reason (optional)</Label>
							<Input
								id="status-reason"
								value={statusReasonInput}
								onChange={(e) => setStatusReasonInput(e.target.value)}
								placeholder="e.g., Withdrew on 2025-03-01"
								aria-describedby="status-reason-description"
							/>
							<p
								id="status-reason-description"
								className="text-muted-foreground text-xs"
							>
								Shown on the public results page.
							</p>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setStatusDialog(null)}
							disabled={setCandidateStatus.isPending}
						>
							Cancel
						</Button>
						<Button
							onClick={() => {
								if (!statusDialog) return;
								setCandidateStatus.mutate({
									id: statusDialog.candidateId,
									status: statusDialog.status,
									statusReason: statusReasonInput.trim() || undefined,
								});
							}}
							disabled={setCandidateStatus.isPending}
						>
							{setCandidateStatus.isPending ? "Saving…" : "Confirm"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
