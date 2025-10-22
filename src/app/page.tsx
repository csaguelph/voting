import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { auth } from "@/server/auth";
import { HydrateClient } from "@/trpc/server";

export default async function Home() {
	const session = await auth();

	return (
		<HydrateClient>
			<main className="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 ">
				<div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
					<div className="flex flex-col items-center gap-4 text-center">
						<h1 className="font-bold text-4xl text-slate-900 tracking-tight sm:text-5xl md:text-6xl">
							Central Student Association
						</h1>
						<h2 className="font-semibold text-2xl text-slate-700 sm:text-3xl">
							Voting Platform
						</h2>
						<p className="max-w-2xl text-lg text-slate-600">
							Transparent, verifiable, and secure elections for students
						</p>
					</div>

					<Card className="w-full max-w-md">
						<CardHeader>
							<CardTitle>{session ? "Welcome Back" : "Get Started"}</CardTitle>
							<CardDescription>
								{session
									? `Signed in as ${session.user?.name ?? session.user?.email}`
									: "Sign in with your Microsoft 365 account to participate in elections"}
							</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							{session ? (
								<>
									<Button asChild className="w-full">
										<Link href="/dashboard">View My Elections</Link>
									</Button>
									<Button asChild variant="outline" className="w-full">
										<Link href="/api/auth/signout">Sign Out</Link>
									</Button>
								</>
							) : (
								<Button asChild className="w-full">
									<Link href="/api/auth/signin">
										Sign In with Microsoft 365
									</Link>
								</Button>
							)}
						</CardContent>
					</Card>

					<div className="grid w-full max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<span className="text-2xl">🔒</span>
									Secure
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-slate-600 text-sm">
									Vote anonymization ensures your choices remain private while
									maintaining election integrity
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<span className="text-2xl">✓</span>
									Verifiable
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-slate-600 text-sm">
									Cryptographic proofs allow independent verification of
									election results
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<span className="text-2xl">👁️</span>
									Transparent
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-slate-600 text-sm">
									Public audit logs and election data ensure complete
									transparency
								</p>
							</CardContent>
						</Card>
					</div>
				</div>
			</main>
		</HydrateClient>
	);
}
