"use client";

import { PublicLayout } from "@/components/layouts/public-layout";
import { ResultsChart } from "@/components/results/results-chart";
import { ResultsTable } from "@/components/results/results-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/results/formatter";
import { api } from "@/trpc/react";
import { AlertCircle, Calendar, Users, Vote } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";

export default function PublicResultsPage() {
	const params = useParams();
	const electionId = params.electionId as string;
	const [showCharts, setShowCharts] = useState(false);

	// Fetch results
	const {
		data: results,
		isLoading,
		error,
	} = api.results.getElectionResults.useQuery({
		electionId,
	});

	if (isLoading) {
		return (
			<PublicLayout>
				<div className="mx-auto max-w-6xl">
					<div className="flex items-center justify-center py-12">
						<div className="text-center">
							<div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
							<p className="text-muted-foreground">Loading results...</p>
						</div>
					</div>
				</div>
			</PublicLayout>
		);
	}

	if (error || !results) {
		return (
			<PublicLayout>
				<div className="mx-auto max-w-6xl">
					<Card>
						<CardContent className="pt-6">
							<div className="text-center">
								<AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
								<h3 className="mb-2 font-semibold text-lg">
									Results Not Available
								</h3>
								<p className="text-muted-foreground">
									{error?.message || "Results have not been published yet."}
								</p>
							</div>
						</CardContent>
					</Card>
				</div>
			</PublicLayout>
		);
	}

	return (
		<PublicLayout>
			<div className="mx-auto max-w-6xl space-y-6">
				{/* Header */}
				<div className="text-center">
					<h1 className="mb-2 font-bold text-4xl">{results.electionName}</h1>
					<p className="text-muted-foreground text-xl">
						Unofficial Election Results
					</p>
					{results.isPublished && results.publishedAt && (
						<p className="mt-2 text-muted-foreground text-sm">
							Published on {formatDate(results.publishedAt)}
						</p>
					)}
				</div>

				{/* Status Banner */}
				<Card className="border-blue-500 bg-blue-50">
					<CardContent className="pt-6">
						<div className="flex items-center justify-center gap-2">
							<Badge variant="default" className="bg-blue-600">
								Unofficial Results
							</Badge>
							{results.isFinalized && (
								<Badge variant="default" className="bg-green-600">
									Finalized
								</Badge>
							)}
						</div>
						<p className="mt-2 text-center text-muted-foreground text-sm">
							These results are unofficial and will be deemed official after
							approval by the CSA Board of Directors at the next board meeting.
						</p>
					</CardContent>
				</Card>

				{/* Overview Statistics */}
				<div className="grid gap-4 md:grid-cols-3">
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="flex items-center gap-2 text-base">
								<Users className="h-4 w-4" />
								Voter Turnout
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-2">
								<div className="font-bold text-3xl">
									{results.turnoutPercentage.toFixed(1)}%
								</div>
								<div className="text-muted-foreground text-sm">
									{results.totalVoted.toLocaleString()} out of{" "}
									{results.totalEligibleVoters.toLocaleString()} eligible voters
								</div>
								<div className="h-2 w-full rounded-full bg-muted">
									<div
										className="h-full rounded-full bg-primary"
										style={{ width: `${results.turnoutPercentage}%` }}
									/>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="flex items-center gap-2 text-base">
								<Vote className="h-4 w-4" />
								Total Ballots
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-2">
								<div className="font-bold text-3xl">
									{results.ballots.length}
								</div>
								<div className="text-muted-foreground text-sm">
									Positions and referendums voted on
								</div>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="flex items-center gap-2 text-base">
								<Calendar className="h-4 w-4" />
								Total Votes Cast
							</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="space-y-2">
								<div className="font-bold text-3xl">
									{results.ballots
										.reduce((sum, b) => sum + b.totalVotes, 0)
										.toLocaleString()}
								</div>
								<div className="text-muted-foreground text-sm">
									Across all ballots
								</div>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Transparency Notice */}
				<Card>
					<CardHeader>
						<CardTitle>Transparency & Verification</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground text-sm">
							The CSA Voting Platform is committed to transparency and
							verifiability. All votes are anonymously recorded and can be
							verified using cryptographic hashes.
						</p>
						<div className="grid gap-4 md:grid-cols-2">
							<div className="rounded-lg border p-4">
								<h4 className="mb-2 font-medium">Data Integrity</h4>
								<p className="text-muted-foreground text-sm">
									All votes are cryptographically hashed and stored immutably.
									No votes can be modified after casting.
								</p>
							</div>
							<div className="rounded-lg border p-4">
								<h4 className="mb-2 font-medium">Voter Anonymity</h4>
								<p className="text-muted-foreground text-sm">
									Vote records are completely anonymous. There is no way to link
									a vote to a specific voter's identity.
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Results for each ballot */}
				<div className="space-y-8">
					<div className="flex items-center justify-between">
						<h2 className="font-bold text-2xl">Detailed Results</h2>
						<Button
							variant="outline"
							onClick={() => setShowCharts(!showCharts)}
						>
							{showCharts ? "Hide Charts" : "Show Charts"}
						</Button>
					</div>
					{results.ballots.map((ballot) => (
						<div key={ballot.ballotId} className="space-y-4">
							<ResultsTable ballot={ballot} isAdmin={false} />
							{showCharts && ballot.hasReachedQuorum && (
								<ResultsChart ballot={ballot} type="bar" />
							)}
						</div>
					))}
				</div>

				{/* Footer */}
				<Card>
					<CardContent className="pt-6">
						<div className="text-center text-muted-foreground text-sm">
							<p>
								For questions about these results, please contact the Chief
								Returning Officer (CRO) at the Central Student Association.
							</p>
							<p className="mt-2">
								Generated on{" "}
								{new Date().toLocaleString("en-US", {
									year: "numeric",
									month: "long",
									day: "numeric",
									hour: "2-digit",
									minute: "2-digit",
									timeZone: "America/Toronto",
								})}
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</PublicLayout>
	);
}
