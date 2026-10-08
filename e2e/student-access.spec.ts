import { createBallot, createElection, db, enrollVoter } from "./support/db";
import { expect, test } from "./support/test";

const HOUR = 60 * 60 * 1000;

test.describe("who can vote", () => {
	test("signed-out visitors are sent to sign in", async ({ page }) => {
		const election = await createElection();
		await page.goto(`/vote/${election.id}`);
		await expect(page).toHaveURL(
			`/auth/signin?callbackUrl=/vote/${election.id}`,
		);
		await expect(
			page.getByRole("button", { name: /Sign in with Microsoft/i }),
		).toBeVisible();
	});

	test("a student not on the voters list can't vote", async ({
		page,
		signInAs,
	}) => {
		const election = await createElection();
		await createBallot(election.id, { candidates: ["Alice"] });
		await signInAs("STUDENT");

		await page.goto(`/vote/${election.id}`);
		await expect(
			page.getByRole("heading", { name: "Not Eligible to Vote" }),
		).toBeVisible();
		await expect(
			page.getByText("You are not registered to vote in this election"),
		).toBeVisible();
	});

	for (const [when, times, reason] of [
		[
			"before voting opens",
			{
				startTime: new Date(Date.now() + HOUR),
				endTime: new Date(Date.now() + 2 * HOUR),
			},
			"This election has not started yet",
		],
		[
			"after voting closes",
			{
				startTime: new Date(Date.now() - 2 * HOUR),
				endTime: new Date(Date.now() - HOUR),
			},
			"This election has ended",
		],
	] as const) {
		test(`a registered student can't vote ${when}`, async ({
			page,
			signInAs,
		}) => {
			const election = await createElection(times);
			await createBallot(election.id, { candidates: ["Alice"] });
			const student = await signInAs("STUDENT");
			await enrollVoter(election.id, { email: student.email ?? "" });

			await page.goto(`/vote/${election.id}`);
			await expect(
				page.getByRole("heading", { name: "Not Eligible to Vote" }),
			).toBeVisible();
			await expect(page.getByText(reason)).toBeVisible();
		});
	}

	test("votes submitted after voting closes are refused", async ({
		page,
		signInAs,
	}) => {
		const election = await createElection();
		await createBallot(election.id, {
			title: "President",
			candidates: ["Alice", "Bob"],
		});
		const student = await signInAs("STUDENT");
		await enrollVoter(election.id, { email: student.email ?? "" });

		await page.goto(`/vote/${election.id}`);
		await page
			.getByRole("button", { name: "Add Alice to your rankings" })
			.click();
		await page
			.getByRole("button", { name: "Review all votes before submission" })
			.click();
		await expect(
			page.getByRole("heading", { name: "Review Your Votes" }),
		).toBeVisible();

		// Voting closes while the student is reviewing
		await db.election.update({
			where: { id: election.id },
			data: { endTime: new Date(Date.now() - 1000) },
		});
		await page.getByRole("button", { name: "Submit all votes" }).click();
		await page
			.getByRole("dialog", { name: "Confirm Vote Submission" })
			.getByRole("button", { name: "Confirm & Submit" })
			.click();

		await expect(page.getByText("This election has ended")).toBeVisible();
		await expect(page).toHaveURL(`/vote/${election.id}/review`);
		expect(await db.vote.count({ where: { electionId: election.id } })).toBe(0);
		const voter = await db.eligibleVoter.findFirstOrThrow({
			where: { electionId: election.id },
		});
		expect(voter.hasVoted).toBe(false);
	});

	test("students can't open the admin area", async ({ page, signInAs }) => {
		await signInAs("STUDENT");
		await page.goto("/admin");
		await expect(page).toHaveURL("/dashboard");
		await expect(
			page.getByRole("heading", { name: "Student Dashboard" }),
		).toBeVisible();
	});
});
