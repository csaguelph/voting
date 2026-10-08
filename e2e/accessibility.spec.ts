import type { Locator, Page } from "@playwright/test";
import {
	createBallot,
	createElection,
	enrollVoter,
	ranked,
	seedVotes,
} from "./support/db";
import {
	confirmStudentId,
	expect,
	expectNoAxeViolations,
	signIn,
	test,
} from "./support/test";

const HOUR = 60 * 60 * 1000;

/** A closed election with published results */
async function publishedElection() {
	const election = await createElection({
		startTime: new Date(Date.now() - 2 * HOUR),
		endTime: new Date(Date.now() - HOUR),
		isFinalized: true,
		isPublished: true,
	});
	const ballot = await createBallot(election.id, {
		title: "President",
		candidates: ["Ada", "Grace"],
	});
	const [ada, grace] = ballot.candidates.map((c) => c.id) as [string, string];
	await seedVotes(election.id, ballot.id, ranked([ada], [ada], [grace]));
	const referendum = await createBallot(election.id, {
		type: "REFERENDUM",
		title: "Transit fee",
		order: 1,
	});
	await seedVotes(election.id, referendum.id, [
		{ type: "YES" },
		{ type: "YES" },
		{ type: "NO" },
	]);
	for (const n of [1, 2, 3]) {
		await enrollVoter(election.id, {
			email: `a11y-${n}-${election.id}@uoguelph.ca`,
			hasVoted: true,
		});
	}
	return election;
}

/** A level-1 heading, so a scan proves the intended page loaded */
const h1 = (name: string) => (page: Page) =>
	page.getByRole("heading", { name, level: 1, exact: true });

/**
 * Open a page, check it's the page asked for (not a redirect or an error
 * state), then scan it
 */
async function scan(page: Page, path: string, loaded: (page: Page) => Locator) {
	await page.goto(path);
	await expect(page).toHaveURL(path);
	await expect(loaded(page)).toBeVisible();
	await page.waitForLoadState("networkidle");
	await expectNoAxeViolations(page);
}

test.describe("accessibility (WCAG 2.2 A/AA)", () => {
	test("public pages", async ({ page }) => {
		const election = await publishedElection();
		for (const [path, loaded] of [
			["/", h1("Central Student Association")],
			["/about", h1("Secure, Transparent, Fair")],
			["/verify", h1("Vote Verification Portal")],
			["/verify/proof", h1("Merkle Proof Verification")],
			[
				"/auth/signin",
				(p: Page) =>
					p.getByRole("button", { name: /Sign in with Microsoft 365/ }),
			],
			[`/results/${election.id}`, h1(election.name)],
		] as const) {
			await test.step(path, () => scan(page, path, loaded));
		}
		await test.step("results with charts", async () => {
			await page.getByRole("button", { name: "Show Charts" }).click();
			await expect(page.locator(".recharts-wrapper").first()).toBeVisible();
			await expectNoAxeViolations(page);
		});
	});

	test("the voting flow", async ({ page, signInAs }) => {
		const election = await createElection();
		await createBallot(election.id, {
			title: "President",
			candidates: ["Alice", "Bob"],
		});
		await createBallot(election.id, {
			type: "REFERENDUM",
			title: "Transit fee",
			order: 1,
		});
		const student = await signInAs("STUDENT");
		await enrollVoter(election.id, {
			email: student.email ?? "",
			studentId: "1234567",
		});

		await test.step("dashboard", () =>
			scan(page, "/dashboard", h1("Student Dashboard")));
		await test.step("before you vote", async () => {
			await scan(page, `/vote/${election.id}`, h1("Before You Vote"));
			await page.getByRole("textbox", { name: "Student ID" }).fill("1");
			await page.getByRole("button", { name: /^Continue to Ballot/ }).click();
			await expect(page.getByText(/doesn't match this account/)).toBeVisible();
			// Not mid-fade from its disabled (submitting) look, and not hovered
			await expect(
				page.getByRole("button", { name: /^Continue to Ballot/ }),
			).toBeEnabled();
			await page.mouse.move(0, 0);
			await expectNoAxeViolations(page);
		});
		await test.step("ranked ballot", async () => {
			await confirmStudentId(page, "1234567");
			await page.waitForLoadState("networkidle");
			await expectNoAxeViolations(page);
			await page
				.getByRole("button", { name: "Add Alice to your rankings" })
				.click();
			await expectNoAxeViolations(page);
		});
		await test.step("referendum", async () => {
			await page.getByRole("button", { name: "Go to next ballot" }).click();
			await page
				.getByRole("radio", { name: "Vote YES on this referendum" })
				.check();
			await expectNoAxeViolations(page);
		});
		await test.step("review and confirm", async () => {
			await page
				.getByRole("button", { name: "Review all votes before submission" })
				.click();
			await expect(
				page.getByRole("heading", { name: "Review Your Votes" }),
			).toBeVisible();
			await expectNoAxeViolations(page);
			await page.getByRole("button", { name: "Submit all votes" }).click();
			await expect(page.getByRole("dialog")).toBeVisible();
			await expectNoAxeViolations(page);
		});
		await test.step("receipt", async () => {
			await page.getByRole("button", { name: "Confirm & Submit" }).click();
			await expect(
				page.getByRole("heading", { name: "Vote Submitted Successfully!" }),
			).toBeVisible();
			await expectNoAxeViolations(page);
		});
	});

	test("admin pages", async ({ page, context }) => {
		const open = await createElection();
		await createBallot(open.id, {
			title: "President",
			candidates: ["Alice", "Bob"],
		});
		await enrollVoter(open.id, { email: `a11y-voter-${open.id}@uoguelph.ca` });
		const closed = await publishedElection();
		await signIn(context, "CRO");

		for (const [path, loaded] of [
			["/admin", h1("Elections")],
			[`/admin/${open.id}`, h1(open.name)],
			[`/admin/${open.id}/ballots`, h1("Ballot Management")],
			[`/admin/${open.id}/voters`, h1("Voter Management")],
			[`/admin/${closed.id}`, h1(closed.name)],
			[
				`/admin/${closed.id}/results`,
				(p: Page) => p.getByRole("row", { name: /Ada/ }),
			],
			[`/admin/${closed.id}/proof`, h1("Cryptographic Proof Generation")],
			["/admin/audit", h1("Audit Logs")],
			["/admin/settings", h1("Global Settings")],
		] as const) {
			await test.step(path, () => scan(page, path, loaded));
		}
	});
});
