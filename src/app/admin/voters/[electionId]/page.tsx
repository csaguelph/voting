import { notFound } from "next/navigation";

import { CSVUpload } from "@/components/admin/csv-upload";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/permissions";
import { api } from "@/trpc/server";

interface PageProps {
	params: Promise<{ electionId: string }>;
}

/**
 * Voter Management Page
 * Allows admins/CROs to import and manage eligible voters for an election
 * Protected: Requires ADMIN or CRO role
 */
export default async function VoterManagementPage({ params }: PageProps) {
	// Require admin authentication
	await requireAdmin();

	const { electionId } = await params;

	// Fetch election details
	const election = await api.election.getById({ id: electionId });

	if (!election) {
		notFound();
	}

	// Fetch voter statistics
	const stats = await api.admin.getVoterStats({ electionId });

	return (
		<div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
			<div className="container mx-auto px-4 py-16">
				{/* Header */}
				<div className="mb-8">
					<div className="mb-2 flex items-center gap-2">
						<Button variant="ghost" size="sm" asChild>
							<a href="/admin">← Back to Admin</a>
						</Button>
					</div>
					<h1 className="font-bold text-4xl text-slate-900 dark:text-slate-50">
						Voter Management
					</h1>
					<p className="text-lg text-slate-600 dark:text-slate-300">
						{election.name}
					</p>
				</div>

				{/* Statistics */}
				<div className="mb-8 grid gap-4 md:grid-cols-4">
					<Card>
						<CardHeader className="pb-2">
							<CardDescription>Total Voters</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-3xl text-slate-900 dark:text-slate-50">
								{stats.totalVoters.toLocaleString()}
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-2">
							<CardDescription>Voted</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-3xl text-green-600 dark:text-green-400">
								{stats.totalVoted.toLocaleString()}
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-2">
							<CardDescription>Not Voted</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-3xl text-slate-600 dark:text-slate-400">
								{stats.totalNotVoted.toLocaleString()}
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-2">
							<CardDescription>Turnout</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="font-bold text-3xl text-blue-600 dark:text-blue-400">
								{stats.turnoutPercentage.toFixed(1)}%
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Distribution by College */}
				{stats.byCollege.length > 0 && (
					<Card className="mb-8">
						<CardHeader>
							<CardTitle>Distribution by College</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="grid gap-2 md:grid-cols-3">
								{stats.byCollege.map((college) => (
									<div
										key={college.college}
										className="flex justify-between rounded-lg bg-slate-100 px-4 py-2 dark:bg-slate-800"
									>
										<span className="font-medium text-slate-900 dark:text-slate-50">
											{college.college}
										</span>
										<span className="text-slate-600 dark:text-slate-300">
											{college.count.toLocaleString()}
										</span>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				)}

				{/* CSV Upload */}
				<CSVUpload electionId={electionId} />
			</div>
		</div>
	);
}
