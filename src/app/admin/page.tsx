"use client";

import { Calendar, Plus, Settings, Trash2, Users, Vote } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ElectionForm } from "@/components/admin/election-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { api } from "@/trpc/react";

export default function AdminDashboardPage() {
	const router = useRouter();
	const { data: session, status } = useSession();
	const [isCreateOpen, setIsCreateOpen] = useState(false);

	// Check authentication
	useEffect(() => {
		if (status === "unauthenticated") {
			router.push("/auth/signin");
		} else if (
			status === "authenticated" &&
			session.user.role !== "ADMIN" &&
			session.user.role !== "CRO"
		) {
			router.push("/dashboard");
		}
	}, [status, session, router]);

	const utils = api.useUtils();
	const { data: elections, isLoading } = api.admin.getAllElections.useQuery(
		undefined,
		{
			enabled: status === "authenticated",
		},
	);

	const createMutation = api.admin.createElection.useMutation({
		onSuccess: () => {
			void utils.admin.getAllElections.invalidate();
			setIsCreateOpen(false);
		},
	});

	const deleteMutation = api.admin.deleteElection.useMutation({
		onSuccess: () => {
			void utils.admin.getAllElections.invalidate();
		},
	});

	const handleCreate = (data: {
		name: string;
		description?: string;
		startTime: Date;
		endTime: Date;
		isActive?: boolean;
	}) => {
		createMutation.mutate(data);
	};

	const handleDelete = (id: string, electionName: string) => {
		if (confirm(`Are you sure you want to delete "${electionName}"?`)) {
			deleteMutation.mutate({ id });
		}
	};

	// Show loading while checking auth
	if (status === "loading") {
		return (
			<div className="flex items-center justify-center py-12">
				<p className="text-gray-600">Loading...</p>
			</div>
		);
	}

	// Don't render if not authenticated or not admin
	if (
		!session ||
		(session.user.role !== "ADMIN" && session.user.role !== "CRO")
	) {
		return null;
	}

	return (
		<div>
			{/* Header */}
			<div className="mb-8 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-4xl text-gray-900">Elections</h1>
					<p className="text-gray-600">Manage elections, voters, and ballots</p>
				</div>

				<Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
					<DialogTrigger asChild>
						<Button>
							<Plus className="mr-2 h-4 w-4" />
							Create Election
						</Button>
					</DialogTrigger>
					<ElectionForm
						mode="create"
						onSubmit={handleCreate}
						onCancel={() => setIsCreateOpen(false)}
						isSubmitting={createMutation.isPending}
					/>
				</Dialog>
			</div>

			{/* Elections Grid */}
			{isLoading ? (
				<div className="text-center text-gray-600">Loading elections...</div>
			) : elections && elections.length > 0 ? (
				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					{elections.map((election) => (
						<Card key={election.id}>
							<CardHeader>
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<CardTitle className="mb-1">{election.name}</CardTitle>
										<CardDescription className="line-clamp-2">
											{election.description || "No description"}
										</CardDescription>
									</div>
									{election.isActive && (
										<Badge variant="default" className="ml-2">
											Active
										</Badge>
									)}
								</div>
							</CardHeader>
							<CardContent>
								<div className="mb-4 space-y-2 text-sm">
									<div className="flex items-center gap-2 text-gray-600">
										<Calendar className="h-4 w-4" />
										<span>
											{new Date(election.startTime).toLocaleDateString()} -{" "}
											{new Date(election.endTime).toLocaleDateString()}
										</span>
									</div>
									<div className="flex items-center gap-2 text-gray-600">
										<Users className="h-4 w-4" />
										<span>{election._count.eligibleVoters} voters</span>
									</div>
									<div className="flex items-center gap-2 text-gray-600">
										<Vote className="h-4 w-4" />
										<span>
											{election._count.ballots} ballots, {election._count.votes}{" "}
											votes
										</span>
									</div>
								</div>

								<div className="flex gap-2">
									<Button asChild className="flex-1" size="sm">
										<Link href={`/admin/${election.id}`}>
											<Settings className="mr-2 h-4 w-4" />
											Manage
										</Link>
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={() => handleDelete(election.id, election.name)}
										disabled={deleteMutation.isPending}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			) : (
				<Card className="p-12 text-center">
					<p className="mb-4 text-gray-600">
						No elections yet. Create your first election to get started.
					</p>
					<Button onClick={() => setIsCreateOpen(true)}>
						<Plus className="mr-2 h-4 w-4" />
						Create Election
					</Button>
				</Card>
			)}
		</div>
	);
}
