"use client";

import { AuditLogTable } from "@/components/admin/audit-log-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "@/trpc/react";
import { Download, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AuditLogsPage() {
	const [electionFilter, setElectionFilter] = useState<string>("all");
	const [actionFilter, setActionFilter] = useState<string>("all");
	const [searchQuery, setSearchQuery] = useState<string>("");
	const [page, setPage] = useState(0);
	const pageSize = 50;

	// Fetch audit logs
	const { data, isLoading, error } = api.audit.getAuditLogs.useQuery({
		electionId: electionFilter === "all" ? undefined : electionFilter,
		action: actionFilter === "all" ? undefined : actionFilter,
		search: searchQuery || undefined,
		limit: pageSize,
		offset: page * pageSize,
	});

	// Fetch elections for filter
	const { data: elections } = api.election.getAll.useQuery();

	// Fetch action types for filter
	const { data: actionTypes } = api.audit.getActionTypes.useQuery();

	// Export logs
	const handleExport = async () => {
		try {
			const utils = api.useUtils();
			const result = await utils.client.audit.exportAuditLogs.query({
				electionId: electionFilter === "all" ? undefined : electionFilter,
				action: actionFilter === "all" ? undefined : actionFilter,
			});

			const blob = new Blob([result.csv], { type: "text/csv" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = result.filename;
			a.click();
			URL.revokeObjectURL(url);

			toast.success("Audit logs exported successfully");
		} catch (error) {
			toast.error("Failed to export audit logs", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		}
	};

	return (
		<div className="container mx-auto space-y-6 p-6">
			{/* Header */}
			<div>
				<h1 className="mb-2 font-bold text-4xl">Audit Logs</h1>
				<p className="text-muted-foreground">
					View and export comprehensive audit trails of all system actions
				</p>
			</div>

			{/* Filters */}
			<Card>
				<CardHeader>
					<CardTitle>Filters</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-4 md:grid-cols-3">
						{/* Election Filter */}
						<div className="space-y-2">
							<label htmlFor="election-filter" className="font-medium text-sm">
								Election
							</label>
							<Select value={electionFilter} onValueChange={setElectionFilter}>
								<SelectTrigger id="election-filter">
									<SelectValue placeholder="All elections" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All elections</SelectItem>
									{elections?.map((election) => (
										<SelectItem key={election.id} value={election.id}>
											{election.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Action Type Filter */}
						<div className="space-y-2">
							<label htmlFor="action-filter" className="font-medium text-sm">
								Action Type
							</label>
							<Select value={actionFilter} onValueChange={setActionFilter}>
								<SelectTrigger id="action-filter">
									<SelectValue placeholder="All actions" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All actions</SelectItem>
									{actionTypes?.map((action) => (
										<SelectItem key={action.value} value={action.value}>
											{action.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Search */}
						<div className="space-y-2">
							<label htmlFor="search-input" className="font-medium text-sm">
								Search
							</label>
							<div className="relative">
								<Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
								<Input
									id="search-input"
									placeholder="Search actions..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-8"
								/>
							</div>
						</div>
					</div>

					<div className="flex items-center justify-between">
						<Button
							variant="outline"
							onClick={() => {
								setElectionFilter("");
								setActionFilter("");
								setSearchQuery("");
								setPage(0);
							}}
						>
							Clear Filters
						</Button>

						<Button variant="outline" onClick={handleExport}>
							<Download className="mr-2 h-4 w-4" />
							Export CSV
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Results */}
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle>Audit Log Entries</CardTitle>
						{data && (
							<p className="text-muted-foreground text-sm">
								Showing {page * pageSize + 1} -{" "}
								{Math.min((page + 1) * pageSize, data.total)} of {data.total}{" "}
								logs
							</p>
						)}
					</div>
				</CardHeader>
				<CardContent>
					{isLoading ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
						</div>
					) : error ? (
						<div className="py-12 text-center text-destructive">
							<p>Error loading audit logs</p>
							<p className="text-sm">{error.message}</p>
						</div>
					) : data ? (
						<>
							<AuditLogTable logs={data.logs} />

							{/* Pagination */}
							{data.total > pageSize && (
								<div className="mt-4 flex items-center justify-between">
									<Button
										variant="outline"
										onClick={() => setPage((p) => Math.max(0, p - 1))}
										disabled={page === 0}
									>
										Previous
									</Button>
									<span className="text-muted-foreground text-sm">
										Page {page + 1} of {Math.ceil(data.total / pageSize)}
									</span>
									<Button
										variant="outline"
										onClick={() => setPage((p) => p + 1)}
										disabled={!data.hasMore}
									>
										Next
									</Button>
								</div>
							)}
						</>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
}
