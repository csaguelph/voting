/**
 * List of colleges for ballot assignment
 */
export const COLLEGES = [
	"Arts",
	"Business",
	"Engineering",
	"Health Sciences",
	"Humanities",
	"Science",
	"Social Science",
] as const;

export type College = (typeof COLLEGES)[number];

/**
 * Validate if a string is a valid college
 */
export function isValidCollege(college: string): college is College {
	return COLLEGES.includes(college as College);
}
