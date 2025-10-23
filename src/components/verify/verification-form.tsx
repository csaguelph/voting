"use client";

import {
	AlertCircle,
	CheckCircle,
	Loader2,
	Search,
	XCircle,
} from "lucide-react";
import { useState } from "react";

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";

interface VerificationResult {
	voteHash: string;
	exists: boolean;
	timestamp?: Date;
	election?: {
		id: string;
		name: string;
	};
	message: string;
	isValid?: boolean; // For integrity verification
}

export function VerificationForm() {
	const [hashInput, setHashInput] = useState("");
	const [studentId, setStudentId] = useState("");
	const [results, setResults] = useState<VerificationResult[] | null>(null);
	const [isSingleHash, setIsSingleHash] = useState(true);
	const [isVerifying, setIsVerifying] = useState(false);
	const [checkIntegrity, setCheckIntegrity] = useState(false);

	const utils = api.useUtils();

	const handleVerify = async () => {
		if (!hashInput.trim()) return;

		// Parse input - could be single hash or multiple hashes (one per line)
		const hashes = hashInput
			.trim()
			.split("\n")
			.map((h) => h.trim())
			.filter((h) => h.length > 0);

		if (hashes.length === 0) return;

		setIsSingleHash(hashes.length === 1);
		setIsVerifying(true);

		try {
			if (hashes.length === 1) {
				// Single hash verification
				const firstHash = hashes[0];
				if (!firstHash) {
					throw new Error("No hash provided");
				}

				// If integrity check is requested and student ID is provided
				if (checkIntegrity && studentId.trim()) {
					const integrityResult = await utils.verify.verifyVoteIntegrity.fetch({
						voteHash: firstHash,
						voterId: studentId.trim(),
					});
					setResults([
						{
							voteHash: firstHash,
							exists: integrityResult.exists,
							message: integrityResult.message,
							isValid: integrityResult.isValid,
							timestamp: integrityResult.timestamp,
							election: integrityResult.election
								? { id: "", name: integrityResult.election }
								: undefined,
						},
					]);
				} else {
					// Basic existence check
					const result = await utils.verify.verifyHash.fetch({
						voteHash: firstHash,
					});
					setResults([
						{
							voteHash: firstHash,
							...result,
						},
					]);
				}
			} else {
				// Batch verification (max 100)
				const batchHashes = hashes.slice(0, 100);
				const result = await utils.verify.verifyBatch.fetch({
					voteHashes: batchHashes,
				});
				setResults(result.results);
			}
		} catch (error) {
			console.error("Verification error:", error);
			const firstHash = hashes[0];
			setResults([
				{
					voteHash: firstHash ?? "unknown",
					exists: false,
					message: "An error occurred during verification",
				},
			]);
		} finally {
			setIsVerifying(false);
		}
	};

	const handleClear = () => {
		setHashInput("");
		setResults(null);
	};

	const isLoading = isVerifying;

	return (
		<div className="space-y-6">
			{/* Input Form */}
			<Card>
				<CardHeader>
					<CardTitle>Enter Vote Hash</CardTitle>
					<CardDescription>
						Paste one or more vote hashes (one per line) to verify them
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="hash-input">Vote Hash(es)</Label>
						<Textarea
							id="hash-input"
							placeholder="Enter your vote hash here...&#10;You can paste multiple hashes, one per line"
							value={hashInput}
							onChange={(e) => setHashInput(e.target.value)}
							rows={6}
							className="font-mono text-sm"
						/>
						<p className="text-muted-foreground text-xs">
							Example: a1b2c3d4e5f6g7h8...
						</p>
					</div>

					{/* Integrity check option */}
					<div className="space-y-3 rounded-lg border bg-muted/50 p-4">
						<div className="flex items-center gap-2">
							<input
								type="checkbox"
								id="check-integrity"
								checked={checkIntegrity}
								onChange={(e) => setCheckIntegrity(e.target.checked)}
								className="h-4 w-4"
							/>
							<Label htmlFor="check-integrity" className="cursor-pointer">
								Verify vote integrity (tamper detection)
							</Label>
						</div>
						{checkIntegrity && (
							<div className="space-y-2">
								<Label htmlFor="student-id" className="text-sm">
									Your Student ID
								</Label>
								<input
									type="text"
									id="student-id"
									placeholder="Enter your student ID"
									value={studentId}
									onChange={(e) => setStudentId(e.target.value)}
									className="w-full rounded-md border px-3 py-2 text-sm"
								/>
								<p className="text-muted-foreground text-xs">
									Required to verify vote integrity. Only you know your student
									ID, ensuring your privacy.
								</p>
							</div>
						)}
					</div>

					<div className="flex gap-2">
						<Button
							onClick={handleVerify}
							disabled={!hashInput.trim() || isLoading}
							className="flex-1"
						>
							{isLoading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Verifying...
								</>
							) : (
								<>
									<Search className="mr-2 h-4 w-4" />
									Verify
								</>
							)}
						</Button>
						{(hashInput || results) && (
							<Button
								onClick={handleClear}
								variant="outline"
								disabled={isLoading}
							>
								Clear
							</Button>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Results */}
			{results && results.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle>Verification Results</CardTitle>
						<CardDescription>
							{results.filter((r) => r.exists).length} of {results.length}{" "}
							hash(es) verified
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{/* Summary for batch verification */}
						{!isSingleHash && (
							<div className="grid gap-4 md:grid-cols-3">
								<div className="rounded-lg border p-4">
									<p className="text-muted-foreground text-sm">Total Hashes</p>
									<p className="font-bold text-2xl">{results.length}</p>
								</div>
								<div className="rounded-lg border p-4">
									<p className="text-muted-foreground text-sm">Verified</p>
									<p className="font-bold text-2xl text-green-600">
										{results.filter((r) => r.exists).length}
									</p>
								</div>
								<div className="rounded-lg border p-4">
									<p className="text-muted-foreground text-sm">Not Found</p>
									<p className="font-bold text-2xl text-red-600">
										{results.filter((r) => !r.exists).length}
									</p>
								</div>
							</div>
						)}

						{/* Individual results */}
						<div className="space-y-3">
							{results.map((result) => (
								<div
									key={result.voteHash}
									className={`rounded-lg border p-4 ${
										result.exists
											? "border-green-200 bg-green-50"
											: "border-red-200 bg-red-50"
									}`}
								>
									<div className="mb-2 flex items-start justify-between gap-2">
										<div className="flex-1">
											<div className="mb-1 flex items-center gap-2">
												{result.exists ? (
													<CheckCircle className="h-5 w-5 text-green-600" />
												) : (
													<XCircle className="h-5 w-5 text-red-600" />
												)}
												<p className="font-semibold">
													{result.exists ? "Vote Verified" : "Not Found"}
												</p>
											</div>
											<p className="break-all font-mono text-muted-foreground text-xs">
												{result.voteHash}
											</p>
											{/* Show integrity status if checked */}
											{result.isValid !== undefined && (
												<div className="mt-2">
													{result.isValid ? (
														<div className="flex items-center gap-2">
															<CheckCircle className="h-4 w-4 text-green-600" />
															<span className="font-medium text-green-700 text-sm">
																Integrity verified - no tampering detected
															</span>
														</div>
													) : (
														<div className="flex items-start gap-2">
															<AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
															<span className="font-medium text-red-700 text-sm">
																{result.message}
															</span>
														</div>
													)}
												</div>
											)}
										</div>
										<Badge
											variant={result.exists ? "default" : "destructive"}
											className="shrink-0"
										>
											{result.exists ? "Valid" : "Invalid"}
										</Badge>
									</div>

									{result.exists && result.election && result.timestamp && (
										<div className="mt-3 space-y-1 border-t pt-3 text-sm">
											<p>
												<span className="font-medium">Election: </span>
												<span className="text-muted-foreground">
													{result.election.name}
												</span>
											</p>
											<p>
												<span className="font-medium">Recorded: </span>
												<span className="text-muted-foreground">
													{new Date(result.timestamp).toLocaleString()}
												</span>
											</p>
										</div>
									)}

									{!result.exists && (
										<Alert className="mt-3">
											<AlertCircle className="h-4 w-4" />
											<AlertDescription className="text-sm">
												{result.message ||
													"This hash was not found in our records. Please verify you copied it correctly."}
											</AlertDescription>
										</Alert>
									)}
								</div>
							))}
						</div>

						{/* Success message for verified votes */}
						{results.some((r) => r.exists) && (
							<Alert>
								<CheckCircle className="h-4 w-4" />
								<AlertDescription>
									Your vote(s) were successfully recorded and will be counted in
									the final tally. Thank you for participating in the election!
								</AlertDescription>
							</Alert>
						)}
					</CardContent>
				</Card>
			)}
		</div>
	);
}
