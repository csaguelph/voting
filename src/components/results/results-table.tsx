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
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { WinnerBadge } from "./winner-badge";

interface ResultsTableProps {
	ballot: BallotResult;
	isAdmin?: boolean;
}

function ReferendumResults({ referendum }: { referendum: ReferendumResult }) {
	const totalVotes = referendum.yes + referendum.no;

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
				<div className="rounded-lg border border-yellow-500 bg-yellow-50 p-4 text-center dark:bg-yellow-950">
					<Badge variant="destructive" className="mb-2">
						Tied Result
					</Badge>
					<p className="text-muted-foreground text-sm">
						This referendum resulted in a tie and requires manual review.
					</p>
				</div>
			)}

			<div className="text-center text-muted-foreground text-sm">
				Total votes: {totalVotes}
			</div>
		</div>
	);
}

function CandidateResults({ candidates }: { candidates: CandidateResult[] }) {
	const totalVotes = candidates.reduce((sum, c) => sum + c.votes, 0);
	const hasTies = candidates.some((c) => c.isTied);

	return (
		<div className="space-y-4">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Candidate</TableHead>
						<TableHead className="text-right">Votes</TableHead>
						<TableHead className="text-right">Percentage</TableHead>
						<TableHead className="text-right">Status</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{candidates.map((candidate) => (
						<TableRow
							key={candidate.candidateId}
							className={candidate.isWinner ? "bg-muted/50" : ""}
						>
							<TableCell className="font-medium">{candidate.name}</TableCell>
							<TableCell className="text-right">{candidate.votes}</TableCell>
							<TableCell className="text-right">
								{candidate.percentage.toFixed(1)}%
							</TableCell>
							<TableCell className="text-right">
								<WinnerBadge
									isWinner={candidate.isWinner}
									isTied={candidate.isTied}
								/>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>

			{hasTies && (
				<div className="rounded-lg border border-yellow-500 bg-yellow-50 p-4 dark:bg-yellow-950">
					<Badge variant="destructive" className="mb-2">
						Tied Result
					</Badge>
					<p className="text-muted-foreground text-sm">
						This ballot has tied candidates. Manual review may be required per
						CSA bylaws.
					</p>
				</div>
			)}

			<div className="text-center text-muted-foreground text-sm">
				Total votes: {totalVotes}
			</div>
		</div>
	);
}

export function ResultsTable({ ballot, isAdmin = false }: ResultsTableProps) {
	// Check if quorum was met or if user is admin
	const showDetailedResults = ballot.hasReachedQuorum || isAdmin;

	return (
		<Card>
			<CardHeader>
				<div className="flex items-start justify-between">
					<div>
						<CardTitle>{ballot.ballotTitle}</CardTitle>
						<div className="mt-1 flex gap-2">
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
					</div>
					<div className="text-right">
						<div className="font-bold text-2xl">{ballot.totalVotes}</div>
						<div className="text-muted-foreground text-sm">
							total votes
							{!ballot.hasReachedQuorum && (
								<div className="text-xs">
									(Quorum: {ballot.quorumThreshold})
								</div>
							)}
						</div>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{!ballot.hasReachedQuorum && !isAdmin ? (
					<div className="space-y-4">
						<div className="flex items-start gap-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
							<AlertCircle className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
							<div>
								<h4 className="mb-1 font-semibold text-blue-900 dark:text-blue-100">
									Quorum Not Met
								</h4>
								<p className="text-blue-700 text-sm dark:text-blue-300">
									This ballot received {ballot.totalVotes} vote
									{ballot.totalVotes !== 1 ? "s" : ""} but did not meet the
									required quorum of {ballot.quorumThreshold} votes (
									{ballot.quorumPercentage}% of {ballot.eligibleVoters} eligible
									voters).
								</p>
							</div>
						</div>
					</div>
				) : (
					<>
						{!ballot.hasReachedQuorum && isAdmin && (
							<div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
								<p className="text-blue-700 text-sm dark:text-blue-300">
									<strong>Admin View:</strong> Detailed results shown below.
									Public will only see that quorum was not met.
								</p>
							</div>
						)}
						{ballot.ballotType === "REFERENDUM" && ballot.referendum ? (
							<ReferendumResults referendum={ballot.referendum} />
						) : ballot.candidates ? (
							<CandidateResults candidates={ballot.candidates} />
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
