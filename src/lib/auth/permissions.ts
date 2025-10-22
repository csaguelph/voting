import type { Session } from "next-auth";
import { redirect } from "next/navigation";

import { auth } from "@/server/auth";

/**
 * Check if user has required role
 */
export function hasRole(
	session: Session | null,
	role: "STUDENT" | "ADMIN" | "CRO",
): boolean {
	if (!session?.user) return false;
	return session.user.role === role;
}

/**
 * Check if user is admin or CRO
 */
export function isAdminOrCRO(session: Session | null): boolean {
	if (!session?.user) return false;
	return session.user.role === "ADMIN" || session.user.role === "CRO";
}

/**
 * Require authentication - redirect to sign in if not authenticated
 */
export async function requireAuth() {
	const session = await auth();
	if (!session) {
		redirect("/auth/signin");
	}
	return session;
}

/**
 * Require admin role - redirect to dashboard if not admin
 */
export async function requireAdmin() {
	const session = await requireAuth();
	if (session.user.role !== "ADMIN" && session.user.role !== "CRO") {
		redirect("/dashboard");
	}
	return session;
}

/**
 * Require CRO role - redirect to dashboard if not CRO
 */
export async function requireCRO() {
	const session = await requireAuth();
	if (session.user.role !== "CRO") {
		redirect("/dashboard");
	}
	return session;
}
