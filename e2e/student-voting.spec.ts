import { createBallot, createElection, db, enrollVoter } from "./support/db";
import {
	confirmStudentId,
	expect,
	expectNoHorizontalScroll,
	test,
} from "./support/test";

test.describe("a student voting", () => {
	test("votes on every ballot type, gets a receipt and verifies it", async ({
		page,
		signInAs,
	}) => {
		const election = await createElection();
		const president = await createBallot(election.id, {
			title: "President",
			candidates: ["Alice", "Bob", "Carol"],
			order: 0,
		});
		const director = await createBallot(election.id, {
			type: "DIRECTOR",
			title: "COE Director",
			college: "COE",
			seatsAvailable: 2,
			candidates: ["Dan", "Eve", "Fay"],
			order: 1,
		});
		const referendum = await createBallot(election.id, {
			type: "REFERENDUM",
			title: "Transit fee",
			question: "Do you support the transit fee?",
			order: 2,
		});
		// Another college's director ballot is never shown to this voter
		await createBallot(election.id, {
			type: "DIRECTOR",
			title: "CBS Director",
			college: "CBS",
			candidates: ["Gus"],
			order: 3,
		});
		const student = await signInAs("STUDENT");
		await enrollVoter(election.id, {
			email: student.email ?? "",
			college: "COE",
			firstName: "Sam",
			lastName: "Student",
			studentId: "1234567",
		});

		await page.goto("/dashboard");
		await page
			.getByRole("link", { name: "Cast Your Vote" })
			.and(page.locator(`[href="/vote/${election.id}"]`))
			.click();

		// Before the ballot: the campaign rules, then the student ID
		await expect(
			page.getByRole("heading", { name: "Only you can fill out your ballot" }),
		).toBeVisible();
		await expect(page.getByText("Voting as Sam Student")).toBeVisible();
		await expect(
			page.getByRole("link", { name: /csaonline\.ca\/elections-complaint/ }),
		).toHaveAttribute("href", "https://csaonline.ca/elections-complaint");
		const continueButton = page.getByRole("button", {
			name: /^Continue to Ballot/,
		});
		await expect(continueButton).toBeDisabled();
		await expectNoHorizontalScroll(page);
		await page.getByRole("textbox", { name: "Student ID" }).fill("7654321");
		await continueButton.click();
		await expect(
			page.getByText(
				"That student ID doesn't match this account. 4 attempts left.",
			),
		).toBeVisible();
		await confirmStudentId(page, "123 4567");
		await expect(page.getByText("Welcome, Sam Student")).toBeVisible();
		const jumpList = page.getByRole("navigation", {
			name: "Jump to specific ballot",
		});
		await expect(jumpList.getByRole("listitem")).toHaveCount(3);
		await expect(jumpList).not.toContainText("CBS Director");
		await expectNoHorizontalScroll(page);

		// Ranked choice: rank Carol, Alice, Bob, then use the keyboard to move
		// Bob above Alice
		const ballot = page.getByRole("region", { name: "President" }).first();
		for (const name of ["Carol", "Alice", "Bob"]) {
			await ballot
				.getByRole("button", { name: `Add ${name} to your rankings` })
				.click();
		}
		await ballot.getByRole("group", { name: /^3rd choice: Bob/ }).focus();
		await page.keyboard.press("Control+ArrowUp");
		await expect(
			ballot
				.getByRole("list", { name: "Your ranked candidates" })
				.getByRole("listitem"),
		).toHaveText([/Carol/, /Bob/, /Alice/]);
		await expect(
			ballot.getByRole("group", { name: /^2nd choice: Bob/ }),
		).toBeFocused();

		// Multi-seat director ballot: abstain
		await page.getByRole("button", { name: "Go to next ballot" }).click();
		await page
			.getByRole("region", { name: "COE Director" })
			.first()
			.getByRole("button", { name: "Abstain from voting on this ballot" })
			.click();

		// Referendum: YES
		await page.getByRole("button", { name: "Go to next ballot" }).click();
		await expect(
			page.getByText("Do you support the transit fee?"),
		).toBeVisible();
		await page
			.getByRole("radio", { name: "Vote YES on this referendum" })
			.check();
		await expect(page.getByRole("status").first()).toContainText("3 completed");

		await page
			.getByRole("button", { name: "Review all votes before submission" })
			.click();
		await expect(
			page.getByRole("heading", { name: "Review Your Votes" }),
		).toBeVisible();
		const summary = page.getByRole("region", { name: "Vote summary" });
		await expect(summary).toContainText("1. Carol");
		await expect(summary).toContainText("2. Bob");
		await expect(summary).toContainText("3. Alice");
		await expectNoHorizontalScroll(page);

		await page.getByRole("button", { name: "Submit all votes" }).click();
		await page
			.getByRole("dialog", { name: "Confirm Vote Submission" })
			.getByRole("button", { name: "Confirm & Submit" })
			.click();
		await expect(page).toHaveURL(`/vote/${election.id}/receipt`);
		await expect(
			page.getByRole("heading", { name: "Vote Submitted Successfully!" }),
		).toBeVisible();

		await expectNoHorizontalScroll(page);

		// What was recorded matches what the student chose
		const votes = await db.vote.findMany({
			where: { electionId: election.id },
		});
		const voteFor = (ballotId: string) =>
			votes.find((v) => v.ballotId === ballotId)?.voteData;
		const byName = Object.fromEntries(
			president.candidates.map((c) => [c.name, c.id]),
		);
		expect(votes).toHaveLength(3);
		expect(voteFor(president.id)).toEqual({
			type: "RANKED",
			rankings: [byName.Carol, byName.Bob, byName.Alice],
		});
		expect(voteFor(director.id)).toEqual({ type: "ABSTAIN" });
		expect(voteFor(referendum.id)).toEqual({ type: "YES" });
		const voter = await db.eligibleVoter.findFirstOrThrow({
			where: { electionId: election.id, email: student.email ?? "" },
		});
		expect(voter.hasVoted).toBe(true);

		// The receipt lists every vote's hash
		for (const vote of votes) {
			await expect(page.getByText(vote.voteHash)).toBeVisible();
		}

		// The verification portal finds a real hash and rejects a made-up one
		const realHash = votes[0]?.voteHash ?? "";
		const bogusHash = "0".repeat(64);
		await page.getByRole("link", { name: "Verify Your Vote" }).click();
		await expect(page).toHaveURL("/verify");
		await page
			.getByRole("textbox", { name: "Vote Hash(es)" })
			.fill(`${realHash}\n${bogusHash}`);
		await page.getByRole("button", { name: "Verify", exact: true }).click();
		await expect(page.getByText("1 of 2 hash(es) verified")).toBeVisible();
		await expect(page.getByText("Valid", { exact: true })).toHaveCount(1);
		await expect(page.getByText("Invalid", { exact: true })).toHaveCount(1);
		await expect(page.getByText(`Election: ${election.name}`)).toBeVisible();

		// Voting again is refused
		await page.goto(`/vote/${election.id}`);
		await expect(
			page.getByRole("heading", { name: "Not Eligible to Vote" }),
		).toBeVisible();
		await expect(
			page.getByText("You have already voted in this election"),
		).toBeVisible();
	});

	test("too many wrong student IDs lock the ballot", async ({
		page,
		signInAs,
	}) => {
		const election = await createElection();
		await createBallot(election.id, { candidates: ["Alice", "Bob"] });
		const student = await signInAs("STUDENT");
		const voter = await enrollVoter(election.id, {
			email: student.email ?? "",
			studentId: "1234567",
		});
		// One wrong try left
		await db.eligibleVoter.update({
			where: { id: voter.id },
			data: { identityCheckFailures: 4 },
		});

		await page.goto(`/vote/${election.id}`);
		await page.getByRole("textbox", { name: "Student ID" }).fill("7654321");
		await page.getByRole("button", { name: /^Continue to Ballot/ }).click();
		const locked = page.getByRole("alert").filter({
			has: page.getByRole("heading", {
				name: "Ballot locked for your security",
			}),
		});
		await expect(locked).toBeVisible();
		await expect(locked).toBeFocused();
		await expect(page.getByRole("textbox", { name: "Student ID" })).toHaveCount(
			0,
		);

		// Still locked after a reload, and the CRO can see what happened
		await page.reload();
		await expect(locked).toBeVisible();
		expect(
			await db.auditLog.count({
				where: { electionId: election.id, action: "voter.identity_locked" },
			}),
		).toBe(1);
	});
});
