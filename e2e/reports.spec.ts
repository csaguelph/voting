import { createBallot, createElection, db, enrollVoter } from "./support/db";
import { expect, expectNoHorizontalScroll, signIn, test } from "./support/test";

test.describe("reports to the CRO", () => {
	test("a student reports their ballot as they submit it, and the CRO resolves it", async ({
		page,
		browser,
		signInAs,
	}) => {
		const election = await createElection();
		await createBallot(election.id, {
			type: "REFERENDUM",
			title: "Transit fee",
		});
		// Unique: the CRO sees reports from every test running in parallel
		const details = `A volunteer stood over me while I voted (${election.id}).`;
		const student = await signInAs("STUDENT");
		await enrollVoter(election.id, {
			email: student.email ?? "",
			firstName: "Rae",
			lastName: "Reporter",
			identityConfirmed: true,
		});

		await page.goto(`/vote/${election.id}`);
		await page
			.getByRole("radio", { name: "Vote YES on this referendum" })
			.check();
		await page
			.getByRole("button", { name: "Review all votes before submission" })
			.click();
		await page.getByRole("button", { name: "Submit all votes" }).click();

		const dialog = page.getByRole("dialog", {
			name: "Confirm Vote Submission",
		});
		await expect(dialog).toContainText("only you may fill out your ballot");
		await dialog
			.getByRole("checkbox", { name: "Report this ballot to the CRO" })
			.check();
		await expect(dialog).toContainText("The CRO will see your name and email");

		// Submitting without a reason points at the missing field
		await dialog.getByRole("button", { name: "Confirm & Submit" }).click();
		await expect(dialog.getByText("Choose what happened.")).toBeVisible();
		const reason = dialog.getByRole("combobox", { name: "What happened?" });
		await expect(reason).toBeFocused();

		await reason.selectOption({
			label: "Someone pressured or watched me",
		});
		await dialog
			.getByRole("textbox", { name: /Tell the CRO more/ })
			.fill(details);
		await dialog.getByRole("button", { name: "Confirm & Submit" }).click();

		await expect(
			page.getByRole("heading", { name: "Vote Submitted Successfully!" }),
		).toBeVisible();
		await expect(
			page.getByText("You reported this ballot to the Chief Returning Officer"),
		).toBeVisible();
		expect(
			await db.voterReport.findFirstOrThrow({
				where: { electionId: election.id },
			}),
		).toMatchObject({
			reason: "PRESSURED",
			details,
			source: "SUBMISSION",
			voterName: "Rae Reporter",
		});

		// The CRO sees it and marks it resolved
		const croContext = await browser.newContext();
		const cro = await croContext.newPage();
		try {
			await signIn(croContext, "CRO");
			await cro.goto("/admin");
			await cro.getByRole("link", { name: "Reports" }).first().click();
			await expect(cro).toHaveURL("/admin/reports");
			const card = cro.getByRole("listitem").filter({ hasText: details });
			await expect(card).toContainText("Rae Reporter");
			await expect(card).toContainText("When submitting their ballot");
			await card.getByRole("button", { name: "Mark Resolved" }).click();
			await expect(card).toBeHidden();

			await cro.getByRole("link", { name: "Resolved" }).click();
			await expect(cro).toHaveURL("/admin/reports?status=resolved");
			await expect(
				cro.getByRole("listitem").filter({ hasText: details }),
			).toContainText("Resolved");
		} finally {
			await croContext.close();
		}
	});

	test("a student who didn't vote reports it from the 'already voted' page", async ({
		page,
		signInAs,
	}) => {
		const election = await createElection();
		await createBallot(election.id, { candidates: ["Alice", "Bob"] });
		const student = await signInAs("STUDENT");
		await enrollVoter(election.id, {
			email: student.email ?? "",
			hasVoted: true,
		});

		await page.goto(`/vote/${election.id}`);
		await expect(
			page.getByText("You have already voted in this election"),
		).toBeVisible();
		await page.getByRole("link", { name: "Report it to the CRO…" }).click();
		await expect(
			page.getByRole("heading", { name: "Report a Problem to the CRO" }),
		).toBeVisible();
		await expect(
			page.getByRole("combobox", { name: "What happened?" }),
		).toHaveValue("SOMEONE_ELSE_VOTED");
		await expectNoHorizontalScroll(page);

		await page.getByRole("button", { name: "Send Report" }).click();
		const sent = page.getByRole("heading", { name: "Report Sent" });
		await expect(sent).toBeVisible();
		await expect(sent).toBeFocused();
		await expect(page.getByText(student.email ?? "")).toBeVisible();
		expect(
			await db.voterReport.findFirstOrThrow({
				where: { electionId: election.id },
			}),
		).toMatchObject({ reason: "SOMEONE_ELSE_VOTED", source: "ALREADY_VOTED" });
	});

	test("admins who aren't the CRO can't see reports", async ({
		page,
		signInAs,
	}) => {
		await signInAs("ADMIN");
		await page.goto("/admin");
		await expect(page.getByRole("link", { name: "Reports" })).toHaveCount(0);
		await page.goto("/admin/reports");
		await expect(page).toHaveURL("/dashboard");
	});
});
