"use client";

import { Dices, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { BallotResult, PendingTieBreak } from "@/lib/results/calculator";
import { api } from "@/trpc/react";

interface RecordDrawDialogProps {
	electionId: string;
	ballot: BallotResult & { pendingTieBreak: PendingTieBreak };
}

/**
 * Lets the CRO record the outcome of a draw by lot for a tie that no count
 * separates. The draw itself happens outside the app.
 */
export function RecordDrawDialog({
	electionId,
	ballot,
}: RecordDrawDialogProps) {
	const [open, setOpen] = useState(false);
	const [selected, setSelected] = useState<string[]>([]);
	const utils = api.useUtils();
	const tie = ballot.pendingTieBreak;
	const isExclusion = tie.kind === "EXCLUSION";
	const tied = (ballot.candidates ?? []).filter((c) =>
		tie.candidateIds.includes(c.candidateId),
	);

	const record = api.results.recordTieBreakDraw.useMutation({
		onSuccess: async () => {
			// Wait for the recount to load before confirming
			await utils.results.getElectionResults.invalidate({ electionId });
			setOpen(false);
			setSelected([]);
			toast.success("Draw recorded", {
				description: "Results have been recounted with the draw's outcome.",
			});
		},
		onError: (error) => {
			toast.error("Couldn't record the draw", { description: error.message });
		},
	});

	const prompt = isExclusion
		? "Which candidate did the draw exclude?"
		: tie.select === 1
			? "Which candidate did the draw seat?"
			: `Which ${tie.select} candidates did the draw seat?`;

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setSelected([]);
			}}
		>
			<DialogTrigger asChild>
				<Button size="sm" className="mt-3">
					<Dices className="h-4 w-4" aria-hidden="true" />
					Record draw result…
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Record draw result: {ballot.ballotTitle}</DialogTitle>
					<DialogDescription>
						Hold the draw first, publicly, then record its outcome here. The
						results are recounted using it. Recording is audit-logged and can't
						be undone.
					</DialogDescription>
				</DialogHeader>

				<fieldset className="space-y-3">
					<legend className="mb-2 font-medium text-sm">{prompt}</legend>
					{tie.select === 1 ? (
						<RadioGroup
							value={selected[0] ?? ""}
							onValueChange={(value) => setSelected([value])}
						>
							{tied.map((candidate) => (
								<Label
									key={candidate.candidateId}
									htmlFor={`draw-${candidate.candidateId}`}
									className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2"
								>
									<RadioGroupItem
										id={`draw-${candidate.candidateId}`}
										value={candidate.candidateId}
									/>
									{candidate.name}
								</Label>
							))}
						</RadioGroup>
					) : (
						tied.map((candidate) => (
							<Label
								key={candidate.candidateId}
								htmlFor={`draw-${candidate.candidateId}`}
								className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2"
							>
								<Checkbox
									id={`draw-${candidate.candidateId}`}
									checked={selected.includes(candidate.candidateId)}
									onCheckedChange={(checked) =>
										setSelected((current) =>
											checked
												? [...current, candidate.candidateId]
												: current.filter((id) => id !== candidate.candidateId),
										)
									}
								/>
								{candidate.name}
							</Label>
						))
					)}
				</fieldset>

				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button
						disabled={selected.length !== tie.select || record.isPending}
						onClick={() =>
							record.mutate({
								electionId,
								ballotId: ballot.ballotId,
								selectedCandidateIds: selected,
							})
						}
					>
						{record.isPending && (
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
						)}
						Record draw result
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
