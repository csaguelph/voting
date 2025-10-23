import { CheckCircle, Info, Lock, Shield } from "lucide-react";
import Link from "next/link";

import { PublicLayout } from "@/components/layouts/public-layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { VerificationForm } from "@/components/verify/verification-form";

export const metadata = {
	title: "Verify Your Vote | CSA Voting",
	description:
		"Verify that your vote was counted in the CSA election using your vote hash",
};

export default function VerifyPage() {
	return (
		<PublicLayout>
			<div className="mx-auto max-w-4xl">
				{/* Header */}
				<div className="mb-8 text-center">
					<div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
						<Shield className="h-10 w-10 text-blue-600" />
					</div>
					<h1 className="font-bold text-3xl">Vote Verification Portal</h1>
					<p className="mt-2 text-muted-foreground">
						Verify that your vote was counted in the election
					</p>
				</div>

				{/* Info Alert */}
				<Alert className="mb-8">
					<Info className="h-4 w-4" />
					<AlertDescription>
						Enter your vote hash to verify that your vote was recorded in our
						system. Your vote remains anonymous - we only confirm that the hash
						exists.
					</AlertDescription>
				</Alert>

				{/* Verification Form */}
				<VerificationForm />

				{/* Merkle Proof Link */}
				<Card className="mt-8 border-purple-200 bg-purple-50">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Lock className="h-5 w-5 text-purple-600" />
							Advanced: Merkle Proof Verification
						</CardTitle>
						<CardDescription>
							Generate cryptographic proof that your vote was included in the
							Merkle tree
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="mb-4 text-sm">
							For maximum security and transparency, you can generate a Merkle
							proof that mathematically proves your vote was included in the
							election without revealing how you voted.
						</p>
						<Button asChild variant="outline" className="w-full">
							<Link href="/verify/proof">Generate Merkle Proof →</Link>
						</Button>
					</CardContent>
				</Card>

				{/* How It Works */}
				<Card className="mt-8">
					<CardHeader>
						<CardTitle>How Vote Verification Works</CardTitle>
						<CardDescription>
							Understanding the verification process
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						<div className="grid gap-6 md:grid-cols-2">
							<div>
								<div className="mb-3 flex items-center gap-2">
									<div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-600 text-sm">
										1
									</div>
									<h3 className="font-semibold">Receive Your Hash</h3>
								</div>
								<p className="text-muted-foreground text-sm">
									When you vote, you receive a unique cryptographic hash for
									each ballot. Save this hash in your receipt.
								</p>
							</div>

							<div>
								<div className="mb-3 flex items-center gap-2">
									<div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-600 text-sm">
										2
									</div>
									<h3 className="font-semibold">Enter Your Hash</h3>
								</div>
								<p className="text-muted-foreground text-sm">
									Copy and paste your vote hash into the verification form
									above. You can verify one or multiple hashes at once.
								</p>
							</div>

							<div>
								<div className="mb-3 flex items-center gap-2">
									<div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-600 text-sm">
										3
									</div>
									<h3 className="font-semibold">Check Status</h3>
								</div>
								<p className="text-muted-foreground text-sm">
									The system will confirm whether your hash exists in our
									database and when it was recorded.
								</p>
							</div>

							<div>
								<div className="mb-3 flex items-center gap-2">
									<div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 font-semibold text-green-600 text-sm">
										<CheckCircle className="h-4 w-4" />
									</div>
									<h3 className="font-semibold">Vote Confirmed</h3>
								</div>
								<p className="text-muted-foreground text-sm">
									If your hash is found, your vote was successfully counted in
									the election. Your anonymity is preserved.
								</p>
							</div>
						</div>

						{/* Privacy Notice */}
						<div className="rounded-lg border bg-muted/50 p-4">
							<h4 className="mb-2 flex items-center gap-2 font-semibold">
								<Shield className="h-4 w-4" />
								Privacy & Security
							</h4>
							<ul className="space-y-1 text-muted-foreground text-sm">
								<li>• Your vote hash does not reveal who you voted for</li>
								<li>• Only you have access to your specific vote hash</li>
								<li>
									• Verification confirms your vote was counted, not who won
								</li>
								<li>
									• Vote hashes are deterministic - any tampering with vote data
									will invalidate the hash
								</li>
								<li>
									• Merkle tree proofs provide cryptographic proof of vote
									inclusion
								</li>
							</ul>
						</div>
					</CardContent>
				</Card>

				{/* FAQ */}
				<Card className="mt-8">
					<CardHeader>
						<CardTitle>Frequently Asked Questions</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<h4 className="mb-1 font-semibold">
								What if I lost my vote hash?
							</h4>
							<p className="text-muted-foreground text-sm">
								Vote hashes are only shown immediately after voting. If you
								didn't save your receipt, you can still confirm that you voted
								by checking your voting status in your dashboard, but you won't
								be able to verify individual vote hashes.
							</p>
						</div>

						<div>
							<h4 className="mb-1 font-semibold">
								Does verification reveal who I voted for?
							</h4>
							<p className="text-muted-foreground text-sm">
								No. The verification system only confirms that your vote hash
								exists in our database. It does not reveal which candidate you
								voted for or link your identity to any specific vote.
							</p>
						</div>

						<div>
							<h4 className="mb-1 font-semibold">
								What if my hash is not found?
							</h4>
							<p className="text-muted-foreground text-sm">
								If your hash is not found, double-check that you copied it
								correctly. If the problem persists, contact the Chief Returning
								Officer. Your vote may not have been recorded due to a technical
								issue.
							</p>
						</div>

						<div>
							<h4 className="mb-1 font-semibold">
								Can I verify someone else's vote?
							</h4>
							<p className="text-muted-foreground text-sm">
								Yes, anyone can verify any vote hash. However, you need the
								exact hash to verify a vote. Hashes are unique and cannot be
								guessed, ensuring privacy while maintaining transparency.
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</PublicLayout>
	);
}
