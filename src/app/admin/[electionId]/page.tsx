import { Activity, Calendar, FileText, Users, Vote } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ExtendDeadlineDialog } from "@/components/admin/extend-deadline-dialog";
import { MonitoringDashboard } from "@/components/admin/monitoring-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireAdmin } from "@/lib/auth/permissions";
import { api } from "@/trpc/server";

interface PageProps {
	params: Promise<{ electionId: string }>;
}

/**
 * Election Management Page
 * Central hub for managing a specific election
 * Protected: Requires ADMIN or CRO role
 */
export default async function ElectionManagementPage({ params }: PageProps) {
	await requireAdmin();

	const { electionId } = await params;

	// Fetch election details
	const election = await api.election.getById({ id: electionId });

	if (!election) {
		notFound();
	}

	// Fetch voter statistics
	const stats = await api.admin.getVoterStats({ electionId });

	const now = new Date();
	const hasStarted = new Date(election.startTime) <= now;
	const hasEnded = new Date(election.endTime) <= now;
	const isLive = hasStarted && !hasEnded;

	return (
		<div>
			{/* Header */}
			<div className="mb-8">
				<div className="mb-4 flex items-center gap-2">
					<Button variant="ghost" size="sm" asChild className="text-gray-700">
						<Link href="/admin">← Back to Dashboard</Link>
					</Button>
				</div>
				<div className="flex items-start justify-between">
					<div className="flex-1">
						<h1 className="mb-2 font-bold text-4xl text-gray-900">
							{election.name}
						</h1>
						<p className="text-gray-600">
							{election.description || "No description provided"}
						</p>
					</div>
					<div className="flex gap-2">
						{election.isActive && (
							<Badge variant="default" className="h-fit">
								Active
							</Badge>
						)}
						{isLive && (
							<Badge variant="default" className="h-fit bg-green-600">
								Live
							</Badge>
						)}
						{hasEnded && (
							<Badge variant="secondary" className="h-fit">
								Ended
							</Badge>
						)}
					</div>
				</div>
			</div>

			{/* Quick Stats */}
			<div className="mb-8 grid gap-4 md:grid-cols-4">
				<Card>
					<CardHeader className="pb-2">
						<CardDescription className="flex items-center gap-2">
							<Calendar className="h-4 w-4" />
							Start Time
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="font-medium text-gray-900">
							{new Date(election.startTime).toLocaleString()}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardDescription className="flex items-center gap-2">
							<Calendar className="h-4 w-4" />
							End Time
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="font-medium text-gray-900">
							{new Date(election.endTime).toLocaleString()}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardDescription className="flex items-center gap-2">
							<Users className="h-4 w-4" />
							Voter Turnout
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="font-bold text-2xl text-blue-600">
							{stats.turnoutPercentage.toFixed(1)}%
						</p>
						<p className="text-gray-600 text-xs">
							{stats.totalVoted} / {stats.totalVoters}
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardDescription className="flex items-center gap-2">
							<Vote className="h-4 w-4" />
							Ballots
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="font-bold text-2xl text-gray-900">
							{election.ballots.length}
						</p>
						<p className="text-gray-600 text-xs">
							{election.ballots.reduce(
								(sum, b) => sum + b.candidates.length,
								0,
							)}{" "}
							candidates
						</p>
					</CardContent>
				</Card>
			</div>

			{/* Main Content - Tabs */}
			<Tabs
				defaultValue={isLive ? "monitoring" : "overview"}
				className="space-y-6"
			>
				<TabsList>
					{isLive && (
						<TabsTrigger value="monitoring">
							<Activity className="mr-2 h-4 w-4" />
							Live Monitoring
						</TabsTrigger>
					)}
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="voters">Voters ({stats.totalVoters})</TabsTrigger>
					<TabsTrigger value="ballots">
						Ballots ({election.ballots.length})
					</TabsTrigger>
					<TabsTrigger value="results">Results</TabsTrigger>
				</TabsList>

				{/* Live Monitoring Tab - Only visible when election is active */}
				{isLive && (
					<TabsContent value="monitoring" className="space-y-6">
						<div className="flex justify-end">
							<ExtendDeadlineDialog
								electionId={electionId}
								currentEndTime={election.endTime}
							/>
						</div>
						<MonitoringDashboard electionId={electionId} />
					</TabsContent>
				)}

				{/* Overview Tab */}
				<TabsContent value="overview" className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Election Details</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div>
								<p className="mb-1 font-medium text-gray-600 text-sm">Status</p>
								<p className="text-gray-900">
									{!hasStarted
										? "Not Started"
										: hasEnded
											? "Completed"
											: "In Progress"}
								</p>
							</div>
							<div>
								<p className="mb-1 font-medium text-gray-600 text-sm">
									Duration
								</p>
								<p className="text-gray-900">
									{new Date(election.startTime).toLocaleDateString()} -{" "}
									{new Date(election.endTime).toLocaleDateString()}
								</p>
							</div>
							<div>
								<p className="mb-1 font-medium text-gray-600 text-sm">
									Created
								</p>
								<p className="text-gray-900">
									{new Date(election.createdAt).toLocaleString()}
								</p>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Quick Actions</CardTitle>
							<CardDescription>
								Common tasks for managing this election
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-4 md:grid-cols-2">
							<Button asChild>
								<Link href={`/admin/${electionId}/voters`}>
									<Users className="mr-2 h-4 w-4" />
									Manage Voters
								</Link>
							</Button>
							<Button variant="outline" asChild>
								<Link href={`/admin/${electionId}/ballots`}>
									<Vote className="mr-2 h-4 w-4" />
									Manage Ballots
								</Link>
							</Button>
							<Button variant="outline" disabled>
								<FileText className="mr-2 h-4 w-4" />
								View Audit Log
							</Button>
							<Button variant="outline" disabled>
								<FileText className="mr-2 h-4 w-4" />
								Export Results
							</Button>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Voters Tab */}
				<TabsContent value="voters" className="space-y-6">
					<div className="mb-4">
						<Button asChild>
							<Link href={`/admin/${electionId}/voters`}>
								<Users className="mr-2 h-4 w-4" />
								Go to Voter Management
							</Link>
						</Button>
					</div>

					<div>
						<h3 className="mb-4 font-semibold text-gray-900 text-lg">
							Eligible Voters by College
						</h3>
						<div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
							{stats.byCollege.map((college) => (
								<Card key={college.college}>
									<CardHeader className="pb-2">
										<CardTitle className="text-base">
											{college.college}
										</CardTitle>
									</CardHeader>
									<CardContent>
										<p className="font-bold text-3xl text-gray-900">
											{college.totalVoters}
										</p>
										<p className="text-gray-600 text-sm">Eligible Voters</p>
									</CardContent>
								</Card>
							))}
						</div>
					</div>
				</TabsContent>

				{/* Ballots Tab */}
				<TabsContent value="ballots">
					<div className="mb-4">
						<Button asChild>
							<Link href={`/admin/${electionId}/ballots`}>
								<Vote className="mr-2 h-4 w-4" />
								Go to Ballot Management
							</Link>
						</Button>
					</div>

					<Card>
						<CardHeader>
							<CardTitle>Ballots & Candidates</CardTitle>
							<CardDescription>
								Manage ballot types and candidates for this election
							</CardDescription>
						</CardHeader>
						<CardContent>
							{election.ballots.length === 0 ? (
								<div className="py-8 text-center">
									<p className="mb-4 text-gray-600">
										No ballots created yet. Create your first ballot to start
										adding candidates.
									</p>
									<Button asChild>
										<Link href={`/admin/${electionId}/ballots`}>
											<Vote className="mr-2 h-4 w-4" />
											Create First Ballot
										</Link>
									</Button>
								</div>
							) : (
								<div className="space-y-4">
									{election.ballots.map((ballot) => (
										<div
											key={ballot.id}
											className="flex items-center justify-between rounded-lg border p-4"
										>
											<div>
												<p className="font-medium">{ballot.title}</p>
												<p className="text-gray-600 text-sm">
													{ballot.type}
													{ballot.college && ` - ${ballot.college}`} •{" "}
													{ballot.candidates.length} candidate
													{ballot.candidates.length !== 1 ? "s" : ""}
												</p>
											</div>
											<Button variant="outline" size="sm" asChild>
												<Link href={`/admin/${electionId}/ballots`}>
													Manage
												</Link>
											</Button>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* Results Tab */}
				<TabsContent value="results">
					<div className="mb-4">
						<Button asChild>
							<Link href={`/admin/${electionId}/results`}>
								<FileText className="mr-2 h-4 w-4" />
								Go to Results Page
							</Link>
						</Button>
					</div>

					<Card>
						<CardHeader>
							<CardTitle>Election Results</CardTitle>
							<CardDescription>
								View comprehensive results, finalize, and publish election
								outcomes
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="rounded-lg border p-4">
								<h4 className="mb-2 font-medium">Quick Stats</h4>
								<div className="grid gap-4 md:grid-cols-3">
									<div>
										<p className="text-gray-600 text-sm">Total Votes Cast</p>
										<p className="font-bold text-2xl">{stats.totalVoted}</p>
									</div>
									<div>
										<p className="text-gray-600 text-sm">Turnout</p>
										<p className="font-bold text-2xl">
											{stats.turnoutPercentage.toFixed(1)}%
										</p>
									</div>
									<div>
										<p className="text-gray-600 text-sm">Total Ballots</p>
										<p className="font-bold text-2xl">
											{election.ballots.length}
										</p>
									</div>
								</div>
							</div>
							<p className="text-gray-600 text-sm">
								View detailed results for each ballot, export data, and manage
								publication status on the full results page.
							</p>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
