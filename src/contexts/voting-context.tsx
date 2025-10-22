"use client";

import { type ReactNode, createContext, useContext, useState } from "react";

interface VoteSelection {
	ballotId: string;
	candidateIds: string[]; // Array to support multi-seat elections
	referendumVote?: "YES" | "NO" | "ABSTAIN";
}

interface VotingContextType {
	selections: Map<string, VoteSelection>;
	setSelection: (ballotId: string, candidateId: string) => void;
	setMultiSelection: (ballotId: string, candidateIds: string[]) => void;
	toggleCandidate: (ballotId: string, candidateId: string) => void;
	setReferendumVote: (ballotId: string, vote: "YES" | "NO" | "ABSTAIN") => void;
	clearSelection: (ballotId: string) => void;
	clearAllSelections: () => void;
	hasSelection: (ballotId: string) => boolean;
	getSelection: (ballotId: string) => VoteSelection | undefined;
	getAllSelections: () => VoteSelection[];
	isCandidateSelected: (ballotId: string, candidateId: string) => boolean;
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

	const setSelection = (ballotId: string, candidateId: string) => {
		setSelections((prev) => {
			const newMap = new Map(prev);
			newMap.set(ballotId, { ballotId, candidateIds: [candidateId] });
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

	const setMultiSelection = (ballotId: string, candidateIds: string[]) => {
		setSelections((prev) => {
			const newMap = new Map(prev);
			newMap.set(ballotId, { ballotId, candidateIds });
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

	const toggleCandidate = (ballotId: string, candidateId: string) => {
		setSelections((prev) => {
			const newMap = new Map(prev);
			const current = newMap.get(ballotId);

			if (!current) {
				// First selection
				newMap.set(ballotId, { ballotId, candidateIds: [candidateId] });
			} else {
				// Toggle: add if not present, remove if present
				const candidateIds = current.candidateIds.includes(candidateId)
					? current.candidateIds.filter((id) => id !== candidateId)
					: [...current.candidateIds, candidateId];

				if (candidateIds.length === 0) {
					newMap.delete(ballotId);
				} else {
					newMap.set(ballotId, { ballotId, candidateIds });
				}
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

	const setReferendumVote = (
		ballotId: string,
		vote: "YES" | "NO" | "ABSTAIN",
	) => {
		setSelections((prev) => {
			const newMap = new Map(prev);
			newMap.set(ballotId, {
				ballotId,
				candidateIds: [],
				referendumVote: vote,
			});
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

	const hasSelection = (ballotId: string) => {
		return selections.has(ballotId);
	};

	const getSelection = (ballotId: string) => {
		return selections.get(ballotId);
	};

	const getAllSelections = () => {
		return Array.from(selections.values());
	};

	const isCandidateSelected = (ballotId: string, candidateId: string) => {
		const selection = selections.get(ballotId);
		return selection?.candidateIds.includes(candidateId) ?? false;
	};

	return (
		<VotingContext.Provider
			value={{
				selections,
				setSelection,
				setMultiSelection,
				toggleCandidate,
				setReferendumVote,
				clearSelection,
				clearAllSelections,
				hasSelection,
				getSelection,
				getAllSelections,
				isCandidateSelected,
			}}
		>
			{children}
		</VotingContext.Provider>
	);
}

export function useVoting() {
	const context = useContext(VotingContext);
	if (!context) {
		throw new Error("useVoting must be used within VotingProvider");
	}
	return context;
}
