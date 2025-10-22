import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/permissions";

export default async function AdminDashboardPage() {
	const session = await requireAdmin();

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-16 dark:from-slate-900 dark:to-slate-800">
			<div className="container mx-auto">
				<div className="mb-8">
					<h1 className="mb-2 font-bold text-3xl text-slate-900 dark:text-slate-50">
						Admin Dashboard
					</h1>
					<p className="text-slate-600 dark:text-slate-400">
						Welcome, {session.user.name} ({session.user.role})
					</p>
				</div>

				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					<Card>
						<CardHeader>
							<CardTitle>Elections</CardTitle>
							<CardDescription>Manage elections and ballots</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-muted-foreground text-sm">
								Create and manage elections
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Voters</CardTitle>
							<CardDescription>Manage eligible voters</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-muted-foreground text-sm">
								Import voter lists via CSV
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Results</CardTitle>
							<CardDescription>View election results</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-muted-foreground text-sm">
								View and export results
							</p>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
