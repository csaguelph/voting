"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	AlertCircle,
	CheckCircle,
	Download,
	ExternalLink,
	Printer,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface ReceiptProps {
	electionId: string;
	voter?: {
		id: string;
		email: string;
		firstName: string;
		lastName: string;
		college: string;
		studentId: string;
	};
	votedAt?: Date | null;
}

interface VoteData {
	votedAt: Date;
	voteCount: number;
	votes: {
		ballotId: string;
		voteHash: string;
		timestamp: Date;
	}[];
	ballotTitles?: Record<string, string>;
}

export function ReceiptClient({ electionId }: ReceiptProps) {
	const [voteData, setVoteData] = useState<VoteData | null>(null);
	const [ballotTitles, setBallotTitles] = useState<Record<string, string>>({});

	useEffect(() => {
		// Try to get vote data from sessionStorage
		const storedData = sessionStorage.getItem(`receipt-${electionId}`);
		if (storedData) {
			const parsed = JSON.parse(storedData) as VoteData;
			setVoteData(parsed);
			// Use stored ballot titles if available
			if (parsed.ballotTitles) {
				setBallotTitles(parsed.ballotTitles);
			}
		}
	}, [electionId]);

	const handlePrint = () => {
		window.print();
	};

	const handleDownload = () => {
		if (!voteData) return;

		const content = `
CSA VOTING RECEIPT
==================

Date: ${new Date(voteData.votedAt).toLocaleString()}
Votes Cast: ${voteData.voteCount}

VERIFICATION HASHES:
${voteData.votes
	.map(
		(v) => `
${ballotTitles[v.ballotId] || "Unknown Ballot"}
Hash: ${v.voteHash}
`,
	)
	.join("\n")}

Keep this receipt to verify your vote was counted.
Visit the verification portal to confirm your vote.
    `.trim();

		const blob = new Blob([content], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `vote-receipt-${electionId}.txt`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	// Show loading or basic receipt if no vote data
	if (!voteData) {
		return (
			<div className="container mx-auto max-w-4xl py-8">
				<div className="mb-8 text-center">
					<div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
						<CheckCircle className="h-10 w-10 text-green-600" />
					</div>
					<h1 className="font-bold text-3xl">Vote Recorded</h1>
					<p className="mt-2 text-muted-foreground">
						Your vote has been successfully recorded.
					</p>
				</div>

				<Alert className="mb-6">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>
						Vote verification hashes are only shown immediately after voting. If
						you didn't save your receipt, you can still verify your vote was
						counted by checking that you appear as "voted" in the system.
					</AlertDescription>
				</Alert>

				<Card>
					<CardHeader>
						<CardTitle>Voting Confirmation</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-muted-foreground text-sm">
							You have successfully voted in this election.
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="container mx-auto max-w-4xl py-8">
			{/* Success Header */}
			<div className="mb-8 text-center">
				<div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
					<CheckCircle className="h-10 w-10 text-green-600" />
				</div>
				<h1 className="font-bold text-3xl">Vote Submitted Successfully!</h1>
				<p className="mt-2 text-muted-foreground">
					Your vote has been recorded. Save this receipt for verification.
				</p>
			</div>

			{/* Info Alert */}
			<Alert className="mb-6">
				<CheckCircle className="h-4 w-4" />
				<AlertDescription>
					Your votes have been cryptographically secured. You can use the
					verification hashes below to confirm your vote was counted in the
					final tally.
				</AlertDescription>
			</Alert>

			{/* Receipt Card */}
			<Card className="mb-6">
				<CardHeader>
					<CardTitle>Voting Receipt</CardTitle>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Vote Info */}
					<div className="grid gap-4 md:grid-cols-2">
						<div>
							<p className="text-muted-foreground text-sm">Date & Time</p>
							<p className="font-medium">
								{new Date(voteData.votedAt).toLocaleString()}
							</p>
						</div>
						<div>
							<p className="text-muted-foreground text-sm">Votes Cast</p>
							<p className="font-medium">{voteData.voteCount} ballots</p>
						</div>
					</div>

					{/* Verification Hashes */}
					<div>
						<h3 className="mb-4 font-semibold">Verification Hashes</h3>
						<div className="space-y-4">
							{voteData.votes.map((vote) => (
								<div
									key={vote.ballotId}
									className="rounded-lg border bg-muted/50 p-4"
								>
									<div className="mb-2 flex items-center justify-between">
										<p className="font-medium">
											{ballotTitles[vote.ballotId] || "Loading..."}
										</p>
										<Badge variant="secondary">Verified</Badge>
									</div>
									<div className="rounded bg-black/5 p-2 font-mono text-xs">
										{vote.voteHash}
									</div>
								</div>
							))}
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Actions */}
			<div className="mb-6 flex flex-wrap gap-4">
				<Button onClick={handlePrint} variant="outline">
					<Printer className="mr-2 h-4 w-4" />
					Print Receipt
				</Button>
				<Button onClick={handleDownload} variant="outline">
					<Download className="mr-2 h-4 w-4" />
					Download Receipt
				</Button>
				<Button asChild variant="outline">
					<Link href="/verify">
						<ExternalLink className="mr-2 h-4 w-4" />
						Verify Your Vote
					</Link>
				</Button>
			</div>

			{/* Information */}
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">What's Next?</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div>
						<h4 className="mb-2 font-semibold">Keep Your Receipt</h4>
						<p className="text-muted-foreground text-sm">
							Save this receipt in a secure location. You'll need the
							verification hashes to confirm your vote was counted.
						</p>
					</div>
					<div>
						<h4 className="mb-2 font-semibold">Verify Your Vote</h4>
						<p className="text-muted-foreground text-sm">
							After the election closes, you can use the verification portal to
							confirm that your vote was included in the final tally. Your vote
							remains anonymous.
						</p>
					</div>
					<div>
						<h4 className="mb-2 font-semibold">Results</h4>
						<p className="text-muted-foreground text-sm">
							Election results will be published after the voting period ends.
							You'll be notified via email when results are available.
						</p>
					</div>
				</CardContent>
			</Card>

			{/* Print Styles */}
			<style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .container * {
            visibility: visible;
          }
          .container {
            position: absolute;
            left: 0;
            top: 0;
          }
          button {
            display: none !important;
          }
        }
      `}</style>
		</div>
	);
}
