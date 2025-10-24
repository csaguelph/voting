"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { COLLEGES } from "@/lib/constants/colleges";
import { api } from "@/trpc/react";
import type { ColDef } from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { AgGridReact } from "ag-grid-react";
import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface VoterTableProps {
	electionId: string;
}

interface VoterRow {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	college: string;
	hasVoted: boolean;
	votedAt: Date | null;
}

export function VoterTable({ electionId }: VoterTableProps) {
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [collegeFilter, setCollegeFilter] = useState<string>("all");
	const pageSize = 100;

	// Debounce search input
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(search);
			setPage(1); // Reset to first page when search changes
		}, 300);

		return () => clearTimeout(timer);
	}, [search]);

	// Fetch voters with pagination and filters
	const { data, isLoading } = api.admin.getVoters.useQuery({
		electionId,
		page,
		pageSize,
		search: debouncedSearch || undefined,
		college: collegeFilter === "all" ? undefined : collegeFilter,
	});

	// Column definitions
	const columnDefs: ColDef<VoterRow>[] = useMemo(
		() => [
			{
				field: "firstName",
				headerName: "First Name",
				filter: true,
				sortable: true,
				flex: 1,
				cellClass: "font-medium",
			},
			{
				field: "lastName",
				headerName: "Last Name",
				filter: true,
				sortable: true,
				flex: 1,
				cellClass: "font-medium",
			},
			{
				field: "college",
				headerName: "College",
				filter: true,
				sortable: true,
				flex: 0.8,
				cellClass: "text-muted-foreground",
			},
			{
				field: "email",
				headerName: "Email",
				filter: true,
				sortable: true,
				flex: 2,
				cellClass: "text-sm text-muted-foreground",
			},
			{
				field: "hasVoted",
				headerName: "Status",
				sortable: true,
				flex: 0.8,
				cellRenderer: (params: { value: boolean }) => {
					return params.value ? (
						<Badge variant="default" className="bg-green-600">
							Voted
						</Badge>
					) : (
						<Badge variant="secondary">Not Voted</Badge>
					);
				},
			},
		],
		[],
	);

	// Default column settings
	const defaultColDef = useMemo<ColDef>(
		() => ({
			resizable: true,
			sortable: true,
			cellStyle: {
				display: "flex",
				alignItems: "center",
			},
		}),
		[],
	);

	// Handle search
	const handleSearch = useCallback((value: string) => {
		setSearch(value);
	}, []);

	// Handle college filter
	const handleCollegeFilter = useCallback((value: string) => {
		setCollegeFilter(value);
		setPage(1); // Reset to first page on filter
	}, []);

	return (
		<div className="space-y-4">
			{/* Filters */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
				<div className="flex flex-1 gap-2">
					<div className="relative flex-1">
						<Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search by name or email..."
							value={search}
							onChange={(e) => handleSearch(e.target.value)}
							className="pl-9"
						/>
					</div>
					<Select value={collegeFilter} onValueChange={handleCollegeFilter}>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder="Filter by college" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Colleges</SelectItem>
							{COLLEGES.map((college) => (
								<SelectItem key={college} value={college}>
									{college}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* Grid */}
			<div className="ag-theme-quartz h-[600px] w-full rounded-lg border shadow-sm">
				<style jsx global>{`
					.ag-theme-quartz {
						--ag-font-family: inherit;
						--ag-font-size: 14px;
					}
					.ag-theme-quartz .ag-header {
						background-color: hsl(var(--muted));
						border-bottom: 2px solid hsl(var(--border));
					}
					.ag-theme-quartz .ag-header-cell {
						font-weight: 600;
						color: hsl(var(--foreground));
						font-size: 13px;
						text-transform: uppercase;
						letter-spacing: 0.025em;
					}
					.ag-theme-quartz .ag-row {
						border-bottom: 1px solid hsl(var(--border));
					}
					.ag-theme-quartz .ag-row:hover {
						background-color: hsl(var(--muted) / 0.3);
					}
				`}</style>
				<AgGridReact<VoterRow>
					rowData={data?.voters || []}
					columnDefs={columnDefs}
					defaultColDef={defaultColDef}
					pagination={false}
					loading={isLoading}
					rowSelection="multiple"
					suppressCellFocus={true}
					animateRows={true}
					rowHeight={40}
					headerHeight={44}
				/>
			</div>

			{/* Pagination */}
			{data?.pagination && (
				<div className="flex items-center justify-between">
					<div className="text-muted-foreground text-sm">
						Showing {(page - 1) * pageSize + 1} to{" "}
						{Math.min(page * pageSize, data.pagination.total)} of{" "}
						{data.pagination.total} voters
					</div>
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => setPage((p) => Math.max(1, p - 1))}
							disabled={page === 1}
						>
							Previous
						</Button>
						<div className="flex items-center gap-2 px-4">
							<span className="text-sm">
								Page {page} of {data.pagination.totalPages}
							</span>
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setPage((p) => p + 1)}
							disabled={page >= data.pagination.totalPages}
						>
							Next
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
