import { auth } from "@/server/auth";
import { api } from "@/trpc/server";
import { redirect } from "next/navigation";
import { ReceiptClient } from "./receipt-client";

export default async function ReceiptPage({
	params,
}: {
	params: Promise<{ electionId: string }>;
}) {
	const session = await auth();
	const { electionId } = await params;

	if (!session?.user?.email) {
		redirect(`/auth/signin?callbackUrl=/vote/${electionId}/receipt`);
	}

	try {
		// Get the voter info from the API
		const eligibility = await api.vote.checkEligibility({ electionId });

		if (!eligibility.eligible && !eligibility.hasVoted) {
			redirect(`/vote/${electionId}`);
		}

		// The actual hashes will come from sessionStorage (set after voting)
		return <ReceiptClient electionId={electionId} />;
	} catch (error) {
		console.error("Error loading receipt:", error);
		return (
			<div className="container mx-auto max-w-2xl py-12">
				<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
					<h2 className="font-semibold text-destructive text-xl">
						Error Loading Receipt
					</h2>
					<p className="mt-2 text-muted-foreground">
						Unable to load your voting receipt. Please contact support if this
						issue persists.
					</p>
				</div>
			</div>
		);
	}
}
