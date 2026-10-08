import { writeFile } from "node:fs/promises";
import { db, uniqueId } from "./support/db";
import { expect, signIn, test } from "./support/test";

/** A date as YYYY-MM-DD in the app's time zone, for date inputs */
function torontoDate(offsetDays: number) {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "America/Toronto",
	}).format(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000));
}

test("an admin sets up an election that students can vote in", async ({
	page,
	browser,
	signInAs,
}, testInfo) => {
	const name = `E2E Setup ${uniqueId()}`;
	await signInAs("ADMIN");

	// Create an election that is open from midnight today until tomorrow
	await page.goto("/admin");
	// The header button (an empty list shows a second one)
	await page.getByRole("button", { name: "Create Election" }).first().click();
	const createDialog = page.getByRole("dialog", {
		name: "Create New Election",
	});
	await createDialog.getByLabel("Election Name").fill(name);
	await createDialog.getByLabel("Description").fill("Set up by an E2E test");
	await createDialog.getByLabel("Start Date").fill(torontoDate(0));
	await createDialog.getByLabel("Start Time").fill("00:00");
	await createDialog.getByLabel("End Date").fill(torontoDate(1));
	await createDialog.getByLabel("End Time").fill("23:59");
	await createDialog.getByRole("button", { name: "Create Election" }).click();
	await expect(createDialog).toBeHidden();

	const election = await db.election.findFirstOrThrow({ where: { name } });
	await page.locator(`a[href="/admin/${election.id}"]`).click();
	await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
	await expect(page.getByText("Set up by an E2E test")).toBeVisible();
	// It's open now, so the page starts on live monitoring
	await expect(
		page.getByRole("tab", { name: "Live Monitoring", selected: true }),
	).toBeVisible();

	// Ballots and candidates
	await page.getByRole("tab", { name: "Overview" }).click();
	await page.getByRole("link", { name: "Manage Ballots" }).click();
	await expect(
		page.getByRole("heading", { name: "Ballot Management" }),
	).toBeVisible();

	await page.getByRole("button", { name: "Create Ballot" }).click();
	const ballotDialog = page.getByRole("dialog", { name: "Create New Ballot" });
	await ballotDialog.getByLabel("Title").fill("President");
	await ballotDialog.getByRole("combobox", { name: "Ballot Type" }).click();
	await page
		.getByRole("option", { name: "Executive (University-wide)" })
		.click();
	await ballotDialog.getByRole("button", { name: "Create Ballot" }).click();
	await expect(ballotDialog).toBeHidden();

	for (const candidate of ["Alice", "Bob"]) {
		await page.getByRole("button", { name: "Add Candidate" }).click();
		const candidateDialog = page.getByRole("dialog");
		await candidateDialog.getByLabel("Candidate Name").fill(candidate);
		await candidateDialog
			.getByRole("button", { name: "Add Candidate" })
			.click();
		await expect(candidateDialog).toBeHidden();
		await expect(
			page.getByRole("button", { name: `Edit ${candidate}` }),
		).toBeVisible();
	}

	await page.getByRole("button", { name: "Create Ballot" }).click();
	await ballotDialog.getByRole("combobox", { name: "Ballot Type" }).click();
	await page
		.getByRole("option", { name: "Referendum (Yes/No Question)" })
		.click();
	await ballotDialog.getByLabel("Title").fill("Transit fee");
	await ballotDialog
		.getByLabel("Question")
		.fill("Do you support the transit fee?");
	await ballotDialog.getByRole("button", { name: "Create Ballot" }).click();
	await expect(ballotDialog).toBeHidden();
	await expect(page.getByText("Transit fee", { exact: true })).toBeVisible();

	// Import the voters list
	const studentEmail = `voter-${uniqueId()}@uoguelph.ca`;
	const csv = testInfo.outputPath("voters.csv");
	await writeFile(
		csv,
		[
			"studentId,firstName,lastName,email,college",
			`1234567,Vera,Voter,${studentEmail},COE`,
			`7654321,Otto,Other,other-${uniqueId()}@uoguelph.ca,CBS`,
		].join("\n"),
	);
	await page.goto(`/admin/${election.id}/voters`);
	await page.locator('input[type="file"]').setInputFiles(csv);
	await page.getByRole("button", { name: "Import 2 Voters" }).click();
	await expect
		.poll(() => db.eligibleVoter.count({ where: { electionId: election.id } }))
		.toBe(2);

	// The student on the list can now vote
	const studentContext = await browser.newContext();
	const studentPage = await studentContext.newPage();
	try {
		await signIn(studentContext, "STUDENT", studentEmail);
		await studentPage.goto(`/vote/${election.id}`);
		await expect(studentPage.getByText("Welcome, Vera Voter")).toBeVisible();
		await studentPage
			.getByRole("button", { name: "Add Bob to your rankings" })
			.click();
		await studentPage
			.getByRole("button", { name: "Go to next ballot" })
			.click();
		await studentPage
			.getByRole("radio", { name: "Vote NO on this referendum" })
			.check();
		await studentPage
			.getByRole("button", { name: "Review all votes before submission" })
			.click();
		await studentPage.getByRole("button", { name: "Submit all votes" }).click();
		await studentPage.getByRole("button", { name: "Confirm & Submit" }).click();
		await expect(
			studentPage.getByRole("heading", {
				name: "Vote Submitted Successfully!",
			}),
		).toBeVisible();
	} finally {
		await studentContext.close();
	}

	// The admin sees the turnout
	await page.goto(`/admin/${election.id}`);
	await expect(page.getByText("1 / 2", { exact: true })).toBeVisible();
	await expect(page.getByText("1 of 2 voters")).toBeVisible();
});
