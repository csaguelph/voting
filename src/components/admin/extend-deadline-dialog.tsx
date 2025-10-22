"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";
import { Calendar, Clock, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface ExtendDeadlineDialogProps {
	electionId: string;
	currentEndTime: Date;
}

export function ExtendDeadlineDialog({
	electionId,
	currentEndTime,
}: ExtendDeadlineDialogProps) {
	const [open, setOpen] = useState(false);
	const [newEndTime, setNewEndTime] = useState("");
	const router = useRouter();

	const utils = api.useUtils();

	const updateEndTime = api.admin.updateElectionEndTime.useMutation({
		onSuccess: async () => {
			await utils.election.getById.invalidate({ id: electionId });
			await utils.admin.getMonitoringData.invalidate({ electionId });
			setOpen(false);
			router.refresh();
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!newEndTime) return;

		const endDate = new Date(newEndTime);
		updateEndTime.mutate({
			electionId,
			endTime: endDate,
		});
	};

	// Format current end time for display
	const currentEndTimeFormatted = new Date(currentEndTime).toLocaleString();

	// Get minimum datetime (current end time)
	const minDateTime = new Date(currentEndTime).toISOString().slice(0, 16);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					<Clock className="mr-2 h-4 w-4" />
					Extend Deadline
				</Button>
			</DialogTrigger>
			<DialogContent>
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Extend Election Deadline</DialogTitle>
						<DialogDescription>
							Update the election end time to give voters more time. You can
							only extend the deadline, not shorten it.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="current-end">Current End Time</Label>
							<div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
								<Calendar className="h-4 w-4 text-muted-foreground" />
								<span>{currentEndTimeFormatted}</span>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor="new-end">New End Time</Label>
							<Input
								id="new-end"
								type="datetime-local"
								value={newEndTime}
								onChange={(e) => setNewEndTime(e.target.value)}
								min={minDateTime}
								required
							/>
							<p className="text-muted-foreground text-xs">
								Select a date and time after the current deadline
							</p>
						</div>

						{updateEndTime.error && (
							<Alert variant="destructive">
								<AlertDescription>
									{updateEndTime.error.message}
								</AlertDescription>
							</Alert>
						)}
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setOpen(false)}
							disabled={updateEndTime.isPending}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={updateEndTime.isPending}>
							{updateEndTime.isPending ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Updating...
								</>
							) : (
								"Update Deadline"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
