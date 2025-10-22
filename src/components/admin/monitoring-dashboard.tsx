"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/trpc/react";
import { AlertCircle, CheckCircle, TrendingUp } from "lucide-react";

interface MonitoringDashboardProps {
	electionId: string;
}

export function MonitoringDashboard({ electionId }: MonitoringDashboardProps) {
	const { data, isLoading, error } = api.admin.getMonitoringData.useQuery(
		{ electionId },
		{
			refetchInterval: 30000, // Refresh every 30 seconds
		},
	);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<p className="text-muted-foreground">Loading monitoring data...</p>
			</div>
		);
	}

	if (error || !data) {
		return (
			<Card>
				<CardContent className="py-8">
					<p className="text-center text-destructive">
						Failed to load monitoring data
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-6">
			{/* Overall Turnout */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<TrendingUp className="h-5 w-5" />
						Overall Voter Turnout
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-muted-foreground text-sm">
									{data.totalVoted} of {data.totalEligibleVoters} voters
								</p>
							</div>
							<div>
								<p className="font-bold text-3xl text-primary">
									{data.turnoutPercentage.toFixed(1)}%
								</p>
							</div>
						</div>
						<Progress value={data.turnoutPercentage} className="h-3" />
					</div>
				</CardContent>
			</Card>

			{/* Turnout by College */}
			<Card>
				<CardHeader>
					<CardTitle>Turnout by College</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						{data.collegeData
							.sort((a, b) => b.turnoutPercentage - a.turnoutPercentage)
							.map((college) => (
								<div key={college.college} className="space-y-2">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<span className="font-medium">{college.college}</span>
											<span className="text-muted-foreground text-sm">
												({college.voted}/{college.eligible})
											</span>
										</div>
										<span className="font-semibold text-sm">
											{college.turnoutPercentage.toFixed(1)}%
										</span>
									</div>
									<div className="relative h-8 overflow-hidden rounded-full bg-muted">
										<div
											className="h-full rounded-full bg-primary transition-all duration-500"
											style={{ width: `${college.turnoutPercentage}%` }}
										/>
									</div>
								</div>
							))}
					</div>
				</CardContent>
			</Card>

			{/* Quorum Status by Ballot */}
			<Card>
				<CardHeader>
					<CardTitle>Quorum Status by Ballot</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-6">
						{data.ballotStats.map((ballot) => {
							const widthPercentage = Math.max(
								ballot.voteCount > 0 ? 0.5 : 0,
								Math.min((ballot.voteCount / ballot.eligibleVoters) * 100, 100),
							);

							return (
								<div key={ballot.id} className="space-y-3">
									<div className="flex items-start justify-between">
										<div className="flex-1">
											<div className="flex items-center gap-2">
												<h4 className="font-semibold">{ballot.title}</h4>
												<Badge
													variant={
														ballot.type === "EXECUTIVE"
															? "default"
															: ballot.type === "REFERENDUM"
																? "destructive"
																: "secondary"
													}
													className="text-xs"
												>
													{ballot.type}
												</Badge>
												{ballot.college && (
													<Badge variant="outline" className="text-xs">
														{ballot.college}
													</Badge>
												)}
											</div>
											<div className="mt-1 flex items-center gap-4 text-sm">
												<span className="text-muted-foreground">
													{ballot.voteCount} votes
												</span>
												<span className="text-muted-foreground">
													Quorum: {ballot.quorumThreshold} votes (
													{ballot.quorumPercentage}%)
												</span>
											</div>
										</div>
										<div className="flex items-center gap-2">
											{ballot.hasReachedQuorum ? (
												<Badge
													variant="default"
													className="bg-green-600 hover:bg-green-700"
												>
													<CheckCircle className="mr-1 h-3 w-3" />
													Quorum Reached
												</Badge>
											) : (
												<Badge variant="secondary">
													<AlertCircle className="mr-1 h-3 w-3" />
													{ballot.quorumProgress.toFixed(0)}% to Quorum
												</Badge>
											)}
										</div>
									</div>

									{/* Visual bar showing vote progress */}
									<div className="space-y-1">
										<div className="relative h-8 overflow-hidden rounded-lg bg-muted">
											{/* Votes received bar */}
											<div
												className={`h-full transition-all duration-500 ${
													ballot.hasReachedQuorum
														? "bg-green-600"
														: "bg-primary"
												}`}
												style={{
													width: `${widthPercentage}%`,
													minWidth: ballot.voteCount > 0 ? "4px" : "0",
												}}
											/>
											{/* Quorum threshold marker */}
											<div
												className="absolute top-0 h-full w-0.5 bg-destructive"
												style={{
													left: `${Math.min(
														(ballot.quorumThreshold / ballot.eligibleVoters) *
															100,
														100,
													)}%`,
												}}
												title={`Quorum threshold: ${ballot.quorumThreshold} votes (${ballot.quorumPercentage}%)`}
											/>
										</div>
										<div className="flex justify-between text-muted-foreground text-xs">
											<span>
												{ballot.voteCount} votes (
												{(
													(ballot.voteCount / ballot.eligibleVoters) *
													100
												).toFixed(1)}
												%)
											</span>
											<span className="text-center text-destructive">
												Quorum: {ballot.quorumThreshold}
											</span>
											<span>{ballot.eligibleVoters} eligible</span>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</CardContent>
			</Card>

			{/* Last Updated */}
			<p className="text-center text-muted-foreground text-xs">
				Last updated: {new Date(data.lastUpdated).toLocaleTimeString()}{" "}
				(Auto-refreshes every 30s)
			</p>
		</div>
	);
}
