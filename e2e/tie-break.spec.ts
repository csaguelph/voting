import {
	createBallot,
	createElection,
	db,
	enrollVoter,
	ranked,
	seedVotes,
} from "./support/db";
import { expect, signIn, test } from "./support/test";

const HOUR = 60 * 60 * 1000;

test("the CRO breaks a tie by lot before results are finalized", async ({
	browser,
}) => {
	const election = await createElection({
		startTime: new Date(Date.now() - 2 * HOUR),
		endTime: new Date(Date.now() - HOUR),
	});
	const ballot = await createBallot(election.id, {
		title: "President",
		candidates: ["Ada", "Grace"],
	});
	const [ada, grace] = ballot.candidates.map((c) => c.id) as [string, string];
	// Tied at every count, so only a draw can separate them
	await seedVotes(election.id, ballot.id, ranked([ada], [grace]));
	for (const n of [1, 2]) {
		await enrollVoter(election.id, {
			email: `tie-voter-${n}-${election.id}@uoguelph.ca`,
			hasVoted: true,
		});
	}

	// An admin sees the tie but can't decide it
	const adminContext = await browser.newContext();
	const admin = await adminContext.newPage();
	await signIn(adminContext, "ADMIN");
	await admin.goto(`/admin/${election.id}/results`);
	await expect(admin.getByText("Tie to be decided by lot")).toBeVisible();
	await expect(
		admin.getByText("Only the CRO can record the draw."),
	).toBeVisible();
	await expect(
		admin.getByRole("button", { name: "Record draw result…" }),
	).toHaveCount(0);

	const croContext = await browser.newContext();
	const cro = await croContext.newPage();
	const croUser = await signIn(croContext, "CRO");
	await cro.goto(`/admin/${election.id}/results`);

	// Results can't be finalized while the tie is undecided
	await cro.getByRole("button", { name: "Finalize Results" }).first().click();
	await cro
		.getByRole("alertdialog")
		.getByRole("button", { name: "Finalize Results" })
		.click();
	await expect(
		cro.getByText(/must be decided by lot before results can be finalized/),
	).toBeVisible();

	// The CRO records the draw: Grace was drawn for exclusion
	await cro.getByRole("button", { name: "Record draw result…" }).click();
	const dialog = cro.getByRole("dialog", {
		name: "Record draw result: President",
	});
	const record = dialog.getByRole("button", { name: "Record draw result" });
	await expect(record).toBeDisabled();
	await dialog
		.getByRole("group", { name: "Which candidate did the draw exclude?" })
		.getByLabel("Grace")
		.check();
	await record.click();
	await expect(cro.getByText("Draw recorded")).toBeVisible();
	await expect(dialog).toBeHidden();
	await expect(cro.getByText("Tie to be decided by lot")).toHaveCount(0);
	await expect(cro.getByRole("row", { name: /Ada/ })).toContainText("Winner");
	await expect(cro.getByText("How ties were broken")).toBeVisible();

	const draw = await db.tieBreakDraw.findFirstOrThrow({
		where: { ballotId: ballot.id },
	});
	expect(draw).toMatchObject({
		kind: "EXCLUSION",
		selectedCandidateIds: [grace],
		decidedById: croUser.id,
	});
	expect(
		await db.auditLog.count({
			where: { electionId: election.id, action: "results.tie_break_drawn" },
		}),
	).toBe(1);

	// Now it can be finalized and published, with the draw explained publicly
	await cro.getByRole("button", { name: "Finalize Results" }).first().click();
	await cro
		.getByRole("alertdialog")
		.getByRole("button", { name: "Finalize Results" })
		.click();
	await expect(cro.getByText("Results finalized successfully")).toBeVisible();
	await cro.getByRole("button", { name: "Publish Results" }).first().click();
	await cro
		.getByRole("alertdialog")
		.getByRole("button", { name: "Publish Results" })
		.click();
	await expect(cro.getByText("Results published successfully")).toBeVisible();

	const visitor = await (await browser.newContext()).newPage();
	await visitor.goto(`/results/${election.id}`);
	await expect(visitor.getByText("How ties were broken")).toBeVisible();
	await expect(
		visitor.getByText(
			"Tie in round 1 between Ada, Grace: Grace excluded (decided by lot)",
		),
	).toBeVisible();
	await expect(visitor.getByRole("row", { name: /Ada/ })).toContainText(
		"Winner",
	);

	await adminContext.close();
	await croContext.close();
	await visitor.context().close();
});
