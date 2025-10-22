"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";

const candidateFormSchema = z.object({
	name: z.string().min(1, "Name is required"),
	statement: z.string().optional(),
});

type CandidateFormValues = z.infer<typeof candidateFormSchema>;

interface CandidateFormProps {
	electionId: string;
	ballotId: string;
	candidate?: {
		id: string;
		name: string;
		statement?: string | null;
	};
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
}

export function CandidateForm({
	electionId,
	ballotId,
	candidate,
	open,
	onOpenChange,
	onSuccess,
}: CandidateFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const utils = api.useUtils();

	const addCandidate = api.ballot.addCandidate.useMutation({
		onSuccess: async () => {
			await utils.ballot.getByElection.invalidate({ electionId });
			await utils.ballot.getById.invalidate({ id: ballotId });
			onOpenChange(false);
			form.reset();
			onSuccess?.();
		},
	});

	const updateCandidate = api.ballot.updateCandidate.useMutation({
		onSuccess: async () => {
			await utils.ballot.getByElection.invalidate({ electionId });
			await utils.ballot.getById.invalidate({ id: ballotId });
			onOpenChange(false);
			onSuccess?.();
		},
	});

	const form = useForm<CandidateFormValues>({
		resolver: zodResolver(candidateFormSchema),
		defaultValues: {
			name: candidate?.name ?? "",
			statement: candidate?.statement ?? "",
		},
	});

	const onSubmit = async (data: CandidateFormValues) => {
		setIsSubmitting(true);
		try {
			if (candidate) {
				// Update existing candidate
				await updateCandidate.mutateAsync({
					id: candidate.id,
					name: data.name,
					statement: data.statement,
				});
			} else {
				// Add new candidate
				await addCandidate.mutateAsync({
					ballotId,
					name: data.name,
					statement: data.statement,
				});
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle>
						{candidate ? "Edit Candidate" : "Add Candidate"}
					</DialogTitle>
					<DialogDescription>
						{candidate
							? "Update the candidate's information below."
							: "Add a new candidate to this ballot."}
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Candidate Name</FormLabel>
									<FormControl>
										<Input placeholder="e.g., John Doe" {...field} />
									</FormControl>
									<FormDescription>
										The full name of the candidate
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="statement"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Candidate Statement (Optional)</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Enter candidate's statement or platform..."
											className="min-h-[120px]"
											{...field}
										/>
									</FormControl>
									<FormDescription>
										A brief statement about the candidate's goals and platform
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
								disabled={isSubmitting}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting
									? candidate
										? "Updating..."
										: "Adding..."
									: candidate
										? "Update Candidate"
										: "Add Candidate"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
