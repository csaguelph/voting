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
import { Textarea } from "@/components/ui/textarea";
import { COLLEGES } from "@/lib/constants/colleges";
import { api } from "@/trpc/react";

const ballotFormSchema = z.object({
	title: z.string().min(1, "Title is required"),
	type: z.enum(["EXECUTIVE", "DIRECTOR", "REFERENDUM"]),
	college: z.string().optional(),
	seatsAvailable: z.coerce.number().int().min(1),
	// Referendum fields
	preamble: z.string().optional(),
	question: z.string().optional(),
	sponsor: z.string().optional(),
});

type BallotFormValues = z.infer<typeof ballotFormSchema>;

interface BallotFormProps {
	electionId: string;
	ballot?: {
		id: string;
		title: string;
		type: "EXECUTIVE" | "DIRECTOR" | "REFERENDUM";
		college?: string | null;
		seatsAvailable: number;
		preamble?: string | null;
		question?: string | null;
		sponsor?: string | null;
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
			seatsAvailable: ballot?.seatsAvailable ?? 1,
			preamble: ballot?.preamble ?? undefined,
			question: ballot?.question ?? undefined,
			sponsor: ballot?.sponsor ?? undefined,
		},
	});

	const ballotType = form.watch("type");
	const isDirectorBallot = ballotType === "DIRECTOR";
	const isReferendumBallot = ballotType === "REFERENDUM";

	const onSubmit = async (data: BallotFormValues) => {
		setIsSubmitting(true);
		try {
			if (ballot) {
				// Update existing ballot
				await updateBallot.mutateAsync({
					id: ballot.id,
					title: data.title,
					college: isDirectorBallot ? data.college : undefined,
					seatsAvailable: data.seatsAvailable,
					preamble: isReferendumBallot ? data.preamble : undefined,
					question: isReferendumBallot ? data.question : undefined,
					sponsor: isReferendumBallot ? data.sponsor : undefined,
				});
			} else {
				// Create new ballot
				await createBallot.mutateAsync({
					electionId,
					title: data.title,
					type: data.type,
					college: isDirectorBallot ? data.college : undefined,
					seatsAvailable: data.seatsAvailable,
					preamble: isReferendumBallot ? data.preamble : undefined,
					question: isReferendumBallot ? data.question : undefined,
					sponsor: isReferendumBallot ? data.sponsor : undefined,
				});
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle>
						{ballot ? "Edit Ballot" : "Create New Ballot"}
					</DialogTitle>
					<DialogDescription>
						{ballot
							? "Update the ballot details below."
							: "Add a new ballot to this election. Executive ballots are for university-wide positions. Director ballots are for college-specific positions. Referendum ballots are for yes/no questions."}
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="flex flex-col overflow-hidden"
					>
						<div className="space-y-4 overflow-y-auto px-1 pr-3">
							<FormField
								control={form.control}
								name="title"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Title</FormLabel>
										<FormControl>
											<Input
												placeholder={
													isReferendumBallot
														? "e.g., Transit Funding"
														: "e.g., President, COE Director"
												}
												{...field}
											/>
										</FormControl>
										<FormDescription>
											{isReferendumBallot
												? "Internal short-form name for the referendum"
												: "The position or role being voted on"}
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
													<SelectItem value="REFERENDUM">
														Referendum (Yes/No Question)
													</SelectItem>
												</SelectContent>
											</Select>
											<FormDescription>
												Executive ballots are open to all voters. Director
												ballots are restricted by college. Referendums are
												yes/no questions.
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							)}

							{!isReferendumBallot && (
								<FormField
									control={form.control}
									name="seatsAvailable"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Seats Available</FormLabel>
											<FormControl>
												<Input
													type="number"
													min={1}
													placeholder="1"
													{...field}
													onChange={(e) =>
														field.onChange(Number.parseInt(e.target.value, 10))
													}
												/>
											</FormControl>
											<FormDescription>
												Number of positions available. Set to 2+ for multi-seat
												elections where voters can select multiple candidates.
											</FormDescription>
											<FormMessage />
										</FormItem>
									)}
								/>
							)}

							{isReferendumBallot && (
								<>
									<FormField
										control={form.control}
										name="preamble"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Preamble</FormLabel>
												<FormControl>
													<Textarea
														placeholder="Provide context and background for this referendum..."
														className="min-h-[100px]"
														{...field}
													/>
												</FormControl>
												<FormDescription>
													Background information and context for voters
													(optional)
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="question"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Question *</FormLabel>
												<FormControl>
													<Textarea
														placeholder="e.g., Do you support increasing student fees by $2 per semester to fund improved transit service?"
														className="min-h-[80px]"
														{...field}
													/>
												</FormControl>
												<FormDescription>
													The actual referendum question voters will answer
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="sponsor"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Sponsor</FormLabel>
												<FormControl>
													<Input
														placeholder="e.g., CSA Board of Directors"
														{...field}
													/>
												</FormControl>
												<FormDescription>
													Who is sponsoring this referendum (optional)
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>
								</>
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
						</div>
						<DialogFooter className="mt-4">
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
