import { COLLEGES } from "@/lib/constants/colleges";

/**
 * CSV Validation Utilities
 * Handles validation of CSV data for voter imports
 * Designed to handle large files (30,000+ rows)
 */

export interface CSVRow {
	studentId: string;
	firstName: string;
	lastName: string;
	email: string;
	college: string;
}

export interface ValidationError {
	row: number;
	field: string;
	message: string;
	value?: string;
}

export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
	warnings: ValidationError[];
	rowCount: number;
}

/**
 * Required columns in the CSV file
 */
const REQUIRED_COLUMNS = [
	"studentId",
	"firstName",
	"lastName",
	"email",
	"college",
] as const;

/**
 * Validate CSV headers
 */
export function validateHeaders(headers: string[]): ValidationError[] {
	const errors: ValidationError[] = [];
	const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());

	for (const required of REQUIRED_COLUMNS) {
		const normalized = required.toLowerCase();
		if (!normalizedHeaders.includes(normalized)) {
			errors.push({
				row: 0,
				field: "headers",
				message: `Missing required column: ${required}`,
			});
		}
	}

	return errors;
}

/**
 * Validate a single email address
 */
function validateEmail(email: string): boolean {
	// Basic email validation
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

/**
 * Validate a student ID
 * Assumes student IDs are numeric and 7-10 digits
 */
function validateStudentId(studentId: string): boolean {
	const trimmed = studentId.trim();
	// Check if it's numeric and reasonable length
	return /^\d{7,10}$/.test(trimmed);
}

/**
 * Validate college name
 */
function validateCollege(college: string): boolean {
	const trimmed = college.trim();
	// Check if it matches any college name (case-insensitive)
	return COLLEGES.some((c) => c.toLowerCase() === trimmed.toLowerCase());
}

/**
 * Validate a single CSV row
 */
export function validateRow(row: CSVRow, rowNumber: number): ValidationError[] {
	const errors: ValidationError[] = [];

	// Check required fields are not empty
	if (!row.studentId?.trim()) {
		errors.push({
			row: rowNumber,
			field: "studentId",
			message: "Student ID is required",
			value: row.studentId,
		});
	} else if (!validateStudentId(row.studentId)) {
		errors.push({
			row: rowNumber,
			field: "studentId",
			message: "Student ID must be 7-10 digits",
			value: row.studentId,
		});
	}

	if (!row.firstName?.trim()) {
		errors.push({
			row: rowNumber,
			field: "firstName",
			message: "First name is required",
			value: row.firstName,
		});
	}

	if (!row.lastName?.trim()) {
		errors.push({
			row: rowNumber,
			field: "lastName",
			message: "Last name is required",
			value: row.lastName,
		});
	}

	if (!row.email?.trim()) {
		errors.push({
			row: rowNumber,
			field: "email",
			message: "Email is required",
			value: row.email,
		});
	} else if (!validateEmail(row.email)) {
		errors.push({
			row: rowNumber,
			field: "email",
			message: "Invalid email format",
			value: row.email,
		});
	}

	if (!row.college?.trim()) {
		errors.push({
			row: rowNumber,
			field: "college",
			message: "College is required",
			value: row.college,
		});
	} else if (!validateCollege(row.college)) {
		errors.push({
			row: rowNumber,
			field: "college",
			message: `Invalid college. Must be one of: ${COLLEGES.join(", ")}`,
			value: row.college,
		});
	}

	return errors;
}

/**
 * Check for duplicate student IDs or emails within the CSV
 * Optimized for large datasets using Maps for O(1) lookups
 */
export function checkDuplicates(rows: CSVRow[]): ValidationError[] {
	const errors: ValidationError[] = [];
	const studentIds = new Map<string, number>();
	const emails = new Map<string, number>();

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		if (!row) continue;

		const studentId = row.studentId?.trim();
		const email = row.email?.trim().toLowerCase();

		// Check for duplicate student IDs
		if (studentId) {
			const firstOccurrence = studentIds.get(studentId);
			if (firstOccurrence !== undefined) {
				errors.push({
					row: i + 2, // +2 because row 0 is headers, and we're 0-indexed
					field: "studentId",
					message: `Duplicate student ID (first seen on row ${firstOccurrence + 2})`,
					value: studentId,
				});
			} else {
				studentIds.set(studentId, i);
			}
		}

		// Check for duplicate emails
		if (email) {
			const firstOccurrence = emails.get(email);
			if (firstOccurrence !== undefined) {
				errors.push({
					row: i + 2,
					field: "email",
					message: `Duplicate email (first seen on row ${firstOccurrence + 2})`,
					value: email,
				});
			} else {
				emails.set(email, i);
			}
		}
	}

	return errors;
}

/**
 * Validate the entire CSV data
 * Uses batching for large datasets to avoid memory issues
 */
export function validateCSVData(
	rows: CSVRow[],
	batchSize = 1000,
): ValidationResult {
	const errors: ValidationError[] = [];
	const warnings: ValidationError[] = [];

	// Validate each row in batches
	for (let i = 0; i < rows.length; i += batchSize) {
		const batch = rows.slice(i, i + batchSize);
		for (let j = 0; j < batch.length; j++) {
			const row = batch[j];
			if (!row) continue;
			const rowNumber = i + j + 2; // +2 for header row and 0-indexing
			const rowErrors = validateRow(row, rowNumber);
			errors.push(...rowErrors);
		}
	}

	// Check for duplicates within the CSV
	const duplicateErrors = checkDuplicates(rows);
	errors.push(...duplicateErrors);

	return {
		valid: errors.length === 0,
		errors,
		warnings,
		rowCount: rows.length,
	};
}

/**
 * Get a summary of validation results
 */
export function getValidationSummary(result: ValidationResult): string {
	if (result.valid) {
		return `✅ All ${result.rowCount} rows are valid`;
	}

	const errorsByField = new Map<string, number>();
	for (const error of result.errors) {
		errorsByField.set(error.field, (errorsByField.get(error.field) ?? 0) + 1);
	}

	const summary = [
		`❌ Found ${result.errors.length} errors in ${result.rowCount} rows:`,
	];
	for (const [field, count] of errorsByField) {
		summary.push(`  - ${field}: ${count} errors`);
	}

	return summary.join("\n");
}
