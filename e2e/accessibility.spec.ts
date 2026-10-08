import type { Page } from "@playwright/test";
import {
	createBallot,
	createElection,
	enrollVoter,
	ranked,
	seedVotes,
} from "./support/db";
import { expect, expectNoAxeViolations, signIn, test } from "./support/test";

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

async function scan(page: Page, path: string) {
	await page.goto(path);
	await page.waitForLoadState("networkidle");
	await expectNoAxeViolations(page);
}

test.describe("accessibility (WCAG 2.2 A/AA)", () => {
	test("public pages", async ({ page }) => {
		const election = await publishedElection();
		for (const path of [
			"/",
			"/about",
			"/verify",
			"/verify/proof",
			"/auth/signin",
			`/results/${election.id}`,
		]) {
			await test.step(path, () => scan(page, path));
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
		await enrollVoter(election.id, { email: student.email ?? "" });

		await test.step("dashboard", () => scan(page, "/dashboard"));
		await test.step("ranked ballot", async () => {
			await scan(page, `/vote/${election.id}`);
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

		for (const path of [
			"/admin",
			`/admin/${open.id}`,
			`/admin/${open.id}/ballots`,
			`/admin/${open.id}/voters`,
			`/admin/${closed.id}`,
			`/admin/${closed.id}/results`,
			`/admin/${closed.id}/proof`,
			"/admin/audit",
			"/admin/settings",
		]) {
			await test.step(path, () => scan(page, path));
		}
	});
});
