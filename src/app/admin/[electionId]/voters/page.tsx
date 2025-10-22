import Link from "next/link";
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
		<div>
			{/* Header */}
			{/* Header */}
			<div className="mb-8">
				<div className="mb-2 flex items-center gap-2">
					<Button variant="ghost" size="sm" asChild className="text-gray-700">
						<Link href={`/admin/${electionId}`}>← Back to {election.name}</Link>
					</Button>
				</div>
				<h1 className="font-bold text-4xl text-gray-900">Voter Management</h1>
				<p className="text-gray-600">{election.name}</p>
			</div>{" "}
			{/* Statistics */}
			<div className="mb-8 grid gap-4 md:grid-cols-4">
				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Total Voters</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="font-bold text-3xl text-slate-900">
							{stats.totalVoters.toLocaleString()}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Voted</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="font-bold text-3xl text-green-600">
							{stats.totalVoted.toLocaleString()}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Not Voted</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="font-bold text-3xl text-slate-600">
							{stats.totalNotVoted.toLocaleString()}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardDescription>Turnout</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="font-bold text-3xl text-blue-600">
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
						<div className="grid gap-2 md:grid-cols-6">
							{stats.byCollege.map((college) => (
								<div
									key={college.college}
									className="flex justify-between rounded-lg bg-slate-100 px-4 py-2"
								>
									<span className="font-medium text-slate-900">
										{college.college}
									</span>
									<span className="text-slate-600">
										{college.totalVoters.toLocaleString()}
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
	);
}
