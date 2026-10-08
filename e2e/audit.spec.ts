import { readFile } from "node:fs/promises";
import { createElection, db, uniqueId } from "./support/db";
import { expect, test } from "./support/test";

test("an admin filters the audit log and exports it", async ({
	page,
	signInAs,
}) => {
	const election = await createElection();
	const other = await createElection();
	const actor = `returning-officer-${uniqueId()}@uoguelph.ca`;
	const entries: Array<[electionId: string, action: string, title: string]> = [
		[election.id, "ballot.created", "President"],
		[election.id, "candidate.added", "Alice"],
		[election.id, "candidate.added", "Bob"],
		[other.id, "ballot.created", "Elsewhere"],
	];
	for (const [electionId, action, title] of entries) {
		await db.auditLog.create({
			data: {
				electionId,
				action,
				details: { performedByEmail: actor, title },
			},
		});
	}
	await signInAs("ADMIN");

	await page.goto("/admin/audit");
	await page.getByRole("combobox", { name: "Election" }).click();
	await page.getByRole("option", { name: election.name }).click();
	const rows = page.getByRole("row").filter({ hasText: election.name });
	await expect(rows).toHaveCount(3);
	await expect(
		page.getByRole("row").filter({ hasText: other.name }),
	).toHaveCount(0);
	await expect(rows.first()).toContainText(actor);

	await page.getByRole("combobox", { name: "Action Type" }).click();
	await page.getByRole("option", { name: "Candidate Added" }).click();
	await expect(rows).toHaveCount(2);

	// The export follows the filters
	const downloading = page.waitForEvent("download");
	await page.getByRole("button", { name: "Export CSV" }).click();
	const download = await downloading;
	expect(download.suggestedFilename()).toMatch(/\.csv$/);
	const csv = await readFile(await download.path(), "utf8");
	const lines = csv.trim().split("\n");
	expect(lines).toHaveLength(3);
	expect(lines.slice(1).every((line) => line.includes("candidate.added"))).toBe(
		true,
	);
	expect(csv).toContain(election.name);
	expect(csv).not.toContain(other.name);

	await page.getByRole("button", { name: "Clear Filters" }).click();
	await expect(page.getByRole("combobox", { name: "Election" })).toHaveText(
		"All elections",
	);
	await expect(page.getByRole("combobox", { name: "Action Type" })).toHaveText(
		"All actions",
	);
});
