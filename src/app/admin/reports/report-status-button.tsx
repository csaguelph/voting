"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

/** Mark a report resolved once the CRO has followed up, or reopen it */
export function ReportStatusButton({
	id,
	status,
}: {
	id: string;
	status: "OPEN" | "RESOLVED";
}) {
	const router = useRouter();
	const [refreshing, startRefresh] = useTransition();
	const setStatus = api.report.setStatus.useMutation({
		onSuccess: (report) => {
			toast.success(
				report.status === "RESOLVED" ? "Report resolved" : "Report reopened",
			);
			startRefresh(() => router.refresh());
		},
		onError: (error) => {
			toast.error("Couldn't update the report", {
				description: error.message,
			});
		},
	});
	const busy = setStatus.isPending || refreshing;

	return (
		<Button
			variant={status === "OPEN" ? "default" : "outline"}
			disabled={busy}
			onClick={() =>
				setStatus.mutate({
					id,
					status: status === "OPEN" ? "RESOLVED" : "OPEN",
				})
			}
		>
			{busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
			{status === "OPEN" ? "Mark Resolved" : "Reopen"}
		</Button>
	);
}
