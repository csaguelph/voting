import Link from "next/link";

import { GlobalSettings } from "@/components/admin/global-settings";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/permissions";

export default async function SettingsPage() {
	// Require admin access
	await requireAdmin();

	return (
		<>
			{/* Header */}
			<div className="mb-8">
				<div className="mb-2 flex items-center gap-2">
					<Button variant="ghost" size="sm" asChild className="text-gray-700">
						<Link href="/admin">← Back to Dashboard</Link>
					</Button>
				</div>
				<h1 className="font-bold text-4xl text-gray-900">Global Settings</h1>
				<p className="text-gray-600">
					Configure system-wide settings for the CSA voting platform
				</p>
			</div>

			<GlobalSettings />
		</>
	);
}
