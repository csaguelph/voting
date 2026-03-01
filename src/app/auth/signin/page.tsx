import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { auth, signIn } from "@/server/auth";

/** Allow only relative paths to avoid open redirects */
function safeCallbackUrl(value: string | null | undefined): string {
	if (
		typeof value !== "string" ||
		!value.startsWith("/") ||
		value.startsWith("//")
	) {
		return "/dashboard";
	}
	return value;
}

export default async function SignInPage({
	searchParams,
}: {
	searchParams: Promise<{ callbackUrl?: string }>;
}) {
	const session = await auth();
	const { callbackUrl: rawCallbackUrl } = await searchParams;
	const callbackUrl = safeCallbackUrl(rawCallbackUrl);

	// If already signed in, redirect to intended destination or dashboard
	if (session) {
		redirect(callbackUrl);
	}

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 px-4">
			<Card className="w-full max-w-md">
				<CardHeader className="space-y-1">
					<CardTitle className="text-center text-2xl">Sign In</CardTitle>
					<CardDescription className="text-center">
						Sign in with your Microsoft 365 account to access the CSA Voting
						Platform
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						action={async (formData: FormData) => {
							"use server";
							const url = formData.get("callbackUrl");
							const redirectTo = safeCallbackUrl(
								typeof url === "string" ? url : undefined,
							);
							await signIn("microsoft-entra-id", {
								redirectTo,
							});
						}}
					>
						<input type="hidden" name="callbackUrl" value={callbackUrl} />
						<Button type="submit" className="w-full" size="lg">
							<svg
								className="mr-2 size-5"
								viewBox="0 0 23 23"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<title>Microsoft</title>
								<path d="M0 0h11v11H0z" fill="#f25022" />
								<path d="M12 0h11v11H12z" fill="#7fba00" />
								<path d="M0 12h11v11H0z" fill="#00a4ef" />
								<path d="M12 12h11v11H12z" fill="#ffb900" />
							</svg>
							Sign in with Microsoft 365
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
