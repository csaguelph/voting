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
