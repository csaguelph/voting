"use client";

import { AlertCircle, Check, FileText, Upload, X } from "lucide-react";
import { type ChangeEvent, type DragEvent, useCallback, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	type ParseResult,
	formatCSVStats,
	getCSVStats,
	getPreviewRows,
	parseCSVFromFile,
} from "@/lib/csv/parser";
import { getValidationSummary } from "@/lib/csv/validation";
import { api } from "@/trpc/react";

interface CSVUploadProps {
	electionId: string;
	onUploadComplete?: () => void;
}

/**
 * CSV Upload Component
 * Handles large CSV files (30,000+ rows) with:
 * - Drag and drop interface
 * - File validation and preview
 * - Progress indication
 * - Error handling
 */
export function CSVUpload({ electionId, onUploadComplete }: CSVUploadProps) {
	const [file, setFile] = useState<File | null>(null);
	const [parseResult, setParseResult] = useState<ParseResult | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [uploadStatus, setUploadStatus] = useState<
		"idle" | "success" | "error"
	>("idle");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const importVotersMutation = api.admin.importVoters.useMutation({
		onSuccess: (data) => {
			setUploadProgress(100);
			setUploadStatus("success");
			setErrorMessage(null);
			onUploadComplete?.();
		},
		onError: (error) => {
			setUploadStatus("error");
			setErrorMessage(error.message);
			setUploadProgress(0);
		},
	});

	// Handle file selection
	const handleFileChange = useCallback(async (selectedFile: File) => {
		setFile(selectedFile);
		setParseResult(null);
		setIsProcessing(true);
		setUploadStatus("idle");
		setErrorMessage(null);
		setUploadProgress(0);

		try {
			// Parse and validate CSV
			const result = await parseCSVFromFile(selectedFile);
			setParseResult(result);
			setIsProcessing(false);

			if (!result.validation.valid) {
				setUploadStatus("error");
				setErrorMessage("CSV validation failed. Please fix the errors below.");
			}
		} catch (error) {
			setIsProcessing(false);
			setUploadStatus("error");
			setErrorMessage(
				error instanceof Error ? error.message : "Failed to parse CSV",
			);
		}
	}, []);

	// File input change handler
	const onFileSelect = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			const selectedFile = e.target.files?.[0];
			if (selectedFile) {
				handleFileChange(selectedFile);
			}
		},
		[handleFileChange],
	);

	// Drag and drop handlers
	const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragging(true);
	}, []);

	const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragging(false);
	}, []);

	const onDrop = useCallback(
		(e: DragEvent<HTMLDivElement>) => {
			e.preventDefault();
			setIsDragging(false);

			const droppedFile = e.dataTransfer.files[0];
			if (droppedFile && droppedFile.type === "text/csv") {
				handleFileChange(droppedFile);
			} else {
				setErrorMessage("Please upload a CSV file");
			}
		},
		[handleFileChange],
	);

	// Import voters
	const handleImport = useCallback(async () => {
		if (!parseResult || !parseResult.validation.valid) {
			return;
		}

		setUploadProgress(10);
		setUploadStatus("idle");

		try {
			await importVotersMutation.mutateAsync({
				electionId,
				voters: parseResult.data,
				replaceExisting: false,
			});
		} catch (error) {
			// Error handled by mutation callbacks
		}
	}, [parseResult, electionId, importVotersMutation]);

	// Clear selection
	const handleClear = useCallback(() => {
		setFile(null);
		setParseResult(null);
		setUploadStatus("idle");
		setErrorMessage(null);
		setUploadProgress(0);
	}, []);

	const previewRows = parseResult ? getPreviewRows(parseResult.data, 10) : [];
	const stats = parseResult ? getCSVStats(parseResult.data) : null;

	return (
		<div className="space-y-6">
			{/* Upload Area */}
			<Card>
				<CardHeader>
					<CardTitle>Import Eligible Voters</CardTitle>
					<CardDescription>
						Upload a CSV file with voter information. Supports large files
						(30,000+ rows). Required columns: studentId, firstName, lastName,
						email, college
					</CardDescription>
				</CardHeader>
				<CardContent>
					{!file ? (
						<div
							className={`rounded-lg border-2 border-dashed p-12 text-center transition-colors${isDragging ? "border-primary bg-primary/10" : "border-slate-300 dark:border-slate-700"}
							`}
							onDragOver={onDragOver}
							onDragLeave={onDragLeave}
							onDrop={onDrop}
						>
							<Upload className="mx-auto mb-4 h-12 w-12 text-slate-400" />
							<p className="mb-2 font-medium text-slate-900 text-sm dark:text-slate-50">
								Drop CSV file here or click to browse
							</p>
							<p className="mb-4 text-slate-500 text-xs dark:text-slate-400">
								Supports files up to 10MB
							</p>
							<input
								type="file"
								accept=".csv"
								onChange={onFileSelect}
								className="hidden"
								id="csv-upload"
							/>
							<Button asChild variant="outline">
								<label htmlFor="csv-upload" className="cursor-pointer">
									<FileText className="mr-2 h-4 w-4" />
									Select File
								</label>
							</Button>
						</div>
					) : (
						<div className="space-y-4">
							{/* File Info */}
							<div className="flex items-center justify-between rounded-lg bg-slate-100 p-4 dark:bg-slate-800">
								<div className="flex items-center gap-3">
									<FileText className="h-8 w-8 text-primary" />
									<div>
										<p className="font-medium text-slate-900 dark:text-slate-50">
											{file.name}
										</p>
										<p className="text-slate-500 text-sm dark:text-slate-400">
											{(file.size / 1024).toFixed(1)} KB
										</p>
									</div>
								</div>
								<Button variant="ghost" size="sm" onClick={handleClear}>
									<X className="h-4 w-4" />
								</Button>
							</div>

							{/* Processing Indicator */}
							{isProcessing && (
								<div className="space-y-2">
									<p className="text-slate-600 text-sm dark:text-slate-300">
										Processing CSV file...
									</p>
									<Progress value={50} className="w-full" />
								</div>
							)}

							{/* Upload Progress */}
							{uploadProgress > 0 && uploadProgress < 100 && (
								<div className="space-y-2">
									<p className="text-slate-600 text-sm dark:text-slate-300">
										Uploading voters to database...
									</p>
									<Progress value={uploadProgress} className="w-full" />
								</div>
							)}

							{/* Errors */}
							{errorMessage && (
								<Alert variant="destructive">
									<AlertCircle className="h-4 w-4" />
									<AlertDescription>{errorMessage}</AlertDescription>
								</Alert>
							)}

							{/* Validation Results */}
							{parseResult && !isProcessing && (
								<div className="space-y-4">
									{parseResult.validation.valid ? (
										<Alert>
											<Check className="h-4 w-4" />
											<AlertDescription>
												{getValidationSummary(parseResult.validation)}
											</AlertDescription>
										</Alert>
									) : (
										<Alert variant="destructive">
											<AlertCircle className="h-4 w-4" />
											<AlertDescription>
												<div className="space-y-1">
													<p className="font-medium">
														{getValidationSummary(parseResult.validation)}
													</p>
													<div className="mt-2 max-h-40 overflow-y-auto text-xs">
														{parseResult.validation.errors
															.slice(0, 20)
															.map((error) => (
																<div
																	key={`${error.row}-${error.field}`}
																	className="py-1"
																>
																	Row {error.row}: {error.field} -{" "}
																	{error.message}
																</div>
															))}
														{parseResult.validation.errors.length > 20 && (
															<p className="py-1 font-medium">
																... and{" "}
																{parseResult.validation.errors.length - 20} more
																errors
															</p>
														)}
													</div>
												</div>
											</AlertDescription>
										</Alert>
									)}

									{/* Stats */}
									{stats && (
										<div className="rounded-lg bg-slate-100 p-4 dark:bg-slate-800">
											<pre className="text-slate-700 text-xs dark:text-slate-300">
												{formatCSVStats(stats)}
											</pre>
										</div>
									)}

									{/* Preview Table */}
									{previewRows.length > 0 && (
										<div>
											<h4 className="mb-2 font-medium text-slate-900 text-sm dark:text-slate-50">
												Preview (first 10 rows)
											</h4>
											<div className="rounded-lg border">
												<Table>
													<TableHeader>
														<TableRow>
															<TableHead>Student ID</TableHead>
															<TableHead>Name</TableHead>
															<TableHead>Email</TableHead>
															<TableHead>College</TableHead>
														</TableRow>
													</TableHeader>
													<TableBody>
														{previewRows.map((row) => (
															<TableRow key={row.studentId}>
																<TableCell className="font-mono text-sm">
																	{row.studentId}
																</TableCell>
																<TableCell>
																	{row.firstName} {row.lastName}
																</TableCell>
																<TableCell className="text-sm">
																	{row.email}
																</TableCell>
																<TableCell>{row.college}</TableCell>
															</TableRow>
														))}
													</TableBody>
												</Table>
											</div>
										</div>
									)}

									{/* Import Button */}
									{parseResult.validation.valid &&
										uploadStatus !== "success" && (
											<Button
												onClick={handleImport}
												disabled={importVotersMutation.isPending}
												className="w-full"
											>
												{importVotersMutation.isPending
													? "Importing..."
													: `Import ${stats?.totalRows.toLocaleString()} Voters`}
											</Button>
										)}

									{/* Success Message */}
									{uploadStatus === "success" && (
										<Alert>
											<Check className="h-4 w-4" />
											<AlertDescription>
												Successfully imported{" "}
												{stats?.totalRows.toLocaleString()} voters!
											</AlertDescription>
										</Alert>
									)}
								</div>
							)}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
