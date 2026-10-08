import { formatInAppTz } from "@/lib/datetime";
import type {
	BallotResult,
	CandidateResult,
	ElectionResults,
	ReferendumResult,
} from "./calculator";

/**
 * Quote a value for a CSV cell. Embedded quotes are doubled, and values that a
 * spreadsheet would treat as a formula are prefixed with an apostrophe.
 */
function csvField(value: string): string {
	const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
	return `"${safe.replaceAll('"', '""')}"`;
}

/**
 * One line per tie on a ballot: how it was resolved, or that it's waiting
 * for the CRO to decide by lot
 */
export function describeTieBreaks(ballot: BallotResult): string[] {
	const name = (id: string) =>
		ballot.candidates?.find((c) => c.candidateId === id)?.name ?? "Unknown";
	const names = (ids: string[]) => ids.map(name).join(", ");
	const where = (round: number) =>
		round > 0 ? `in round ${round}` : "for the last seat";

	const lines = (ballot.tieBreaks ?? []).map((t) => {
		const reason =
			t.method === "LOT"
				? "decided by lot"
				: t.method === "FIRST_CHOICES"
					? "more first-choice votes"
					: `fewer votes in round ${t.decidedByRound}`;
		const outcome =
			t.kind === "EXCLUSION"
				? `${names(t.selectedCandidateIds)} excluded`
				: `${names(t.selectedCandidateIds)} seated`;
		return `Tie ${where(t.round)} between ${names(t.candidateIds)}: ${outcome} (${reason})`;
	});
	const pending = ballot.pendingTieBreak;
	if (pending) {
		lines.push(
			`Tie ${where(pending.round)} between ${names(pending.candidateIds)}: to be decided by lot`,
		);
	}
	return lines;
}

/**
 * Format results as CSV string for export
 */
export function formatResultsAsCSV(results: ElectionResults): string {
	const lines: string[] = [];

	// Header
	lines.push("# Election Results");
	lines.push(`# Election: ${results.electionName}`);
	lines.push(`# Total Eligible Voters: ${results.totalEligibleVoters}`);
	lines.push(`# Total Voted: ${results.totalVoted}`);
	lines.push(`# Turnout: ${results.turnoutPercentage}%`);
	lines.push(
		`# Finalized: ${results.isFinalized ? "Yes" : "No"}${results.finalizedAt ? ` on ${results.finalizedAt.toISOString()}` : ""}`,
	);
	lines.push(
		`# Published: ${results.isPublished ? "Yes" : "No"}${results.publishedAt ? ` on ${results.publishedAt.toISOString()}` : ""}`,
	);
	lines.push("");

	// For each ballot
	for (const ballot of results.ballots) {
		lines.push(`# Ballot: ${ballot.ballotTitle} (${ballot.ballotType})`);
		if (ballot.college) {
			lines.push(`# College: ${ballot.college}`);
		}
		lines.push(
			`# Total Votes: ${ballot.totalCountedVotes ?? ballot.totalVotes}`,
		);
		for (const tie of describeTieBreaks(ballot)) {
			lines.push(`# ${tie}`);
		}
		lines.push("");

		if (ballot.ballotType === "REFERENDUM" && ballot.referendum) {
			// Referendum format
			lines.push("Option,Votes,Percentage");
			lines.push(
				`YES,${ballot.referendum.yes},${ballot.referendum.yesPercentage}%`,
			);
			lines.push(
				`NO,${ballot.referendum.no},${ballot.referendum.noPercentage}%`,
			);
			lines.push(
				`Result,${ballot.referendum.passed ? "PASSED" : "FAILED"}${ballot.referendum.isTied ? " (TIED)" : ""}`,
			);
		} else if (ballot.candidates) {
			// Candidate ballot format
			const isMultiSeat = (ballot.seatsAvailable ?? 1) > 1;
			const useScore =
				isMultiSeat && ballot.candidates.some((c) => c.score !== undefined);

			if (useScore) {
				lines.push("Candidate,Score,Votes,Percentage,Status");
				for (const candidate of ballot.candidates) {
					const dq =
						candidate.status === "WITHDRAWN" ||
						candidate.status === "DISQUALIFIED";
					const status = dq
						? candidate.status === "WITHDRAWN"
							? "WITHDRAWN"
							: "DISQUALIFIED"
						: candidate.isWinner
							? candidate.isTied
								? "TIED"
								: "WINNER"
							: candidate.isTied
								? "TIED"
								: "";
					lines.push(
						`${csvField(candidate.name)},${dq ? "" : (candidate.score ?? 0)},${dq ? "" : candidate.votes},${dq ? "" : `${candidate.percentage}%`},${status}`,
					);
				}
				lines.push(`# Seats Available: ${ballot.seatsAvailable}`);
				const eligibleCandidateCount = ballot.candidates.filter(
					(c) => c.status === "ACTIVE" || !c.status,
				).length;
				lines.push(
					`# Scoring: 1st choice = ${eligibleCandidateCount} pts, 2nd = ${eligibleCandidateCount - 1} pts, etc.`,
				);
			} else {
				lines.push("Candidate,Votes,Percentage,Status");
				for (const candidate of ballot.candidates) {
					const dq =
						candidate.status === "WITHDRAWN" ||
						candidate.status === "DISQUALIFIED";
					const status = dq
						? candidate.status === "WITHDRAWN"
							? "WITHDRAWN"
							: "DISQUALIFIED"
						: candidate.isWinner
							? candidate.isTied
								? "TIED"
								: "WINNER"
							: candidate.isTied
								? "TIED"
								: "";
					lines.push(
						`${csvField(candidate.name)},${dq ? "" : candidate.votes},${dq ? "" : `${candidate.percentage}%`},${status}`,
					);
				}
			}
		}

		lines.push("");
		lines.push("");
	}

	// Comment lines include user-entered names; a line break inside one would
	// start a new row a spreadsheet could read as a formula
	return lines
		.map((line) =>
			line.startsWith("#") ? line.replace(/[\r\n]+/g, " ") : line,
		)
		.join("\n");
}

/**
 * Format results as JSON for export
 */
export function formatResultsAsJSON(results: ElectionResults): string {
	return JSON.stringify(results, null, 2);
}

/**
 * Format a single ballot result for display
 */
export function formatBallotSummary(ballot: BallotResult): string {
	if (ballot.ballotType === "REFERENDUM" && ballot.referendum) {
		const ref = ballot.referendum;
		return `${ballot.ballotTitle}: ${ref.passed ? "PASSED" : "FAILED"} (YES: ${ref.yes}, NO: ${ref.no})${ref.isTied ? " - TIED" : ""}`;
	}

	if (ballot.candidates && ballot.candidates.length > 0) {
		if (ballot.pendingTieBreak) {
			const tied = ballot.candidates
				.filter((c) =>
					ballot.pendingTieBreak?.candidateIds.includes(c.candidateId),
				)
				.map((c) => c.name)
				.join(", ");
			return `${ballot.ballotTitle}: TIE - to be decided by lot between ${tied}`;
		}
		const winners = ballot.candidates.filter((c) => c.isWinner);
		if (ballot.seatsAvailable > 1 && winners.length > 0) {
			return `${ballot.ballotTitle}: Elected ${winners.map((w) => w.name).join(", ")}`;
		}
		if (winners.length === 0) {
			return `${ballot.ballotTitle}: No votes cast`;
		}
		if (winners.length === 1 && winners[0]) {
			return `${ballot.ballotTitle}: ${winners[0].name} (${winners[0].votes} votes, ${winners[0].percentage}%)`;
		}
		// Multiple winners (tie)
		const winnerNames = winners.map((w) => w.name).join(", ");
		const firstWinner = winners[0];
		return `${ballot.ballotTitle}: TIE - ${winnerNames} (${firstWinner?.votes ?? 0} votes each)`;
	}

	return `${ballot.ballotTitle}: No results`;
}

/**
 * Format candidate result for display
 */
export function formatCandidateResult(candidate: CandidateResult): string {
	let status = "";
	if (candidate.isWinner) {
		status = candidate.isTied ? " (TIED)" : " (WINNER)";
	}
	return `${candidate.name}: ${candidate.votes} votes (${candidate.percentage}%)${status}`;
}

/**
 * Format referendum result for display
 */
export function formatReferendumResult(referendum: ReferendumResult): string {
	const result = referendum.passed
		? "PASSED"
		: referendum.isTied
			? "TIED"
			: "FAILED";
	return `YES: ${referendum.yes} (${referendum.yesPercentage}%), NO: ${referendum.no} (${referendum.noPercentage}%) - ${result}`;
}

/**
 * Format turnout statistics for display
 */
export function formatTurnoutStats(results: ElectionResults): string {
	return `${results.totalVoted} / ${results.totalEligibleVoters} voters (${results.turnoutPercentage}%)`;
}

/**
 * Generate a downloadable filename for results export
 */
export function generateResultsFilename(
	electionName: string,
	format: "csv" | "json",
): string {
	// Sanitize election name for filename
	const sanitized = electionName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	const timestamp = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
	return `election-results-${sanitized}-${timestamp}.${format}`;
}

/**
 * Format date for display (America/Toronto)
 */
export function formatDate(date: Date | null | undefined): string {
	if (!date) return "Not set";
	return formatInAppTz(new Date(date), {
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

/**
 * Create a summary report text
 */
export function createSummaryReport(results: ElectionResults): string {
	const lines: string[] = [];

	lines.push("=".repeat(60));
	lines.push(`ELECTION RESULTS: ${results.electionName}`);
	lines.push("=".repeat(60));
	lines.push("");

	// Overall statistics
	lines.push("OVERALL STATISTICS");
	lines.push("-".repeat(60));
	lines.push(`Total Eligible Voters: ${results.totalEligibleVoters}`);
	lines.push(`Total Voted: ${results.totalVoted}`);
	lines.push(`Turnout: ${results.turnoutPercentage}%`);
	lines.push(`Status: ${results.isFinalized ? "Finalized" : "Not Finalized"}`);
	if (results.finalizedAt) {
		lines.push(`Finalized At: ${formatDate(results.finalizedAt)}`);
	}
	if (results.isPublished) {
		lines.push(`Published At: ${formatDate(results.publishedAt)}`);
	}
	lines.push("");

	// Ballot results
	for (const ballot of results.ballots) {
		lines.push("=".repeat(60));
		lines.push(
			`${ballot.ballotTitle} (${ballot.ballotType}${ballot.college ? ` - ${ballot.college}` : ""})`,
		);
		lines.push("=".repeat(60));
		lines.push(`Total Votes: ${ballot.totalCountedVotes ?? ballot.totalVotes}`);
		for (const tie of describeTieBreaks(ballot)) {
			lines.push(tie);
		}
		lines.push("");

		if (ballot.ballotType === "REFERENDUM" && ballot.referendum) {
			const ref = ballot.referendum;
			lines.push("REFERENDUM RESULTS:");
			lines.push(`  YES: ${ref.yes} votes (${ref.yesPercentage}%)`);
			lines.push(`  NO:  ${ref.no} votes (${ref.noPercentage}%)`);
			lines.push("");
			lines.push(
				`  Result: ${ref.passed ? "PASSED" : "FAILED"}${ref.isTied ? " (TIED)" : ""}`,
			);
		} else if (ballot.candidates) {
			const isMultiSeat = (ballot.seatsAvailable ?? 1) > 1;
			const useScore =
				isMultiSeat && ballot.candidates.some((c) => c.score !== undefined);

			if (useScore) {
				lines.push(
					`CANDIDATE RESULTS (${ballot.seatsAvailable} seats available):`,
				);
				const eligibleForScoring = ballot.candidates.filter(
					(c) => c.status === "ACTIVE" || !c.status,
				).length;
				for (const candidate of ballot.candidates) {
					const dq =
						candidate.status === "WITHDRAWN" ||
						candidate.status === "DISQUALIFIED";
					const statusMarker = dq
						? ` [${candidate.status}]`
						: candidate.isWinner
							? candidate.isTied
								? " 🔸 TIED"
								: " 👑 WINNER"
							: candidate.isTied
								? " 🔸 TIED (to be decided by lot)"
								: "";
					const voteLine = dq
						? `  ${candidate.name}${statusMarker}`
						: `  ${candidate.name}: ${candidate.score ?? 0} points (${candidate.votes} first-choice votes, ${candidate.percentage}%)${statusMarker}`;
					lines.push(voteLine);
				}
				lines.push("");
				lines.push(
					`  Scoring: 1st choice = ${eligibleForScoring} pts, 2nd = ${eligibleForScoring - 1} pts, etc.`,
				);
			} else {
				lines.push("CANDIDATE RESULTS:");
				for (const candidate of ballot.candidates) {
					const dq =
						candidate.status === "WITHDRAWN" ||
						candidate.status === "DISQUALIFIED";
					const statusMarker = dq
						? ` [${candidate.status}]`
						: candidate.isWinner
							? candidate.isTied
								? " 🔸 TIED"
								: " 👑 WINNER"
							: candidate.isTied
								? " 🔸 TIED (to be decided by lot)"
								: "";
					const voteLine = dq
						? `  ${candidate.name}${statusMarker}`
						: `  ${candidate.name}: ${candidate.votes} votes (${candidate.percentage}%)${statusMarker}`;
					lines.push(voteLine);
				}
			}

			// Add ranked choice details if available
			if (ballot.rankedChoiceDetails) {
				lines.push("");
				lines.push("RANKED CHOICE VOTING DETAILS:");
				lines.push("-".repeat(60));

				// Display round-by-round elimination
				for (const round of ballot.rankedChoiceDetails.rounds) {
					lines.push(`Round ${round.round}:`);

					// Show vote counts for active candidates
					const sortedCandidates = Object.entries(round.voteCounts).sort(
						([, a], [, b]) => b - a,
					);

					for (const [candidateId, votes] of sortedCandidates) {
						const candidate = ballot.candidates.find(
							(c) => c.candidateId === candidateId,
						);
						const name = candidate?.name ?? "Unknown";
						lines.push(`  ${name}: ${votes} votes`);
					}

					if (round.eliminated) {
						const eliminatedCandidate = ballot.candidates.find(
							(c) => c.candidateId === round.eliminated,
						);
						lines.push(
							`  ❌ Eliminated: ${eliminatedCandidate?.name ?? "Unknown"}`,
						);
					}
					lines.push("");
				}

				// Add description
				if (ballot.rankedChoiceDetails.description.length > 0) {
					lines.push("Summary:");
					for (const line of ballot.rankedChoiceDetails.description) {
						lines.push(`  ${line}`);
					}
				}
			}
		}

		lines.push("");
	}

	lines.push("=".repeat(60));
	lines.push(`Generated: ${formatInAppTz(new Date())}`);
	lines.push("=".repeat(60));

	return lines.join("\n");
}
