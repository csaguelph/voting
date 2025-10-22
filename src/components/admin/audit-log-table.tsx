"use client";

import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { RouterOutputs } from "@/trpc/react";

type AuditLog = RouterOutputs["audit"]["getAuditLogs"]["logs"][number];

interface AuditLogTableProps {
	logs: AuditLog[];
}

function getCategoryColor(
	category: string,
): "default" | "secondary" | "destructive" | "outline" {
	switch (category) {
		case "election":
			return "default";
		case "voter":
			return "secondary";
		case "ballot":
			return "outline";
		case "results":
			return "default";
		case "auth":
			return "secondary";
		default:
			return "outline";
	}
}

export function AuditLogTable({ logs }: AuditLogTableProps) {
	if (logs.length === 0) {
		return (
			<div className="py-12 text-center text-muted-foreground">
				No audit logs found for the selected filters.
			</div>
		);
	}

	return (
		<div className="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Timestamp</TableHead>
						<TableHead>Election</TableHead>
						<TableHead>Action</TableHead>
						<TableHead>Category</TableHead>
						<TableHead>User</TableHead>
						<TableHead>Details</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{logs.map((log) => {
						const details = log.details as Record<string, unknown>;
						return (
							<TableRow key={log.id}>
								<TableCell className="font-mono text-sm">
									{new Date(log.timestamp).toLocaleString("en-US", {
										year: "numeric",
										month: "short",
										day: "numeric",
										hour: "2-digit",
										minute: "2-digit",
										timeZone: "America/Toronto",
									})}
								</TableCell>
								<TableCell>
									{log.election?.name ?? (
										<span className="text-muted-foreground">—</span>
									)}
								</TableCell>
								<TableCell className="font-medium">{log.displayName}</TableCell>
								<TableCell>
									<Badge variant={getCategoryColor(log.category)}>
										{log.category}
									</Badge>
								</TableCell>
								<TableCell>
									{details.userEmail ? (
										<div>
											<div className="text-sm">
												{details.userEmail as string}
											</div>
											<div className="text-muted-foreground text-xs">
												{details.userRole as string}
											</div>
										</div>
									) : (
										<span className="text-muted-foreground">System</span>
									)}
								</TableCell>
								<TableCell>
									<details className="text-xs">
										<summary className="cursor-pointer text-muted-foreground hover:text-foreground">
											View details
										</summary>
										<pre className="mt-2 max-w-md overflow-auto rounded bg-muted p-2">
											{JSON.stringify(details, null, 2)}
										</pre>
									</details>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}
