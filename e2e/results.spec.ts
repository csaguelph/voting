import type { Page } from "@playwright/test";
import {
	createBallot,
	createElection,
	db,
	enrollVoter,
	ranked,
	seedVotes,
} from "./support/db";
import { redis } from "./support/redis";
import { expect, signIn, test } from "./support/test";

const closeVoting = (electionId: string) =>
	db.election.update({
		where: { id: electionId },
		data: { endTime: new Date(Date.now() - 1000) },
	});

/** Confirm one of the results page's alert-dialog actions */
async function confirmAction(page: Page, label: string) {
	await page.getByRole("button", { name: label }).first().click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", { name: label })
		.click();
}

test("closing out an election, from the last vote to public results", async ({
	browser,
}) => {
	const election = await createElection();
	const president = await createBallot(election.id, {
		title: "President",
		candidates: ["Alice", "Bob", "Carol"],
	});
	const [alice, bob, carol] = president.candidates.map((c) => c.id) as [
		string,
		string,
		string,
	];
	const referendum = await createBallot(election.id, {
		type: "REFERENDUM",
		title: "Transit fee",
		order: 1,
	});

	// One student votes through the app and keeps their receipt
	const studentContext = await browser.newContext();
	const student = await studentContext.newPage();
	const studentUser = await signIn(studentContext, "STUDENT");
	await enrollVoter(election.id, { email: studentUser.email ?? "" });
	await student.goto(`/vote/${election.id}`);
	await student
		.getByRole("button", { name: "Add Alice to your rankings" })
		.click();
	await student.getByRole("button", { name: "Go to next ballot" }).click();
	await student
		.getByRole("radio", { name: "Vote YES on this referendum" })
		.check();
	await student
		.getByRole("button", { name: "Review all votes before submission" })
		.click();
	await student.getByRole("button", { name: "Submit all votes" }).click();
	await student.getByRole("button", { name: "Confirm & Submit" }).click();
	await expect(
		student.getByRole("heading", { name: "Vote Submitted Successfully!" }),
	).toBeVisible();
	const receiptHash = (
		await db.vote.findFirstOrThrow({ where: { ballotId: president.id } })
	).voteHash;

	// Everyone else's ballots. First choices: Alice 3, Bob 2, Carol 1, so
	// Carol is excluded and her vote moves to Alice, who wins 4 to 2.
	await seedVotes(
		election.id,
		president.id,
		ranked([alice, bob], [alice], [bob], [bob, alice], [carol, alice]),
	);
	await seedVotes(election.id, referendum.id, [
		{ type: "YES" },
		{ type: "NO" },
		{ type: "ABSTAIN" },
	]);

	// Nothing is public while voting is open
	const publicContext = await browser.newContext();
	const visitor = await publicContext.newPage();
	await visitor.goto(`/results/${election.id}`);
	await expect(
		visitor.getByRole("heading", { name: "Results Not Available" }),
	).toBeVisible();
	await expect(visitor.getByText("Alice")).toHaveCount(0);

	await closeVoting(election.id);

	// The CRO publishes the Merkle root; an admin can't
	const adminContext = await browser.newContext();
	const admin = await adminContext.newPage();
	await signIn(adminContext, "ADMIN");
	await admin.goto(`/admin/${election.id}/proof`);
	await expect(admin).toHaveURL("/dashboard");

	const croContext = await browser.newContext();
	const cro = await croContext.newPage();
	await signIn(croContext, "CRO");
	await cro.goto(`/admin/${election.id}/proof`);
	await cro.getByRole("button", { name: "Generate Merkle Tree" }).click();
	await expect(
		cro.getByText("Merkle tree generated successfully!"),
	).toBeVisible();
	const { merkleRoot } = await db.election.findUniqueOrThrow({
		where: { id: election.id },
	});
	expect(merkleRoot).toBeTruthy();
	await expect(cro.getByText(merkleRoot ?? "")).toBeVisible();

	// An admin finalizes and publishes
	await admin.goto(`/admin/${election.id}/results`);
	const presidentResults = admin.getByRole("row", { name: /Alice/ });
	await expect(presidentResults).toContainText("Winner");
	await confirmAction(admin, "Finalize Results");
	await expect(admin.getByText("Results finalized successfully")).toBeVisible();
	await confirmAction(admin, "Publish Results");
	await expect(admin.getByText("Results published successfully")).toBeVisible();
	await expect
		.poll(async () =>
			db.election.findUniqueOrThrow({
				where: { id: election.id },
				select: { isFinalized: true, isPublished: true },
			}),
		)
		.toEqual({ isFinalized: true, isPublished: true });

	// The public sees the outcome, with charts
	await visitor.reload();
	await expect(
		visitor.getByRole("heading", { name: election.name }),
	).toBeVisible();
	await expect(visitor.getByRole("row", { name: /Alice/ })).toContainText(
		"Winner",
	);
	// Served through the Redis cache, which finalizing and publishing
	// invalidated so the public never sees the pre-publication results
	expect(
		Number(await redis("GET", `election-results-version:${election.id}`)),
	).toBeGreaterThanOrEqual(2);
	expect(
		await redis("KEYS", `election-results:${election.id}:*`),
	).not.toHaveLength(0);
	await visitor.getByRole("button", { name: "Show Charts" }).click();
	await expect(visitor.locator(".recharts-wrapper").first()).toBeVisible();

	// The student proves their vote is in the published tree
	await student.goto("/verify/proof");
	await student.getByRole("combobox", { name: "Election" }).click();
	await student
		.getByRole("option", { name: new RegExp(`^${election.name}`) })
		.click();
	await student.getByLabel("Vote Hash").fill(receiptHash);
	await student.getByRole("button", { name: "Generate Proof" }).click();
	await expect(student.getByText(merkleRoot ?? "")).toBeVisible();
	await student.getByRole("button", { name: "Verify This Proof" }).click();
	await expect(student.getByText("Proof Valid")).toBeVisible();

	for (const context of [
		studentContext,
		publicContext,
		adminContext,
		croContext,
	]) {
		await context.close();
	}
});
