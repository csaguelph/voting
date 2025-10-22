import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export default function AuthErrorPage({
	searchParams,
}: {
	searchParams: { error?: string };
}) {
	const error = searchParams.error;

	const errorMessages: Record<string, string> = {
		Configuration: "There is a problem with the server configuration.",
		AccessDenied: "You do not have permission to sign in.",
		Verification:
			"The verification token has expired or has already been used.",
		Default: "An error occurred during authentication.",
	};

	const errorMessage = error
		? (errorMessages[error] ?? errorMessages.Default)
		: errorMessages.Default;

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 px-4">
			<Card className="w-full max-w-md">
				<CardHeader className="space-y-1">
					<CardTitle className="text-center text-2xl text-destructive">
						Authentication Error
					</CardTitle>
					<CardDescription className="text-center">
						{errorMessage}
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col items-center gap-4">
					<div className="rounded-full bg-destructive/10 p-3">
						<svg
							className="size-6 text-destructive"
							fill="none"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<title>Error</title>
							<path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
					</div>
					{error && (
						<p className="text-center text-muted-foreground text-sm">
							Error code: {error}
						</p>
					)}
				</CardContent>
				<CardFooter className="flex flex-col gap-2">
					<Button asChild className="w-full">
						<Link href="/auth/signin">Try Again</Link>
					</Button>
					<Button asChild variant="outline" className="w-full">
						<Link href="/">Go Home</Link>
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
