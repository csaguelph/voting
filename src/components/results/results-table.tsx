import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type {
	BallotResult,
	CandidateResult,
	ReferendumResult,
} from "@/lib/results/calculator";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { WinnerBadge } from "./winner-badge";

interface ResultsTableProps {
	ballot: BallotResult;
	isAdmin?: boolean;
}

function ReferendumResults({ referendum }: { referendum: ReferendumResult }) {
	return (
		<div className="space-y-4">
			<div className="grid grid-cols-2 gap-4">
				{/* YES votes */}
				<Card
					className={
						referendum.passed && !referendum.isTied ? "border-green-500" : ""
					}
				>
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-lg">
							<CheckCircle2 className="h-5 w-5 text-green-600" />
							YES
							{referendum.passed && !referendum.isTied && (
								<Badge variant="default" className="ml-auto bg-green-600">
									Passed
								</Badge>
							)}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							<div className="font-bold text-3xl">{referendum.yes}</div>
							<div className="text-muted-foreground text-sm">
								{referendum.yesPercentage.toFixed(1)}% of votes
							</div>
							<div className="h-2 w-full rounded-full bg-muted">
								<div
									className="h-full rounded-full bg-green-600"
									style={{ width: `${referendum.yesPercentage}%` }}
								/>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* NO votes */}
				<Card
					className={
						!referendum.passed && !referendum.isTied ? "border-red-500" : ""
					}
				>
					<CardHeader className="pb-3">
						<CardTitle className="flex items-center gap-2 text-lg">
							<XCircle className="h-5 w-5 text-red-600" />
							NO
							{!referendum.passed && !referendum.isTied && (
								<Badge variant="secondary" className="ml-auto">
									Defeated
								</Badge>
							)}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							<div className="font-bold text-3xl">{referendum.no}</div>
							<div className="text-muted-foreground text-sm">
								{referendum.noPercentage.toFixed(1)}% of votes
							</div>
							<div className="h-2 w-full rounded-full bg-muted">
								<div
									className="h-full rounded-full bg-red-600"
									style={{ width: `${referendum.noPercentage}%` }}
								/>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{referendum.isTied && (
				<div className="rounded-lg border border-yellow-500 bg-yellow-50 p-4 text-center">
					<Badge variant="destructive" className="mb-2">
						Tied Result
					</Badge>
					<p className="text-muted-foreground text-sm">
						This referendum resulted in a tie and requires manual review.
					</p>
				</div>
			)}
		</div>
	);
}

function CandidateResults({
	candidates,
	seatsAvailable = 1,
}: {
	candidates: CandidateResult[];
	seatsAvailable?: number;
}) {
	const hasTies = candidates.some((c) => c.isTied);
	const isMultiSeat = seatsAvailable > 1;
	const useScore = isMultiSeat && candidates.some((c) => c.score !== undefined);
	const eligibleCount = candidates.filter(
		(c) => c.status === "ACTIVE" || !c.status,
	).length;
	const isDisqualified = (c: CandidateResult) =>
		c.status === "WITHDRAWN" || c.status === "DISQUALIFIED";

	return (
		<div className="space-y-4">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Candidate</TableHead>
						<TableHead className="text-right">
							{useScore ? "Score" : "Votes"}
						</TableHead>
						<TableHead className="text-right">Percentage</TableHead>
						<TableHead className="text-right">Status</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{candidates.map((candidate) => {
						const dq = isDisqualified(candidate);
						return (
							<TableRow
								key={candidate.candidateId}
								className={cn(
									candidate.isWinner && "bg-muted/50",
									dq && "text-muted-foreground",
								)}
							>
								<TableCell className="font-medium">
									<span className={dq ? "line-through" : undefined}>
										{candidate.name}
									</span>
								</TableCell>
								<TableCell className="text-right font-mono tabular-nums">
									{dq
										? "—"
										: useScore
											? (candidate.score ?? 0)
											: candidate.votes}
								</TableCell>
								<TableCell className="text-right font-mono tabular-nums">
									{dq ? "—" : `${candidate.percentage.toFixed(1)}%`}
								</TableCell>
								<TableCell className="text-right">
									{dq ? (
										<Badge
											variant={
												candidate.status === "DISQUALIFIED"
													? "destructive"
													: "secondary"
											}
											className="text-xs"
										>
											{candidate.status === "WITHDRAWN"
												? "Withdrawn"
												: "Disqualified"}
										</Badge>
									) : (
										<WinnerBadge
											isWinner={candidate.isWinner}
											isTied={candidate.isTied}
										/>
									)}
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>

			{hasTies && (
				<div className="rounded-lg border border-yellow-500 bg-yellow-50 p-4">
					<Badge variant="destructive" className="mb-2">
						Tied Result
					</Badge>
					<p className="text-muted-foreground text-sm">
						This ballot has tied candidates. Manual review may be required per
						CSA bylaws.
					</p>
				</div>
			)}

			{useScore && (
				<div className="text-center text-muted-foreground text-sm">
					{seatsAvailable} {seatsAvailable === 1 ? "seat" : "seats"} available
					<br />
					<span className="text-xs">
						Scores based on ranking position: 1st choice = {eligibleCount} pts,
						2nd = {eligibleCount - 1} pts, etc.
					</span>
				</div>
			)}
		</div>
	);
}

export function ResultsTable({ ballot, isAdmin = false }: ResultsTableProps) {
	// Check if quorum was met or if user is admin
	const showDetailedResults = ballot.hasReachedQuorum || isAdmin;

	return (
		<Card>
			<CardHeader>
				<div className="flex items-start justify-between gap-4">
					<div>
						<CardTitle>{ballot.ballotTitle}</CardTitle>
						<div className="mt-1 flex flex-wrap gap-2">
							<Badge variant="outline">{ballot.ballotType}</Badge>
							{ballot.college && (
								<Badge variant="secondary">{ballot.college}</Badge>
							)}
							{ballot.hasReachedQuorum ? (
								<Badge variant="default" className="bg-green-600">
									Quorum Reached
								</Badge>
							) : (
								<Badge variant="destructive">Quorum Not Met</Badge>
							)}
						</div>
						{/* Quorum: turnout-based. Turnout + % turnout (always). Bar only for admin. */}
						{ballot.eligibleVoters > 0 &&
							typeof ballot.participatedCount === "number" && (
								<div className="mt-2 space-y-1">
									<div className="text-muted-foreground text-sm">
										Turnout:{" "}
										<span className="font-medium text-foreground tabular-nums">
											{ballot.participatedCount} students voted
										</span>{" "}
										(
										{`${(
											(ballot.participatedCount / ballot.eligibleVoters) * 100
										).toFixed(1)}% turnout`}
										){" · "}
										Quorum: {ballot.quorumPercentage}% of eligible →{" "}
										{ballot.quorumThreshold} required.
									</div>
									{/* Bar only for admin (same style as monitoring) */}
									{isAdmin && (
										<div className="space-y-1">
											<div className="relative h-6 overflow-hidden rounded-md bg-muted">
												<div
													className={`h-full transition-all duration-300 ${
														ballot.hasReachedQuorum
															? "bg-green-600"
															: "bg-primary"
													}`}
													style={{
														width: `${Math.min(
															(ballot.participatedCount /
																ballot.eligibleVoters) *
																100,
															100,
														)}%`,
														minWidth:
															ballot.participatedCount > 0 ? "4px" : "0",
													}}
												/>
												<div
													className="absolute top-0 h-full w-0.5 bg-destructive"
													style={{
														left: `${Math.min(
															(ballot.quorumThreshold / ballot.eligibleVoters) *
																100,
															100,
														)}%`,
													}}
													title={`Quorum: ${ballot.quorumThreshold} votes (${ballot.quorumPercentage}%)`}
												/>
											</div>
											<div className="flex justify-between text-muted-foreground text-xs">
												<span>{ballot.participatedCount} voted</span>
												<span>
													{ballot.quorumThreshold} required ·{" "}
													{ballot.eligibleVoters} eligible
												</span>
											</div>
										</div>
									)}
								</div>
							)}
						{ballot.eligibleVoters > 0 &&
							typeof ballot.participatedCount !== "number" && (
								<div className="mt-2 text-muted-foreground text-sm">
									Quorum: {ballot.quorumPercentage}% of eligible →{" "}
									{ballot.quorumThreshold} required.
								</div>
							)}
					</div>
					<div className="shrink-0 text-right">
						<div className="font-bold font-mono text-2xl tabular-nums">
							{ballot.totalCountedVotes ?? ballot.totalVotes}
						</div>
						<div className="text-muted-foreground text-sm">total votes</div>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{!ballot.hasReachedQuorum && !isAdmin ? (
					<div className="space-y-4">
						<div className="flex items-start gap-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
							<AlertCircle className="h-5 w-5 shrink-0 text-blue-600" />
							<div>
								<h4 className="mb-1 font-semibold text-blue-900">
									Quorum Not Met
								</h4>
								<p className="text-blue-700 text-sm">
									{ballot.eligibleVoters > 0 ? (
										<>
											{typeof ballot.participatedCount === "number" ? (
												<>
													Turnout:{" "}
													<span className="font-medium tabular-nums">
														{ballot.participatedCount} students voted
													</span>
													{` (${((ballot.participatedCount / ballot.eligibleVoters) * 100).toFixed(1)}% turnout)`}
													{" · "}
												</>
											) : null}
											Quorum is {ballot.quorumPercentage}% of eligible (
											{ballot.quorumThreshold} votes required).
										</>
									) : (
										<>No eligible voters; quorum not applicable.</>
									)}
								</p>
							</div>
						</div>
					</div>
				) : (
					<>
						{!ballot.hasReachedQuorum && isAdmin && (
							<div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
								<p className="text-blue-700 text-sm">
									<strong>Admin View:</strong> Detailed results shown below.
									Public will only see that quorum was not met.
								</p>
							</div>
						)}
						{ballot.ballotType === "REFERENDUM" && ballot.referendum ? (
							<ReferendumResults referendum={ballot.referendum} />
						) : ballot.candidates ? (
							<CandidateResults
								candidates={ballot.candidates}
								seatsAvailable={ballot.seatsAvailable}
							/>
						) : (
							<div className="py-8 text-center text-muted-foreground">
								No results available
							</div>
						)}
					</>
				)}
			</CardContent>
		</Card>
	);
}
