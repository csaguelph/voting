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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { COLLEGES } from "@/lib/constants/colleges";
import { api } from "@/trpc/react";

const ballotFormSchema = z.object({
	title: z.string().min(1, "Title is required"),
	type: z.enum(["EXECUTIVE", "DIRECTOR"]),
	college: z.string().optional(),
});

type BallotFormValues = z.infer<typeof ballotFormSchema>;

interface BallotFormProps {
	electionId: string;
	ballot?: {
		id: string;
		title: string;
		type: "EXECUTIVE" | "DIRECTOR";
		college?: string | null;
	};
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
}

export function BallotForm({
	electionId,
	ballot,
	open,
	onOpenChange,
	onSuccess,
}: BallotFormProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const utils = api.useUtils();

	const createBallot = api.ballot.create.useMutation({
		onSuccess: async () => {
			await utils.ballot.getByElection.invalidate({ electionId });
			onOpenChange(false);
			form.reset();
			onSuccess?.();
		},
	});

	const updateBallot = api.ballot.update.useMutation({
		onSuccess: async () => {
			await utils.ballot.getByElection.invalidate({ electionId });
			onOpenChange(false);
			onSuccess?.();
		},
	});

	const form = useForm<BallotFormValues>({
		resolver: zodResolver(ballotFormSchema),
		defaultValues: {
			title: ballot?.title ?? "",
			type: ballot?.type ?? "EXECUTIVE",
			college: ballot?.college ?? undefined,
		},
	});

	const ballotType = form.watch("type");
	const isDirectorBallot = ballotType === "DIRECTOR";

	const onSubmit = async (data: BallotFormValues) => {
		setIsSubmitting(true);
		try {
			if (ballot) {
				// Update existing ballot
				await updateBallot.mutateAsync({
					id: ballot.id,
					title: data.title,
					college: isDirectorBallot ? data.college : undefined,
				});
			} else {
				// Create new ballot
				await createBallot.mutateAsync({
					electionId,
					title: data.title,
					type: data.type,
					college: isDirectorBallot ? data.college : undefined,
				});
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>
						{ballot ? "Edit Ballot" : "Create New Ballot"}
					</DialogTitle>
					<DialogDescription>
						{ballot
							? "Update the ballot details below."
							: "Add a new ballot to this election. Executive ballots are for university-wide positions. Director ballots are for college-specific positions."}
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="title"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Title</FormLabel>
									<FormControl>
										<Input
											placeholder="e.g., President, COE Director"
											{...field}
										/>
									</FormControl>
									<FormDescription>
										The position or role being voted on
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						{!ballot && (
							<FormField
								control={form.control}
								name="type"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Ballot Type</FormLabel>
										<Select
											onValueChange={field.onChange}
											defaultValue={field.value}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select ballot type" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="EXECUTIVE">
													Executive (University-wide)
												</SelectItem>
												<SelectItem value="DIRECTOR">
													Director (College-specific)
												</SelectItem>
											</SelectContent>
										</Select>
										<FormDescription>
											Executive ballots are open to all voters. Director ballots
											are restricted by college.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}

						{isDirectorBallot && (
							<FormField
								control={form.control}
								name="college"
								render={({ field }) => (
									<FormItem>
										<FormLabel>College</FormLabel>
										<Select
											onValueChange={field.onChange}
											defaultValue={field.value}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue placeholder="Select college" />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												{COLLEGES.map((college) => (
													<SelectItem key={college} value={college}>
														{college}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										<FormDescription>
											Only students from this college can vote on this ballot
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
						)}

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
									? ballot
										? "Updating..."
										: "Creating..."
									: ballot
										? "Update Ballot"
										: "Create Ballot"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
