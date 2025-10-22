import Link from "next/link";
import { redirect } from "next/navigation";

import { BallotReorder } from "@/components/admin/ballot-reorder";
import { BallotsManager } from "@/components/admin/ballots-manager";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireAdmin } from "@/lib/auth/permissions";
import { api } from "@/trpc/server";

export default async function BallotsPage({
	params,
}: {
	params: Promise<{ electionId: string }>;
}) {
	const { electionId } = await params;

	// Require admin access
	await requireAdmin();

	// Fetch election data
	const election = await api.election.getById({ id: electionId });

	if (!election) {
		redirect("/admin");
	}

	// Fetch ballots for reordering
	const ballots = await api.ballot.getByElection({ electionId });

	return (
		<>
			{/* Header */}
			<div className="mb-8">
				<div className="mb-2 flex items-center gap-2">
					<Button variant="ghost" size="sm" asChild className="text-gray-700">
						<Link href={`/admin/${electionId}`}>← Back to {election.name}</Link>
					</Button>
				</div>
				<h1 className="font-bold text-4xl text-gray-900">Ballot Management</h1>
				<p className="text-gray-600">
					Create and manage ballots and candidates for {election.name}
				</p>
			</div>

			<Tabs defaultValue="manage" className="space-y-6">
				<TabsList>
					<TabsTrigger value="manage">Manage Ballots</TabsTrigger>
					<TabsTrigger value="reorder">Reorder Ballots</TabsTrigger>
				</TabsList>

				<TabsContent value="manage">
					<BallotsManager electionId={electionId} />
				</TabsContent>

				<TabsContent value="reorder">
					<BallotReorder electionId={electionId} initialBallots={ballots} />
				</TabsContent>
			</Tabs>
		</>
	);
}
