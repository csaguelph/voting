"use client";

import { type ReactNode, createContext, useContext, useState } from "react";

interface VoteSelection {
	ballotId: string;
	// For single candidate or referendum: vote is "YES" | "NO" | "ABSTAIN"
	vote?: "YES" | "NO" | "ABSTAIN";
	// For ranked choice (multiple candidates): array of candidate IDs in rank order
	rankings?: string[];
}

interface VotingContextType {
	selections: Map<string, VoteSelection>;
	setRankedChoices: (ballotId: string, rankings: string[]) => void;
	setSingleChoiceAbstain: (
		ballotId: string,
		vote: "YES" | "NO" | "ABSTAIN",
	) => void;
	setReferendumVote: (ballotId: string, vote: "YES" | "NO" | "ABSTAIN") => void;
	clearSelection: (ballotId: string) => void;
	clearAllSelections: () => void;
	hasSelection: (ballotId: string) => boolean;
	getSelection: (ballotId: string) => VoteSelection | undefined;
	getAllSelections: () => VoteSelection[];
}

const VotingContext = createContext<VotingContextType | undefined>(undefined);

export function VotingProvider({ children }: { children: ReactNode }) {
	const [selections, setSelections] = useState<Map<string, VoteSelection>>(
		() => {
			// Initialize from sessionStorage if available
			if (typeof window !== "undefined") {
				const stored = sessionStorage.getItem("voting-selections");
				if (stored) {
					try {
						const parsed = JSON.parse(stored) as VoteSelection[];
						return new Map(parsed.map((s) => [s.ballotId, s]));
					} catch {
						return new Map();
					}
				}
			}
			return new Map();
		},
	);

	const setRankedChoices = (ballotId: string, rankings: string[]) => {
		setSelections((prev) => {
			const newMap = new Map(prev);
			if (rankings.length === 0) {
				// Empty rankings means abstain - clear any previous rankings
				newMap.set(ballotId, { ballotId, vote: "ABSTAIN" });
			} else {
				// Set rankings - clear any previous vote field
				newMap.set(ballotId, { ballotId, rankings, vote: undefined });
			}
			// Persist to sessionStorage
			if (typeof window !== "undefined") {
				sessionStorage.setItem(
					"voting-selections",
					JSON.stringify(Array.from(newMap.values())),
				);
			}
			return newMap;
		});
	};

	const setSingleChoiceAbstain = (
		ballotId: string,
		vote: "YES" | "NO" | "ABSTAIN",
	) => {
		setSelections((prev) => {
			const newMap = new Map(prev);
			newMap.set(ballotId, { ballotId, vote });
			// Persist to sessionStorage
			if (typeof window !== "undefined") {
				sessionStorage.setItem(
					"voting-selections",
					JSON.stringify(Array.from(newMap.values())),
				);
			}
			return newMap;
		});
	};

	const setReferendumVote = (
		ballotId: string,
		vote: "YES" | "NO" | "ABSTAIN",
	) => {
		setSelections((prev) => {
			const newMap = new Map(prev);
			newMap.set(ballotId, { ballotId, vote });
			// Persist to sessionStorage
			if (typeof window !== "undefined") {
				sessionStorage.setItem(
					"voting-selections",
					JSON.stringify(Array.from(newMap.values())),
				);
			}
			return newMap;
		});
	};

	const clearSelection = (ballotId: string) => {
		setSelections((prev) => {
			const newMap = new Map(prev);
			newMap.delete(ballotId);
			// Persist to sessionStorage
			if (typeof window !== "undefined") {
				sessionStorage.setItem(
					"voting-selections",
					JSON.stringify(Array.from(newMap.values())),
				);
			}
			return newMap;
		});
	};

	const clearAllSelections = () => {
		setSelections(new Map());
		// Clear sessionStorage
		if (typeof window !== "undefined") {
			sessionStorage.removeItem("voting-selections");
		}
	};

	const hasSelection = (ballotId: string): boolean => {
		const selection = selections.get(ballotId);
		if (!selection) return false;
		// Has selection if there's a vote OR non-empty rankings
		return (
			selection.vote !== undefined ||
			(selection.rankings !== undefined && selection.rankings.length > 0)
		);
	};

	const getSelection = (ballotId: string): VoteSelection | undefined => {
		return selections.get(ballotId);
	};

	const getAllSelections = (): VoteSelection[] => {
		return Array.from(selections.values());
	};

	return (
		<VotingContext.Provider
			value={{
				selections,
				setRankedChoices,
				setSingleChoiceAbstain,
				setReferendumVote,
				clearSelection,
				clearAllSelections,
				hasSelection,
				getSelection,
				getAllSelections,
			}}
		>
			{children}
		</VotingContext.Provider>
	);
}

export function useVoting() {
	const context = useContext(VotingContext);
	if (!context) {
		throw new Error("useVoting must be used within a VotingProvider");
	}
	return context;
}
