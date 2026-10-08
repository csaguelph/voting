import { redirect } from "next/navigation";
import { VotingProvider } from "@/contexts/voting-context";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";
import { ReviewPage } from "./review-client";

export default async function ReviewVotePage({
	params,
}: {
	params: Promise<{ electionId: string }>;
}) {
	const session = await auth();
	const { electionId } = await params;

	if (!session?.user?.email) {
		redirect(`/auth/signin?callbackUrl=/vote/${electionId}/review`);
	}

	try {
		// Check eligibility and get ballots
		const eligibility = await api.vote.checkEligibility({ electionId });

		// The ballot page asks for the student ID first
		if (!eligibility.eligible || !eligibility.identity?.confirmed) {
			redirect(`/vote/${electionId}`);
		}

		if (!eligibility.ballots) {
			throw new Error("Missing ballots data");
		}

		return (
			<VotingProvider>
				<ReviewPage ballots={eligibility.ballots} />
			</VotingProvider>
		);
	} catch (error) {
		console.error("Error loading review page:", error);
		redirect(`/vote/${electionId}`);
	}
}
