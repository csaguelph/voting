/**
 * List of colleges for ballot assignment
 */
export const COLLEGES = [
	"COA",
	"CBS",
	"Lang",
	"CCMPS",
	"COE",
	"CSAHS",
	"OAC",
	"OVC",
] as const;

export type College = (typeof COLLEGES)[number];

/**
 * Validate if a string is a valid college
 */
export function isValidCollege(college: string): college is College {
	return COLLEGES.includes(college as College);
}

/**
 * Return the canonical COLLEGES entry that matches college case-insensitively,
 * or null if none match. Use for normalizing before storage and lookups.
 */
export function getCanonicalCollege(college: string): string | null {
	const trimmed = college.trim();
	const found = COLLEGES.find((c) => c.toLowerCase() === trimmed.toLowerCase());
	return found ?? null;
}
