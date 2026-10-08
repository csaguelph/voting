import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { PageReportSource, ReportReason } from "@/lib/reports";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";
import { ReportForm } from "./report-form";

/** `?from=` in links to this page, and the report source each one records */
const SOURCES: Record<string, PageReportSource> = {
	receipt: "RECEIPT",
	"already-voted": "ALREADY_VOTED",
	dashboard: "DASHBOARD",
};

/**
 * Report a problem with your own ballot to the CRO, e.g. someone else voted
 * for you. Linked from the receipt, the "already voted" page and the
 * dashboard.
 */
export default async function ReportPage({
	params,
	searchParams,
}: {
	params: Promise<{ electionId: string }>;
	searchParams: Promise<{ from?: string }>;
}) {
	const session = await auth();
	const { electionId } = await params;
	const { from } = await searchParams;
	const query = from ? `?from=${encodeURIComponent(from)}` : "";

	if (!session?.user?.email) {
		redirect(`/auth/signin?callbackUrl=/vote/${electionId}/report${query}`);
	}

	const [election, voter] = await Promise.all([
		api.election.getById({ id: electionId }),
		api.voter.checkEligibility({ electionId }),
	]);
	if (!election) {
		notFound();
	}

	if (!voter.isEligible) {
		return (
			<div className="mx-auto max-w-2xl rounded-lg border border-destructive/50 bg-destructive/10 p-6">
				<h1 className="font-semibold text-destructive text-xl">
					Not Registered to Vote
				</h1>
				<p className="mt-2 text-muted-foreground">
					You can only report problems with your own ballot, and you are not
					registered to vote in this election. To report a campaign rule
					violation, use the elections complaint form at{" "}
					<a
						href="https://csaonline.ca/elections-complaint"
						className="font-medium text-foreground underline underline-offset-4"
					>
						csaonline.ca/elections-complaint
					</a>
					.
				</p>
				<Button asChild variant="outline" className="mt-4">
					<Link href="/dashboard">Back to Dashboard</Link>
				</Button>
			</div>
		);
	}

	const source = (from && SOURCES[from]) || "DASHBOARD";
	const defaultReason: ReportReason | "" =
		source === "ALREADY_VOTED" ? "SOMEONE_ELSE_VOTED" : "";

	return (
		<ReportForm
			electionId={electionId}
			electionName={election.name}
			source={source}
			defaultReason={defaultReason}
		/>
	);
}
