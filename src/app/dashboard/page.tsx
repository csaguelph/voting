"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { api } from "@/trpc/react";
import {
	Calendar,
	CheckCircle,
	Clock,
	Eye,
	EyeOff,
	Loader2,
	Vote,
	XCircle,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

export default function DashboardPage() {
	const { data: session } = useSession();
	const [showStudentId, setShowStudentId] = useState(false);

	// Fetch elections for the user
	const { data: elections, isLoading } = api.election.getMyElections.useQuery();

	if (!session) {
		return null;
	}

	// Separate elections by status based on date range only
	const now = new Date();
	const activeElections =
		elections?.filter(
			(e) => new Date(e.startTime) <= now && new Date(e.endTime) >= now,
		) ?? [];
	const pastElections =
		elections?.filter((e) => new Date(e.endTime) < now) ?? [];

	// Get student info from the first eligible voter record
	const studentInfo = elections?.[0]
		? {
				studentId: elections[0].studentId,
				college: elections[0].college,
				firstName: elections[0].firstName,
				lastName: elections[0].lastName,
			}
		: null;

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
				<div>
					<h1 className="mb-2 font-bold text-3xl text-gray-900">
						Student Dashboard
					</h1>
					<p className="text-gray-600">
						Welcome back, {session.user.name?.split(" ")[0]}!
					</p>
				</div>

				{/* Quick Stats */}
				<div className="flex gap-4">
					<div className="rounded-lg bg-blue-50 p-4 text-center">
						<div className="font-bold text-2xl text-blue-600">
							{activeElections.length}
						</div>
						<div className="text-blue-900 text-xs">Active</div>
					</div>
					<div className="rounded-lg bg-green-50 p-4 text-center">
						<div className="font-bold text-2xl text-green-600">
							{elections?.filter((e) => e.hasVoted).length ?? 0}
						</div>
						<div className="text-green-900 text-xs">Voted</div>
					</div>
				</div>
			</div>

			{/* Profile Card */}
			{studentInfo && (
				<Card>
					<CardHeader>
						<CardTitle>Your Profile</CardTitle>
						<CardDescription>Student information</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
							<div>
								<p className="mb-1 font-medium text-gray-900 text-sm">Name</p>
								<p className="text-gray-600 text-sm">
									{studentInfo.firstName} {studentInfo.lastName}
								</p>
							</div>
							<div>
								<p className="mb-1 font-medium text-gray-900 text-sm">Email</p>
								<p className="text-gray-600 text-sm">{session.user.email}</p>
							</div>
							<div>
								<p className="mb-1 font-medium text-gray-900 text-sm">
									College
								</p>
								<p className="text-gray-600 text-sm">{studentInfo.college}</p>
							</div>
							<div>
								<div className="mb-1 flex items-center gap-2">
									<p className="font-medium text-gray-900 text-sm">
										Student ID
									</p>
									<Button
										variant="ghost"
										size="sm"
										className="h-6 w-6 p-0"
										onClick={() => setShowStudentId(!showStudentId)}
									>
										{showStudentId ? (
											<EyeOff className="h-3 w-3" />
										) : (
											<Eye className="h-3 w-3" />
										)}
									</Button>
								</div>
								<p
									className={`font-mono text-gray-600 text-sm ${!showStudentId ? "blur-sm" : ""}`}
								>
									{studentInfo.studentId}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Active Elections */}
			<div>
				<div className="mb-4 flex items-center justify-between">
					<div>
						<h2 className="font-bold text-2xl text-gray-900">
							Active Elections
						</h2>
						<p className="text-gray-600 text-sm">
							Elections you can vote in now
						</p>
					</div>
				</div>

				{isLoading ? (
					<Card>
						<CardContent className="flex items-center justify-center py-12">
							<Loader2 className="h-8 w-8 animate-spin text-gray-400" />
						</CardContent>
					</Card>
				) : activeElections.length === 0 ? (
					<Card>
						<CardContent className="py-12 text-center">
							<Vote className="mx-auto mb-4 h-12 w-12 text-gray-400" />
							<h3 className="mb-2 font-semibold text-gray-900 text-lg">
								No Active Elections
							</h3>
							<p className="text-gray-600 text-sm">
								There are no elections currently open for voting.
							</p>
						</CardContent>
					</Card>
				) : (
					<div className="grid gap-4 md:grid-cols-2">
						{activeElections.map((election) => (
							<Card key={election.id} className="border-blue-200 bg-blue-50/50">
								<CardHeader>
									<div className="flex items-start justify-between">
										<div className="flex-1">
											<CardTitle className="mb-2">{election.name}</CardTitle>
											<div className="flex flex-wrap gap-2">
												<Badge variant="default" className="bg-blue-600">
													Active
												</Badge>
												{election.hasVoted ? (
													<Badge
														variant="secondary"
														className="bg-green-100 text-green-700"
													>
														<CheckCircle className="mr-1 h-3 w-3" />
														Voted
													</Badge>
												) : (
													<Badge
														variant="secondary"
														className="bg-amber-100 text-amber-700"
													>
														<Clock className="mr-1 h-3 w-3" />
														Not Voted
													</Badge>
												)}
											</div>
										</div>
									</div>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="space-y-2 text-sm">
										<div className="flex items-center gap-2 text-gray-600">
											<Calendar className="h-4 w-4" />
											<span>
												Ends{" "}
												{new Date(election.endTime).toLocaleDateString(
													"en-US",
													{
														month: "short",
														day: "numeric",
														hour: "numeric",
														minute: "2-digit",
													},
												)}
											</span>
										</div>
										<div className="flex items-center gap-2 text-gray-600">
											<Vote className="h-4 w-4" />
											<span>{election.ballots.length} ballot(s)</span>
										</div>
									</div>

									{election.hasVoted ? (
										<div className="space-y-2">
											<Button asChild variant="outline" className="w-full">
												<Link href={"/verify"}>Verify Your Vote</Link>
											</Button>
											<p className="text-center text-gray-500 text-xs">
												Voted on{" "}
												{election.votedAt
													? new Date(election.votedAt).toLocaleDateString(
															"en-US",
															{
																month: "short",
																day: "numeric",
																hour: "numeric",
																minute: "2-digit",
															},
														)
													: "Unknown"}
											</p>
										</div>
									) : (
										<Button asChild className="w-full">
											<Link href={`/vote/${election.id}`}>Cast Your Vote</Link>
										</Button>
									)}
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</div>

			{/* Past Elections */}
			<div>
				<div className="mb-4">
					<h2 className="font-bold text-2xl text-gray-900">Past Elections</h2>
					<p className="text-gray-600 text-sm">
						Elections that have closed and results
					</p>
				</div>

				{isLoading ? (
					<Card>
						<CardContent className="flex items-center justify-center py-12">
							<Loader2 className="h-8 w-8 animate-spin text-gray-400" />
						</CardContent>
					</Card>
				) : pastElections.length === 0 ? (
					<Card>
						<CardContent className="py-12 text-center">
							<Clock className="mx-auto mb-4 h-12 w-12 text-gray-400" />
							<h3 className="mb-2 font-semibold text-gray-900 text-lg">
								No Past Elections
							</h3>
							<p className="text-gray-600 text-sm">
								You haven't participated in any elections yet.
							</p>
						</CardContent>
					</Card>
				) : (
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{pastElections.map((election) => {
							const isClosed = new Date(election.endTime) < now;
							return (
								<Card key={election.id}>
									<CardHeader>
										<CardTitle className="text-base">{election.name}</CardTitle>
										<div className="flex flex-wrap gap-2">
											{isClosed ? (
												<Badge variant="secondary">Closed</Badge>
											) : (
												<Badge
													variant="secondary"
													className="bg-blue-100 text-blue-700"
												>
													Open
												</Badge>
											)}
											{election.hasVoted ? (
												<Badge
													variant="secondary"
													className="bg-green-100 text-green-700"
												>
													<CheckCircle className="mr-1 h-3 w-3" />
													Voted
												</Badge>
											) : (
												<Badge
													variant="secondary"
													className="bg-gray-100 text-gray-700"
												>
													<XCircle className="mr-1 h-3 w-3" />
													Did Not Vote
												</Badge>
											)}
										</div>
									</CardHeader>
									<CardContent className="space-y-3">
										<div className="space-y-1 text-sm">
											<div className="flex items-center gap-2 text-gray-600">
												<Calendar className="h-4 w-4" />
												<span>
													Ended{" "}
													{new Date(election.endTime).toLocaleDateString(
														"en-US",
														{
															month: "short",
															day: "numeric",
															year: "numeric",
														},
													)}
												</span>
											</div>
										</div>

										<div className="flex gap-2">
											{election.isFinalized && (
												<Button
													asChild
													variant="outline"
													size="sm"
													className="flex-1"
												>
													<Link href={`/results/${election.id}`}>
														View Results
													</Link>
												</Button>
											)}
											{election.hasVoted && (
												<Button
													asChild
													variant="ghost"
													size="sm"
													className="flex-1"
												>
													<Link href={"/verify"}>Verify Vote</Link>
												</Button>
											)}
										</div>
									</CardContent>
								</Card>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
