"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ElectionFormProps {
	mode: "create" | "edit";
	election?: {
		id: string;
		name: string;
		description: string | null;
		startTime: Date;
		endTime: Date;
		isActive: boolean;
	};
	onSubmit: (data: {
		name: string;
		description?: string;
		startTime: Date;
		endTime: Date;
		isActive?: boolean;
	}) => void;
	onCancel: () => void;
	isSubmitting?: boolean;
	onFormChangeRef?: (markChanged: () => void) => void;
}

export function ElectionForm({
	mode,
	election,
	onSubmit,
	onCancel,
	isSubmitting = false,
	onFormChangeRef,
}: ElectionFormProps) {
	const [hasChanges, setHasChanges] = useState(false);
	const [name, setName] = useState(election?.name ?? "");
	const [description, setDescription] = useState(election?.description ?? "");

	// Format dates for input fields
	const formatDateForInput = (date: Date) => {
		const d = new Date(date);
		return d.toISOString().split("T")[0];
	};

	const formatTimeForInput = (date: Date) => {
		const d = new Date(date);
		return d.toTimeString().slice(0, 5);
	};

	const [startDate, setStartDate] = useState(
		election?.startTime ? formatDateForInput(election.startTime) : "",
	);
	const [startTime, setStartTime] = useState(
		election?.startTime ? formatTimeForInput(election.startTime) : "",
	);
	const [endDate, setEndDate] = useState(
		election?.endTime ? formatDateForInput(election.endTime) : "",
	);
	const [endTime, setEndTime] = useState(
		election?.endTime ? formatTimeForInput(election.endTime) : "",
	);

	// Track form changes
	const markAsChanged = useCallback(() => {
		setHasChanges(true);
	}, []);

	// Expose markAsChanged to parent component
	useEffect(() => {
		onFormChangeRef?.(markAsChanged);
	}, [markAsChanged, onFormChangeRef]);

	const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		const startDateTime = new Date(`${startDate}T${startTime}`);
		const endDateTime = new Date(`${endDate}T${endTime}`);

		onSubmit({
			name,
			description: description || undefined,
			startTime: startDateTime,
			endTime: endDateTime,
			...(mode === "create" && { isActive: false }),
		});

		setHasChanges(false);
	};

	const isValid = name.trim() && startDate && startTime && endDate && endTime;

	return (
		<DialogContent className="sm:max-w-[500px]">
			<DialogHeader>
				<DialogTitle>
					{mode === "create" ? "Create New Election" : "Edit Election"}
				</DialogTitle>
				<DialogDescription>
					{mode === "create"
						? "Set up a new election with dates and description."
						: "Update election details and dates."}
				</DialogDescription>
			</DialogHeader>
			<form onSubmit={handleSubmit}>
				<div className="space-y-4 py-4">
					<div>
						<Label htmlFor="name">Election Name *</Label>
						<Input
							id="name"
							value={name}
							onChange={(e) => {
								setName(e.target.value);
								markAsChanged();
							}}
							placeholder="2025 CSA General Election"
							disabled={isSubmitting}
						/>
					</div>
					<div>
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							value={description}
							onChange={(e) => {
								setDescription(e.target.value);
								markAsChanged();
							}}
							placeholder="Annual election for CSA executive and director positions"
							rows={3}
							disabled={isSubmitting}
						/>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<Label htmlFor="startDate">Start Date *</Label>
							<Input
								id="startDate"
								type="date"
								value={startDate}
								onChange={(e) => {
									setStartDate(e.target.value);
									markAsChanged();
								}}
								disabled={isSubmitting}
							/>
						</div>
						<div>
							<Label htmlFor="startTime">Start Time *</Label>
							<Input
								id="startTime"
								type="time"
								value={startTime}
								onChange={(e) => {
									setStartTime(e.target.value);
									markAsChanged();
								}}
								disabled={isSubmitting}
							/>
						</div>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<Label htmlFor="endDate">End Date *</Label>
							<Input
								id="endDate"
								type="date"
								value={endDate}
								onChange={(e) => {
									setEndDate(e.target.value);
									markAsChanged();
								}}
								disabled={isSubmitting}
							/>
						</div>
						<div>
							<Label htmlFor="endTime">End Time *</Label>
							<Input
								id="endTime"
								type="time"
								value={endTime}
								onChange={(e) => {
									setEndTime(e.target.value);
									markAsChanged();
								}}
								disabled={isSubmitting}
							/>
						</div>
					</div>
				</div>
				<div className="flex justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={onCancel}
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					<Button type="submit" disabled={!isValid || isSubmitting}>
						{isSubmitting
							? mode === "create"
								? "Creating..."
								: "Saving..."
							: mode === "create"
								? "Create Election"
								: "Save Changes"}
					</Button>
				</div>
			</form>
		</DialogContent>
	);
}
