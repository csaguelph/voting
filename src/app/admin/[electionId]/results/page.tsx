"use client";

import { ResultsChart } from "@/components/results/results-chart";
import { ResultsTable } from "@/components/results/results-table";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/results/formatter";
import { api } from "@/trpc/react";
import {
	AlertCircle,
	Download,
	Eye,
	EyeOff,
	FileText,
	Lock,
	Unlock,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function ResultsPage() {
	const params = useParams();
	const electionId = params.electionId as string;
	const [showCharts, setShowCharts] = useState(false);
	const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
	const [publishDialogOpen, setPublishDialogOpen] = useState(false);
	const [unpublishDialogOpen, setUnpublishDialogOpen] = useState(false);

	const utils = api.useUtils();

	// Fetch results
	const { data: results, isLoading } = api.results.getElectionResults.useQuery({
		electionId,
	});

	// Mutations
	const finalizeMutation = api.results.finalizeResults.useMutation({
		onSuccess: () => {
			toast.success("Results finalized successfully");
			utils.results.getElectionResults.invalidate({ electionId });
			setFinalizeDialogOpen(false);
		},
		onError: (error) => {
			toast.error("Failed to finalize results", {
				description: error.message,
			});
		},
	});

	const publishMutation = api.results.publishResults.useMutation({
		onSuccess: () => {
			toast.success("Results published successfully");
			utils.results.getElectionResults.invalidate({ electionId });
			setPublishDialogOpen(false);
		},
		onError: (error) => {
			toast.error("Failed to publish results", {
				description: error.message,
			});
		},
	});

	const unpublishMutation = api.results.unpublishResults.useMutation({
		onSuccess: () => {
			toast.success("Results unpublished successfully");
			utils.results.getElectionResults.invalidate({ electionId });
			setUnpublishDialogOpen(false);
		},
		onError: (error) => {
			toast.error("Failed to unpublish results", {
				description: error.message,
			});
		},
	});

	// Export functions
	const handleExportCSV = async () => {
		try {
			const data = await utils.client.results.exportResultsCSV.query({
				electionId,
			});
			const blob = new Blob([data.csv], { type: "text/csv" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = data.filename;
			a.click();
			URL.revokeObjectURL(url);
			toast.success("CSV exported successfully");
		} catch (error) {
			toast.error("Failed to export CSV", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		}
	};

	const handleExportJSON = async () => {
		try {
			const data = await utils.client.results.exportResultsJSON.query({
				electionId,
			});
			const blob = new Blob([data.json], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = data.filename;
			a.click();
			URL.revokeObjectURL(url);
			toast.success("JSON exported successfully");
		} catch (error) {
			toast.error("Failed to export JSON", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		}
	};

	const handleGenerateReport = async () => {
		try {
			const data = await utils.client.results.generateSummaryReport.query({
				electionId,
			});
			const blob = new Blob([data.report], { type: "text/plain" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = data.filename;
			a.click();
			URL.revokeObjectURL(url);
			toast.success("Summary report generated successfully");
		} catch (error) {
			toast.error("Failed to generate report", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		}
	};

	if (isLoading) {
		return (
			<div className="container mx-auto p-6">
				<div className="flex items-center justify-center py-12">
					<div className="text-center">
						<div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
						<p className="text-muted-foreground">Loading results...</p>
					</div>
				</div>
			</div>
		);
	}

	if (!results) {
		return (
			<div className="container mx-auto p-6">
				<Card>
					<CardContent className="pt-6">
						<div className="text-center">
							<AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
							<h3 className="mb-2 font-semibold text-lg">
								Results Not Available
							</h3>
							<p className="text-muted-foreground">
								Unable to load results for this election.
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Check if election has ended
	const electionEnded = new Date() > new Date(results.endTime);

	return (
		<div className="container mx-auto space-y-6 p-6">
			{/* Back Button */}
			<div className="mb-2 flex items-center gap-2">
				<Button variant="ghost" size="sm" asChild className="text-gray-700">
					<Link href={`/admin/${electionId}`}>
						← Back to {results.electionName}
					</Link>
				</Button>
			</div>

			{/* Warning if election hasn't ended */}
			{!electionEnded && (
				<Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
					<CardContent>
						<div className="flex items-start gap-4">
							<AlertCircle className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
							<div>
								<h3 className="mb-1 font-semibold text-blue-900 dark:text-blue-100">
									Election Still In Progress
								</h3>
								<p className="text-blue-700 text-sm dark:text-blue-300">
									Vote counts, percentages, and winners are hidden until the
									election ends on{" "}
									{new Date(results.endTime).toLocaleString("en-US", {
										year: "numeric",
										month: "long",
										day: "numeric",
										hour: "2-digit",
										minute: "2-digit",
										timeZone: "America/Toronto",
									})}
									. This prevents any potential bias or premature disclosure of
									results.
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Header */}
			<div className="flex items-start justify-between">
				<div>
					<h1 className="mb-2 font-bold text-3xl">{results.electionName}</h1>
					<p className="text-muted-foreground">Election Results</p>
				</div>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => setShowCharts(!showCharts)}
						disabled={!electionEnded}
					>
						{showCharts ? "Hide Charts" : "Show Charts"}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={handleExportCSV}
						disabled={!electionEnded}
					>
						<Download className="mr-2 h-4 w-4" />
						Export CSV
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={handleExportJSON}
						disabled={!electionEnded}
					>
						<Download className="mr-2 h-4 w-4" />
						Export JSON
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={handleGenerateReport}
						disabled={!electionEnded}
					>
						<FileText className="mr-2 h-4 w-4" />
						Summary Report
					</Button>
				</div>
			</div>

			{/* Status Cards */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="font-medium text-sm">Turnout</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">
							{results.turnoutPercentage.toFixed(1)}%
						</div>
						<p className="text-muted-foreground text-xs">
							{results.totalVoted} / {results.totalEligibleVoters} voters
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="font-medium text-sm">Ballots</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="font-bold text-2xl">{results.ballots.length}</div>
						<p className="text-muted-foreground text-xs">Total ballots</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="font-medium text-sm">Status</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-2">
							{results.isFinalized ? (
								<Badge variant="default" className="bg-blue-600">
									<Lock className="mr-1 h-3 w-3" />
									Finalized
								</Badge>
							) : (
								<Badge variant="secondary">
									<Unlock className="mr-1 h-3 w-3" />
									Not Finalized
								</Badge>
							)}
						</div>
						{results.finalizedAt && (
							<p className="mt-1 text-muted-foreground text-xs">
								{formatDate(results.finalizedAt)}
							</p>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="font-medium text-sm">Visibility</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-2">
							{results.isPublished ? (
								<Badge variant="default" className="bg-green-600">
									<Eye className="mr-1 h-3 w-3" />
									Published
								</Badge>
							) : (
								<Badge variant="secondary">
									<EyeOff className="mr-1 h-3 w-3" />
									Not Published
								</Badge>
							)}
						</div>
						{results.publishedAt && (
							<p className="mt-1 text-muted-foreground text-xs">
								{formatDate(results.publishedAt)}
							</p>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Actions */}
			{electionEnded && (
				<Card>
					<CardHeader>
						<CardTitle>Results Management</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{!results.isFinalized && (
							<div className="flex items-start gap-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
								<AlertCircle className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
								<div className="flex-1">
									<h4 className="font-semibold text-blue-900 dark:text-blue-100">
										Results Not Finalized
									</h4>
									<p className="mt-1 text-blue-700 text-sm dark:text-blue-300">
										Once finalized, results cannot be changed. This prevents any
										accidental modifications to the election outcome.
									</p>
									<Button
										className="mt-3"
										onClick={() => setFinalizeDialogOpen(true)}
										disabled={finalizeMutation.isPending}
									>
										<Lock className="mr-2 h-4 w-4" />
										Finalize Results
									</Button>
								</div>
							</div>
						)}

						{results.isFinalized && !results.isPublished && (
							<div className="flex items-start gap-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
								<AlertCircle className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
								<div className="flex-1">
									<h4 className="font-semibold text-blue-900 dark:text-blue-100">
										Ready to Publish
									</h4>
									<p className="mt-1 text-blue-700 text-sm dark:text-blue-300">
										Results are finalized and ready to be made public. Once
										published, voters and the public can view the results.
									</p>
									<Button
										className="mt-3"
										onClick={() => setPublishDialogOpen(true)}
										disabled={publishMutation.isPending}
									>
										<Eye className="mr-2 h-4 w-4" />
										Publish Results
									</Button>
								</div>
							</div>
						)}

						{results.isPublished && (
							<div className="flex items-start gap-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
								<Eye className="mt-0.5 h-5 w-5 text-green-600 dark:text-green-400" />
								<div className="flex-1">
									<h4 className="font-semibold text-green-900 dark:text-green-100">
										Results Published
									</h4>
									<p className="mt-1 text-green-700 text-sm dark:text-green-300">
										Results are now public and visible to all voters. You can
										unpublish if needed.
									</p>
									<Button
										variant="destructive"
										className="mt-3"
										onClick={() => setUnpublishDialogOpen(true)}
										disabled={unpublishMutation.isPending}
									>
										<EyeOff className="mr-2 h-4 w-4" />
										Unpublish Results
									</Button>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{/* Results for each ballot */}
			<div className="space-y-6">
				{electionEnded ? (
					results.ballots.map((ballot) => (
						<div key={ballot.ballotId} className="space-y-4">
							<ResultsTable ballot={ballot} isAdmin={true} />
							{showCharts && <ResultsChart ballot={ballot} type="bar" />}
						</div>
					))
				) : (
					<Card>
						<CardContent className="py-12">
							<div className="text-center">
								<Lock className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
								<h3 className="mb-2 font-semibold text-lg">
									Results Locked Until Election Ends
								</h3>
								<p className="text-muted-foreground">
									Detailed results will be visible after the election concludes.
								</p>
							</div>
						</CardContent>
					</Card>
				)}
			</div>

			{/* Finalize Dialog */}
			<AlertDialog
				open={finalizeDialogOpen}
				onOpenChange={setFinalizeDialogOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Finalize Results?</AlertDialogTitle>
						<AlertDialogDescription>
							This will lock the results and prevent any further changes. This
							action cannot be undone. Make sure you have reviewed all results
							carefully before proceeding.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => finalizeMutation.mutate({ electionId })}
							disabled={finalizeMutation.isPending}
						>
							{finalizeMutation.isPending
								? "Finalizing..."
								: "Finalize Results"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Publish Dialog */}
			<AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Publish Results?</AlertDialogTitle>
						<AlertDialogDescription>
							This will make the results visible to the public. All voters will
							be able to see the election outcomes. You can unpublish later if
							needed.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => publishMutation.mutate({ electionId })}
							disabled={publishMutation.isPending}
						>
							{publishMutation.isPending ? "Publishing..." : "Publish Results"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Unpublish Dialog */}
			<AlertDialog
				open={unpublishDialogOpen}
				onOpenChange={setUnpublishDialogOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Unpublish Results?</AlertDialogTitle>
						<AlertDialogDescription>
							This will hide the results from public view. Only admins will be
							able to see the results. You can publish them again later.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => unpublishMutation.mutate({ electionId })}
							disabled={unpublishMutation.isPending}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{unpublishMutation.isPending
								? "Unpublishing..."
								: "Unpublish Results"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
