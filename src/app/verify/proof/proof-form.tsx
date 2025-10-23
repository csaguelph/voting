"use client";

import {
	AlertCircle,
	CheckCircle,
	FileText,
	Loader2,
	Search,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";

export function ProofVerificationForm() {
	const searchParams = useSearchParams();
	const [electionId, setElectionId] = useState("");
	const [voteHash, setVoteHash] = useState("");
	const [proof, setProof] = useState<{
		leaf: string;
		proof: string[];
		root: string;
		position: "left" | "right";
		positions: number[];
	} | null>(null);
	const [verificationResult, setVerificationResult] = useState<{
		valid: boolean;
		message: string;
	} | null>(null);
	const [isGenerating, setIsGenerating] = useState(false);

	const utils = api.useUtils();

	// Fetch recent elections with Merkle trees
	const { data: recentElections, isLoading: loadingElections } =
		api.proof.getRecentElections.useQuery();

	// Pre-fill from URL parameters
	useEffect(() => {
		const electionIdParam = searchParams.get("electionId");
		const voteHashParam = searchParams.get("voteHash");

		if (electionIdParam) setElectionId(electionIdParam);
		if (voteHashParam) setVoteHash(voteHashParam);

		// Auto-generate proof if both params are present
		if (electionIdParam && voteHashParam) {
			void handleGenerateProofWithParams(electionIdParam, voteHashParam);
		}
	}, [searchParams]);

	const handleGenerateProofWithParams = async (
		electionIdParam: string,
		voteHashParam: string,
	) => {
		setIsGenerating(true);
		setProof(null);
		setVerificationResult(null);

		try {
			const result = await utils.proof.generateProof.fetch({
				electionId: electionIdParam,
				voteHash: voteHashParam,
			});

			setProof(result.proof);

			const verification = await utils.proof.verifyProof.fetch({
				proof: result.proof,
			});

			setVerificationResult(verification);
		} catch (error) {
			console.error("Error generating proof:", error);
			setVerificationResult({
				valid: false,
				message:
					error instanceof Error ? error.message : "Failed to generate proof",
			});
		} finally {
			setIsGenerating(false);
		}
	};

	const handleGenerateProof = async () => {
		if (!electionId || !voteHash) return;

		setIsGenerating(true);
		setProof(null);
		setVerificationResult(null);

		try {
			const result = await utils.proof.generateProof.fetch({
				electionId,
				voteHash,
			});

			setProof(result.proof);

			// Automatically verify the proof
			const verification = await utils.proof.verifyProof.fetch({
				proof: result.proof,
			});

			setVerificationResult(verification);
		} catch (error) {
			console.error("Error generating proof:", error);
			setVerificationResult({
				valid: false,
				message:
					error instanceof Error ? error.message : "Failed to generate proof",
			});
		} finally {
			setIsGenerating(false);
		}
	};

	const handleVerifyProof = async () => {
		if (!proof) return;

		setIsGenerating(true);
		try {
			const result = await utils.proof.verifyProof.fetch({ proof });
			setVerificationResult(result);
		} catch (error) {
			console.error("Error verifying proof:", error);
			setVerificationResult({
				valid: false,
				message: "Failed to verify proof",
			});
		} finally {
			setIsGenerating(false);
		}
	};

	const handleClear = () => {
		setElectionId("");
		setVoteHash("");
		setProof(null);
		setVerificationResult(null);
	};

	return (
		<>
			{/* Input Form */}
			<Card className="mb-8">
				<CardHeader>
					<CardTitle>Generate Proof</CardTitle>
					<CardDescription>
						Select an election and enter your vote hash to generate a Merkle
						proof
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="election-select">Election</Label>
						{loadingElections ? (
							<div className="flex items-center gap-2 text-muted-foreground text-sm">
								<Loader2 className="h-4 w-4 animate-spin" />
								Loading elections...
							</div>
						) : recentElections && recentElections.length > 0 ? (
							<>
								<Select value={electionId} onValueChange={setElectionId}>
									<SelectTrigger id="election-select">
										<SelectValue placeholder="Select an election" />
									</SelectTrigger>
									<SelectContent>
										{recentElections.map((election) => (
											<SelectItem key={election.id} value={election.id}>
												{election.name} (
												{new Date(election.endTime).toLocaleDateString()})
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<p className="text-muted-foreground text-xs">
									Showing elections from the past year with Merkle trees
								</p>
							</>
						) : (
							<Alert>
								<AlertCircle className="h-4 w-4" />
								<AlertDescription>
									No elections with Merkle trees found in the past year. Merkle
									trees are generated by election administrators after voting
									closes.
								</AlertDescription>
							</Alert>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="vote-hash">Vote Hash</Label>
						<Input
							id="vote-hash"
							placeholder="Enter your vote hash"
							value={voteHash}
							onChange={(e) => setVoteHash(e.target.value)}
							className="font-mono"
						/>
						<p className="text-muted-foreground text-xs">
							You can find your vote hash in your voting receipt
						</p>
					</div>

					<div className="flex gap-2">
						<Button
							onClick={handleGenerateProof}
							disabled={!electionId || !voteHash || isGenerating}
							className="flex-1"
						>
							{isGenerating ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Generating...
								</>
							) : (
								<>
									<Search className="mr-2 h-4 w-4" />
									Generate Proof
								</>
							)}
						</Button>
						{(electionId || voteHash || proof) && (
							<Button onClick={handleClear} variant="outline">
								Clear
							</Button>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Proof Display */}
			{proof && (
				<Card className="mb-8">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<FileText className="h-5 w-5" />
							Merkle Proof
						</CardTitle>
						<CardDescription>
							Cryptographic proof path for your vote
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<Label className="mb-2 block">Merkle Root</Label>
							<div className="rounded-lg border bg-muted/50 p-3">
								<p className="break-all font-mono text-xs">{proof.root}</p>
							</div>
						</div>

						<div>
							<Label className="mb-2 block">Your Vote Hash (Leaf)</Label>
							<div className="rounded-lg border bg-muted/50 p-3">
								<p className="break-all font-mono text-xs">{proof.leaf}</p>
							</div>
						</div>

						<div>
							<Label className="mb-2 block">
								Proof Path ({proof.proof.length} hashes)
							</Label>
							<Textarea
								value={proof.proof.join("\n")}
								readOnly
								rows={Math.min(proof.proof.length, 10)}
								className="font-mono text-xs"
							/>
						</div>

						<Button onClick={handleVerifyProof} className="w-full">
							<CheckCircle className="mr-2 h-4 w-4" />
							Verify This Proof
						</Button>
					</CardContent>
				</Card>
			)}

			{/* Verification Result */}
			{verificationResult && (
				<Card
					className={`mb-8 ${
						verificationResult.valid
							? "border-green-200 bg-green-50"
							: "border-red-200 bg-red-50"
					}`}
				>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							{verificationResult.valid ? (
								<>
									<CheckCircle className="h-5 w-5 text-green-600" />
									Proof Valid
								</>
							) : (
								<>
									<AlertCircle className="h-5 w-5 text-red-600" />
									Proof Invalid
								</>
							)}
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm">{verificationResult.message}</p>
						{verificationResult.valid && (
							<p className="mt-2 text-sm">
								This mathematically proves your vote was included in the
								election's Merkle tree and counted in the final results.
							</p>
						)}
					</CardContent>
				</Card>
			)}
		</>
	);
}
