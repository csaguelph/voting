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
		<div>
			<div className="mb-8">
				<h1 className="mb-2 font-bold text-3xl text-gray-900">
					Student Dashboard
				</h1>
				<p className="text-gray-600">Welcome back, {session.user.name}!</p>
			</div>

			<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				<Card>
					<CardHeader>
						<CardTitle>Active Elections</CardTitle>
						<CardDescription>Elections you can vote in</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-gray-600 text-sm">
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
						<p className="text-gray-600 text-sm">
							No upcoming elections scheduled.
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Past Elections</CardTitle>
						<CardDescription>Elections you've participated in</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-gray-600 text-sm">
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
							<p className="font-medium text-gray-900 text-sm">Name</p>
							<p className="text-gray-600 text-sm">{session.user.name}</p>
						</div>
						<div>
							<p className="font-medium text-gray-900 text-sm">Email</p>
							<p className="text-gray-600 text-sm">{session.user.email}</p>
						</div>
						<div>
							<p className="font-medium text-gray-900 text-sm">Role</p>
							<p className="text-gray-600 text-sm">{session.user.role}</p>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
