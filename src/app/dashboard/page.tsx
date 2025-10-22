import { redirect } from "next/navigation";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { auth } from "@/server/auth";

export default async function DashboardPage() {
	const session = await auth();

	if (!session) {
		redirect("/auth/signin");
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
			<div className="container mx-auto px-4 py-16">
				<div className="mb-8">
					<h1 className="mb-2 font-bold text-3xl text-slate-900 dark:text-slate-50">
						Student Dashboard
					</h1>
					<p className="text-slate-600 dark:text-slate-400">
						Welcome back, {session.user.name}!
					</p>
				</div>

				<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
					<Card>
						<CardHeader>
							<CardTitle>Active Elections</CardTitle>
							<CardDescription>Elections you can vote in</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-muted-foreground text-sm">
								No active elections at this time.
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Upcoming Elections</CardTitle>
							<CardDescription>Elections starting soon</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-muted-foreground text-sm">
								No upcoming elections scheduled.
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Past Elections</CardTitle>
							<CardDescription>
								Elections you've participated in
							</CardDescription>
						</CardHeader>
						<CardContent>
							<p className="text-muted-foreground text-sm">
								You haven't participated in any elections yet.
							</p>
						</CardContent>
					</Card>
				</div>

				<Card className="mt-6">
					<CardHeader>
						<CardTitle>Your Profile</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2">
						<div className="grid grid-cols-2 gap-4">
							<div>
								<p className="font-medium text-sm">Name</p>
								<p className="text-muted-foreground text-sm">
									{session.user.name}
								</p>
							</div>
							<div>
								<p className="font-medium text-sm">Email</p>
								<p className="text-muted-foreground text-sm">
									{session.user.email}
								</p>
							</div>
							<div>
								<p className="font-medium text-sm">Role</p>
								<p className="text-muted-foreground text-sm">
									{session.user.role}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
