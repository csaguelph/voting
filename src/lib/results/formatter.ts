import type {
	BallotResult,
	CandidateResult,
	ElectionResults,
	ReferendumResult,
} from "./calculator";

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
		lines.push(`# Total Votes: ${ballot.totalVotes}`);
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
			lines.push("Candidate,Votes,Percentage,Status");
			for (const candidate of ballot.candidates) {
				const status = candidate.isWinner
					? candidate.isTied
						? "TIED"
						: "WINNER"
					: "";
				lines.push(
					`"${candidate.name}",${candidate.votes},${candidate.percentage}%,${status}`,
				);
			}
		}

		lines.push("");
		lines.push("");
	}

	return lines.join("\n");
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
		const winners = ballot.candidates.filter((c) => c.isWinner);
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
 * Format date for display
 */
export function formatDate(date: Date | null | undefined): string {
	if (!date) return "Not set";
	return new Date(date).toLocaleDateString("en-US", {
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
		lines.push(`Total Votes: ${ballot.totalVotes}`);
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
			lines.push("CANDIDATE RESULTS:");
			for (const candidate of ballot.candidates) {
				const statusMarker = candidate.isWinner
					? candidate.isTied
						? " 🔸 TIED"
						: " 👑 WINNER"
					: "";
				lines.push(
					`  ${candidate.name}: ${candidate.votes} votes (${candidate.percentage}%)${statusMarker}`,
				);
			}
		}

		lines.push("");
	}

	lines.push("=".repeat(60));
	lines.push(
		`Generated: ${new Date().toLocaleString("en-US", { timeZone: "America/Toronto" })}`,
	);
	lines.push("=".repeat(60));

	return lines.join("\n");
}
