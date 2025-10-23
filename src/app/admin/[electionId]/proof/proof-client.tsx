"use client";

import {
	AlertCircle,
	CheckCircle,
	Copy,
	FileText,
	Loader2,
	Shield,
	TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { api } from "@/trpc/react";

interface ProofPageProps {
	electionId: string;
}

export function ProofPageClient({ electionId }: ProofPageProps) {
	const [isGenerating, setIsGenerating] = useState(false);

	// Get Merkle tree info
	const { data: merkleInfo, refetch: refetchMerkleInfo } =
		api.proof.getMerkleTreeInfo.useQuery({
			electionId,
		});

	// Get tree stats if tree exists
	const { data: treeStats } = api.proof.getTreeStats.useQuery(
		{ electionId },
		{
			enabled: !!merkleInfo?.hasMerkleTree,
		},
	);

	const generateMutation = api.proof.generateMerkleTree.useMutation({
		onSuccess: (result) => {
			toast.success("Merkle tree generated successfully!", {
				description: `Root: ${result.merkleRoot.substring(0, 16)}...`,
			});
			void refetchMerkleInfo();
		},
		onError: (error) => {
			toast.error("Failed to generate Merkle tree", {
				description: error.message,
			});
		},
	});

	const handleGenerateTree = () => {
		if (!merkleInfo || merkleInfo.hasMerkleTree) return;
		setIsGenerating(true);
		generateMutation.mutate(
			{ electionId },
			{
				onSettled: () => {
					setIsGenerating(false);
				},
			},
		);
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard
			.writeText(text)
			.then(() => {
				toast.success("Copied to clipboard");
			})
			.catch(() => {
				toast.error("Failed to copy");
			});
	};

	if (!merkleInfo) {
		return (
			<div className="flex min-h-[400px] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="mb-2 font-bold text-2xl">
					Cryptographic Proof Generation
				</h1>
				<p className="text-muted-foreground">
					Generate and manage Merkle tree for vote verification
				</p>
			</div>

			{/* Status Card */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Shield className="h-5 w-5" />
						Merkle Tree Status
					</CardTitle>
					<CardDescription>
						Cryptographic proof of all votes in this election
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<p className="font-medium">Status</p>
							<p className="text-muted-foreground text-sm">
								{merkleInfo.hasMerkleTree
									? "Merkle tree generated"
									: "Not yet generated"}
							</p>
						</div>
						<Badge variant={merkleInfo.hasMerkleTree ? "default" : "secondary"}>
							{merkleInfo.hasMerkleTree ? (
								<>
									<CheckCircle className="mr-1 h-3 w-3" />
									Generated
								</>
							) : (
								<>
									<AlertCircle className="mr-1 h-3 w-3" />
									Pending
								</>
							)}
						</Badge>
					</div>

					{merkleInfo.hasMerkleTree && merkleInfo.generatedAt && (
						<div>
							<p className="font-medium">Generated</p>
							<p className="text-muted-foreground text-sm">
								{new Date(merkleInfo.generatedAt).toLocaleString()}
							</p>
						</div>
					)}

					{!merkleInfo.hasMerkleTree && (
						<Alert>
							<AlertCircle className="h-4 w-4" />
							<AlertDescription>
								Generate the Merkle tree to enable cryptographic verification of
								all votes. This can only be done once and cannot be regenerated.
							</AlertDescription>
						</Alert>
					)}

					{!merkleInfo.hasMerkleTree && (
						<Button
							onClick={handleGenerateTree}
							disabled={isGenerating}
							className="w-full"
						>
							{isGenerating ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Generating Merkle Tree...
								</>
							) : (
								<>
									<Shield className="mr-2 h-4 w-4" />
									Generate Merkle Tree
								</>
							)}
						</Button>
					)}
				</CardContent>
			</Card>

			{/* Merkle Root Card */}
			{merkleInfo.hasMerkleTree && merkleInfo.merkleRoot && (
				<Card>
					<CardHeader>
						<CardTitle>Merkle Root</CardTitle>
						<CardDescription>
							The root hash of the Merkle tree - proof of all votes
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="rounded-lg border bg-muted/50 p-4">
							<div className="mb-2 flex items-center justify-between">
								<p className="font-medium text-sm">Root Hash</p>
								<Button
									variant="ghost"
									size="sm"
									onClick={() =>
										merkleInfo.merkleRoot &&
										copyToClipboard(merkleInfo.merkleRoot)
									}
								>
									<Copy className="h-4 w-4" />
								</Button>
							</div>
							<p className="break-all font-mono text-xs">
								{merkleInfo.merkleRoot}
							</p>
						</div>

						<div className="grid gap-4 md:grid-cols-2">
							<div className="rounded-lg border p-4">
								<p className="mb-1 text-muted-foreground text-sm">
									Votes Included
								</p>
								<p className="font-bold text-2xl">
									{merkleInfo.voteCount?.toLocaleString() ?? "N/A"}
								</p>
							</div>
							{treeStats && (
								<div className="rounded-lg border p-4">
									<p className="mb-1 text-muted-foreground text-sm">
										Tree Depth
									</p>
									<p className="font-bold text-2xl">{treeStats.depth} levels</p>
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Tree Statistics */}
			{treeStats && merkleInfo.hasMerkleTree && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<TrendingUp className="h-5 w-5" />
							Tree Statistics
						</CardTitle>
						<CardDescription>
							Technical details about the Merkle tree
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid gap-4 md:grid-cols-3">
							<div className="rounded-lg border p-4">
								<p className="mb-1 text-muted-foreground text-sm">Leaf Nodes</p>
								<p className="font-bold text-xl">
									{treeStats.leafCount.toLocaleString()}
								</p>
								<p className="mt-1 text-muted-foreground text-xs">
									Individual votes
								</p>
							</div>
							<div className="rounded-lg border p-4">
								<p className="mb-1 text-muted-foreground text-sm">
									Total Layers
								</p>
								<p className="font-bold text-xl">{treeStats.layers}</p>
								<p className="mt-1 text-muted-foreground text-xs">
									From leaves to root
								</p>
							</div>
							<div className="rounded-lg border p-4">
								<p className="mb-1 text-muted-foreground text-sm">
									Root Verification
								</p>
								<p className="font-bold text-xl">
									{treeStats.rootMatches ? (
										<Badge variant="default" className="text-base">
											<CheckCircle className="mr-1 h-3 w-3" />
											Valid
										</Badge>
									) : (
										<Badge variant="destructive" className="text-base">
											<AlertCircle className="mr-1 h-3 w-3" />
											Mismatch
										</Badge>
									)}
								</p>
								<p className="mt-1 text-muted-foreground text-xs">
									{treeStats.rootMatches
										? "Root matches stored value"
										: "Root does not match"}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Information Card */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<FileText className="h-5 w-5" />
						How It Works
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div>
						<h4 className="mb-2 font-semibold">What is a Merkle Tree?</h4>
						<p className="text-muted-foreground text-sm">
							A Merkle tree is a cryptographic data structure that allows
							efficient and secure verification of large data sets. Each vote
							hash becomes a leaf in the tree, and hashes are combined in pairs
							up to a single root hash.
						</p>
					</div>

					<div>
						<h4 className="mb-2 font-semibold">Vote Verification</h4>
						<p className="text-muted-foreground text-sm">
							Voters can use their vote hash to generate a Merkle proof, which
							proves their vote was included in the tree without revealing what
							they voted for. The proof is much smaller than the full tree.
						</p>
					</div>

					<div>
						<h4 className="mb-2 font-semibold">Immutability</h4>
						<p className="text-muted-foreground text-sm">
							Once generated, the Merkle tree cannot be regenerated. Any change
							to even a single vote would completely change the root hash,
							making tampering immediately detectable.
						</p>
					</div>

					<div>
						<h4 className="mb-2 font-semibold">When to Generate</h4>
						<p className="text-muted-foreground text-sm">
							Generate the Merkle tree after the election has ended and all
							votes are final. This is typically done before or after finalizing
							results. Voters can then verify their votes were included in the
							official count.
						</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
