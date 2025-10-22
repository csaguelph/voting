"use client";

import { type ReactNode, createContext, useContext, useState } from "react";

interface VoteSelection {
	ballotId: string;
	candidateId: string | null; // null for referendum or abstain
	referendumVote?: "YES" | "NO" | "ABSTAIN";
}

interface VotingContextType {
	selections: Map<string, VoteSelection>;
	setSelection: (ballotId: string, candidateId: string) => void;
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
		new Map(),
	);

	const setSelection = (ballotId: string, candidateId: string) => {
		setSelections((prev) => {
			const newMap = new Map(prev);
			newMap.set(ballotId, { ballotId, candidateId });
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
				candidateId: null,
				referendumVote: vote,
			});
			return newMap;
		});
	};

	const clearSelection = (ballotId: string) => {
		setSelections((prev) => {
			const newMap = new Map(prev);
			newMap.delete(ballotId);
			return newMap;
		});
	};

	const clearAllSelections = () => {
		setSelections(new Map());
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

	return (
		<VotingContext.Provider
			value={{
				selections,
				setSelection,
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
		throw new Error("useVoting must be used within VotingProvider");
	}
	return context;
}
