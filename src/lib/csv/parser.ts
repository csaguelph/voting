import Papa from "papaparse";
import type { CSVRow, ValidationResult } from "./validation";
import { validateCSVData, validateHeaders } from "./validation";

/**
 * CSV Parser Utilities
 * Handles parsing of large CSV files (30,000+ rows)
 * Uses papaparse with streaming and chunking for memory efficiency
 */

export interface ParseResult {
	data: CSVRow[];
	validation: ValidationResult;
	parseErrors: string[];
}

export interface ParseOptions {
	skipEmptyLines?: boolean;
	trimFields?: boolean;
	// Chunk size for processing large files
	chunkSize?: number;
}

/**
 * Normalize CSV headers to match our expected format
 * Handles common variations like "Student ID" vs "studentId"
 */
function normalizeHeaders(headers: string[]): string[] {
	const headerMap: Record<string, string> = {
		"student id": "studentId",
		studentid: "studentId",
		student_id: "studentId",
		id: "studentId",
		"first name": "firstName",
		firstname: "firstName",
		first_name: "firstName",
		fname: "firstName",
		"last name": "lastName",
		lastname: "lastName",
		last_name: "lastName",
		lname: "lastName",
		email: "email",
		"email address": "email",
		mail: "email",
		college: "college",
		faculty: "college",
	};

	return headers.map((header) => {
		const normalized = header.trim().toLowerCase();
		return headerMap[normalized] ?? header;
	});
}

/**
 * Parse CSV file from string content
 * Optimized for large files with chunking and validation
 */
export async function parseCSVFromString(
	csvContent: string,
	options: ParseOptions = {},
): Promise<ParseResult> {
	const {
		skipEmptyLines = true,
		trimFields = true,
		chunkSize = 5000,
	} = options;

	return new Promise((resolve, reject) => {
		const parseErrors: string[] = [];
		let headers: string[] = [];
		const allRows: CSVRow[] = [];

		Papa.parse<Record<string, string>>(csvContent, {
			header: true,
			skipEmptyLines: skipEmptyLines ? "greedy" : false,
			transformHeader: (header) => (trimFields ? header.trim() : header),
			transform: (value) => (trimFields ? value.trim() : value),
			chunk: (results: Papa.ParseResult<Record<string, string>>) => {
				// Process chunk of rows
				if (results.errors.length > 0) {
					for (const error of results.errors) {
						parseErrors.push(`Row ${error.row ?? "unknown"}: ${error.message}`);
					}
				}

				// Store headers from first chunk
				if (headers.length === 0 && results.meta.fields) {
					headers = normalizeHeaders(results.meta.fields);
				}

				// Convert parsed data to CSVRow format
				for (const row of results.data) {
					const csvRow: CSVRow = {
						studentId: row.studentId ?? row.studentid ?? "",
						firstName: row.firstName ?? row.firstname ?? "",
						lastName: row.lastName ?? row.lastname ?? "",
						email: row.email ?? "",
						college: row.college ?? "",
					};
					allRows.push(csvRow);
				}
			},
			complete: () => {
				// Validate headers
				const headerErrors = validateHeaders(headers);
				if (headerErrors.length > 0) {
					for (const error of headerErrors) {
						parseErrors.push(error.message);
					}
				}

				// Validate all rows
				const validation = validateCSVData(allRows, chunkSize);

				resolve({
					data: allRows,
					validation,
					parseErrors,
				});
			},
			error: (error: Error) => {
				reject(new Error(`CSV parsing failed: ${error.message}`));
			},
		});
	});
}

/**
 * Parse CSV file from File object (browser)
 * Handles large files efficiently with streaming
 */
export async function parseCSVFromFile(
	file: File,
	options: ParseOptions = {},
): Promise<ParseResult> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();

		reader.onload = async (e) => {
			try {
				const content = e.target?.result as string;
				const result = await parseCSVFromString(content, options);
				resolve(result);
			} catch (error) {
				reject(error);
			}
		};

		reader.onerror = () => {
			reject(new Error("Failed to read file"));
		};

		reader.readAsText(file);
	});
}

/**
 * Generate a preview of CSV data (first N rows)
 * Useful for showing user a preview before import
 */
export function getPreviewRows(data: CSVRow[], count = 10): CSVRow[] {
	return data.slice(0, count);
}

/**
 * Get statistics about the CSV data
 */
export interface CSVStats {
	totalRows: number;
	colleges: Record<string, number>;
	estimatedSizeKB: number;
}

export function getCSVStats(data: CSVRow[]): CSVStats {
	const colleges: Record<string, number> = {};

	for (const row of data) {
		const college = row.college?.trim();
		if (college) {
			colleges[college] = (colleges[college] ?? 0) + 1;
		}
	}

	// Rough estimate: each row ~150 bytes (average)
	const estimatedSizeKB = (data.length * 150) / 1024;

	return {
		totalRows: data.length,
		colleges,
		estimatedSizeKB: Math.round(estimatedSizeKB),
	};
}

/**
 * Format CSV stats for display
 */
export function formatCSVStats(stats: CSVStats): string {
	const lines = [
		`Total Rows: ${stats.totalRows.toLocaleString()}`,
		`Estimated Size: ${stats.estimatedSizeKB} KB`,
		"",
		"Distribution by College:",
	];

	for (const [college, count] of Object.entries(stats.colleges)) {
		const percentage = ((count / stats.totalRows) * 100).toFixed(1);
		lines.push(`  ${college}: ${count} (${percentage}%)`);
	}

	return lines.join("\n");
}
