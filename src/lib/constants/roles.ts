/**
 * User roles in the voting system
 */
export const USER_ROLES = {
	STUDENT: "STUDENT",
	ADMIN: "ADMIN",
	CRO: "CRO", // Chief Returning Officer
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
