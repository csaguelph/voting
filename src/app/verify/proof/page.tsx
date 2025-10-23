import { AlertCircle, Shield } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

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
import { ProofVerificationForm } from "./proof-form";

export const metadata = {
	title: "Merkle Proof Verification | CSA Voting",
	description:
		"Generate and verify cryptographic Merkle proofs for vote inclusion",
};

export default function Page() {
	return (
		<PublicLayout>
			<div className="mx-auto max-w-4xl">
				{/* Header */}
				<div className="mb-8 text-center">
					<div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
						<Shield className="h-10 w-10 text-purple-600" />
					</div>
					<h1 className="font-bold text-3xl">Merkle Proof Verification</h1>
					<p className="mt-2 text-muted-foreground">
						Generate and verify cryptographic proof of vote inclusion
					</p>
				</div>

				{/* Info Alert */}
				<Alert className="mb-8">
					<AlertCircle className="h-4 w-4" />
					<AlertDescription>
						Merkle proofs provide mathematical certainty that your vote was
						included in the election without revealing how you voted. Generate a
						proof for your vote hash to verify inclusion.
					</AlertDescription>
				</Alert>

				{/* Interactive Form - Client Component */}
				<Suspense fallback={<div>Loading...</div>}>
					<ProofVerificationForm />
				</Suspense>

				{/* How It Works */}
				<Card>
					<CardHeader>
						<CardTitle>How Merkle Proofs Work</CardTitle>
						<CardDescription>
							Understanding cryptographic vote verification
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-6 md:grid-cols-2">
							<div>
								<h4 className="mb-2 font-semibold">Merkle Tree</h4>
								<p className="text-muted-foreground text-sm">
									All vote hashes are organized into a binary tree structure.
									Each parent node is the hash of its two children, creating a
									single root hash at the top.
								</p>
							</div>

							<div>
								<h4 className="mb-2 font-semibold">Proof Path</h4>
								<p className="text-muted-foreground text-sm">
									To prove a vote is in the tree, you only need the sibling
									hashes along the path from your vote to the root. This is much
									smaller than the full tree.
								</p>
							</div>

							<div>
								<h4 className="mb-2 font-semibold">Verification</h4>
								<p className="text-muted-foreground text-sm">
									By hashing your vote with the proof path hashes, you can
									recalculate the root. If it matches the official Merkle root,
									your vote was included.
								</p>
							</div>

							<div>
								<h4 className="mb-2 font-semibold">Privacy</h4>
								<p className="text-muted-foreground text-sm">
									The proof only proves inclusion - it doesn't reveal who you
									voted for. Only you have your specific vote hash, maintaining
									anonymity.
								</p>
							</div>
						</div>

						<div className="rounded-lg border bg-blue-50 p-4">
							<h4 className="mb-2 font-semibold text-blue-900">
								Why This Matters
							</h4>
							<p className="text-blue-800 text-sm">
								Merkle proofs provide mathematical certainty that every vote was
								counted, without requiring trust in the election administrators.
								Anyone can independently verify the proof.
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Back Link */}
				<div className="mt-8 text-center">
					<Button asChild variant="outline">
						<Link href="/verify">← Back to Vote Verification</Link>
					</Button>
				</div>
			</div>
		</PublicLayout>
	);
}
