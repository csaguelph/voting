import AxeBuilder from "@axe-core/playwright";
import {
	type BrowserContext,
	test as base,
	expect,
	type Page,
} from "@playwright/test";
import type { UserRole } from "@prisma/client";
import { createSession, createUser } from "./db";
import { E2E_BASE_URL } from "./env";

type SignedInUser = Awaited<ReturnType<typeof createUser>>;

/**
 * Sign a browser context in as a new user with the given role. NextAuth uses
 * database sessions, so this inserts a session and sets its cookie, exactly
 * as a Microsoft sign-in would.
 */
export async function signIn(
	context: BrowserContext,
	role: UserRole,
	email?: string,
): Promise<SignedInUser> {
	const user = await createUser(role, email);
	const token = await createSession(user.id);
	await context.addCookies([
		{
			name: "authjs.session-token",
			value: token,
			url: E2E_BASE_URL,
			httpOnly: true,
			sameSite: "Lax",
		},
	]);
	return user;
}

export const test = base.extend<{
	/** Sign the page's browser context in as a new user with the given role */
	signInAs: (role: UserRole, email?: string) => Promise<SignedInUser>;
}>({
	signInAs: async ({ context }, use) => {
		await use((role, email) => signIn(context, role, email));
	},
});

export { expect };

/** Run axe on the current page and fail on any WCAG A/AA violation */
export async function expectNoAxeViolations(page: Page) {
	// Colours mid-transition would be measured wrongly
	await page.waitForFunction(() =>
		document.getAnimations().every((a) => a.playState !== "running"),
	);
	const results = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
		.analyze();
	expect(
		results.violations.map((v) => ({
			id: v.id,
			impact: v.impact,
			help: v.help,
			targets: v.nodes.map((n) => n.target.join(" ")),
		})),
	).toEqual([]);
}

/** The page fits the viewport's width, with no sideways scrolling */
export async function expectNoHorizontalScroll(page: Page) {
	const overflow = await page.evaluate(
		() =>
			document.documentElement.scrollWidth -
			document.documentElement.clientWidth,
	);
	expect(overflow, "page scrolls horizontally").toBeLessThanOrEqual(0);
}
