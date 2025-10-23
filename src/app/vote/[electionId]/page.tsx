import { auth } from "@/server/auth";
import { api } from "@/trpc/server";
import { redirect } from "next/navigation";
import { VotingInterface } from "./voting-interface";

export default async function VotePage({
	params,
}: {
	params: Promise<{ electionId: string }>;
}) {
	const session = await auth();
	const { electionId } = await params;

	if (!session?.user?.email) {
		redirect(`/auth/signin?callbackUrl=/vote/${electionId}`);
	}

	try {
		// Check eligibility and get ballots
		const eligibility = await api.vote.checkEligibility({ electionId });

		if (!eligibility.eligible) {
			return (
				<div className="container mx-auto max-w-2xl py-12">
					<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
						<h2 className="font-semibold text-destructive text-xl">
							Not Eligible to Vote
						</h2>
						<p className="mt-2 text-muted-foreground">
							{eligibility.reason ||
								"You are not eligible to vote in this election."}
						</p>
						{eligibility.hasVoted && eligibility.votedAt && (
							<p className="mt-4 text-muted-foreground text-sm">
								You voted on {new Date(eligibility.votedAt).toLocaleString()}
							</p>
						)}
					</div>
				</div>
			);
		}

		if (!eligibility.ballots || !eligibility.voter) {
			throw new Error("Missing ballots or voter data");
		}

		// Check if there are no eligible ballots
		if (eligibility.ballots.length === 0) {
			return (
				<div className="container mx-auto max-w-2xl py-12">
					<div className="rounded-lg border border-blue-500/50 bg-blue-50 p-6">
						<h2 className="font-semibold text-blue-900 text-xl">
							No Ballots Available
						</h2>
						<p className="mt-2 text-blue-800">
							You are eligible to vote in this election, but there are currently
							no ballots available for you to vote on.
						</p>
						<p className="mt-4 text-blue-700 text-sm">This may occur if:</p>
						<ul className="mt-2 list-disc space-y-1 pl-5 text-blue-700 text-sm">
							<li>
								The only ballots are for a different college (e.g., Director
								positions for other colleges)
							</li>
							<li>No ballots have been created yet for this election</li>
							<li>All ballots have been removed by administrators</li>
						</ul>
						<p className="mt-4 text-blue-700 text-sm">
							If you believe this is an error, please contact the election
							administrators.
						</p>
					</div>
				</div>
			);
		}

		return (
			<VotingInterface
				electionId={electionId}
				ballots={eligibility.ballots}
				voter={eligibility.voter}
			/>
		);
	} catch (error) {
		console.error("Error loading voting page:", error);
		return (
			<div className="container mx-auto max-w-2xl py-12">
				<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
					<h2 className="font-semibold text-destructive text-xl">
						Error Loading Election
					</h2>
					<p className="mt-2 text-muted-foreground">
						Unable to load election information. Please try again later.
					</p>
				</div>
			</div>
		);
	}
}
