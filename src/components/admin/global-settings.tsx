"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
import { api } from "@/trpc/react";

const quorumSchema = z.object({
	executiveQuorum: z.number().min(1).max(100),
	directorQuorum: z.number().min(1).max(100),
	referendumQuorum: z.number().min(1).max(100),
});

type QuorumFormData = z.infer<typeof quorumSchema>;

export function GlobalSettings() {
	const { data: settings, isLoading } = api.settings.getGlobal.useQuery();
	const utils = api.useUtils();

	const updateMutation = api.settings.updateQuorum.useMutation({
		onSuccess: () => {
			void utils.settings.getGlobal.invalidate();
		},
	});

	const form = useForm<QuorumFormData>({
		resolver: zodResolver(quorumSchema),
		defaultValues: {
			executiveQuorum: 10,
			directorQuorum: 10,
			referendumQuorum: 20,
		},
		values: settings
			? {
					executiveQuorum: settings.executiveQuorum,
					directorQuorum: settings.directorQuorum,
					referendumQuorum: settings.referendumQuorum,
				}
			: undefined,
	});

	const onSubmit = (data: QuorumFormData) => {
		updateMutation.mutate(data);
	};

	if (isLoading) {
		return (
			<Card>
				<CardContent className="py-8">
					<p className="text-center text-muted-foreground">
						Loading settings...
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Quorum Settings</CardTitle>
				<CardDescription>
					Set the minimum percentage of eligible voters required for each ballot
					type to reach quorum
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
						<FormField
							control={form.control}
							name="executiveQuorum"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Executive Quorum (%)</FormLabel>
									<FormControl>
										<Input
											type="number"
											min={1}
											max={100}
											{...field}
											onChange={(e) =>
												field.onChange(Number.parseInt(e.target.value))
											}
										/>
									</FormControl>
									<FormDescription>
										Minimum turnout percentage required for President, VP
										Internal, and other executive positions
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="directorQuorum"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Director Quorum (%)</FormLabel>
									<FormControl>
										<Input
											type="number"
											min={1}
											max={100}
											{...field}
											onChange={(e) =>
												field.onChange(Number.parseInt(e.target.value))
											}
										/>
									</FormControl>
									<FormDescription>
										Minimum turnout percentage required for college director
										positions (calculated per college)
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="referendumQuorum"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Referendum Quorum (%)</FormLabel>
									<FormControl>
										<Input
											type="number"
											min={1}
											max={100}
											{...field}
											onChange={(e) =>
												field.onChange(Number.parseInt(e.target.value))
											}
										/>
									</FormControl>
									<FormDescription>
										Minimum turnout percentage required for referendums
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="flex gap-2">
							<Button type="submit" disabled={updateMutation.isPending}>
								{updateMutation.isPending ? "Saving..." : "Save Settings"}
							</Button>
							{form.formState.isDirty && (
								<Button
									type="button"
									variant="outline"
									onClick={() => form.reset()}
								>
									Reset
								</Button>
							)}
						</div>

						{updateMutation.isSuccess && (
							<p className="text-green-600 text-sm">
								Settings saved successfully!
							</p>
						)}

						{updateMutation.isError && (
							<p className="text-destructive text-sm">
								Failed to save settings. Please try again.
							</p>
						)}
					</form>
				</Form>
			</CardContent>
		</Card>
	);
}
