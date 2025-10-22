"use client";

import {
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	SortableContext,
	arrayMove,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { api } from "@/trpc/react";

interface Ballot {
	id: string;
	title: string;
	type: string;
	college: string | null;
	order: number;
}

interface BallotReorderProps {
	electionId: string;
	initialBallots: Ballot[];
}

function SortableBallotItem({ ballot }: { ballot: Ballot }) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: ballot.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className="flex items-center gap-3 rounded-lg border bg-card p-4"
		>
			<button
				{...attributes}
				{...listeners}
				className="cursor-grab touch-none active:cursor-grabbing"
				type="button"
			>
				<GripVertical className="h-5 w-5 text-muted-foreground" />
			</button>

			<div className="flex-1">
				<div className="flex items-center gap-2">
					<p className="font-medium">{ballot.title}</p>
					<Badge
						variant={
							ballot.type === "EXECUTIVE"
								? "default"
								: ballot.type === "REFERENDUM"
									? "destructive"
									: "secondary"
						}
						className="text-xs"
					>
						{ballot.type}
					</Badge>
					{ballot.college && (
						<Badge variant="outline" className="text-xs">
							{ballot.college}
						</Badge>
					)}
				</div>
			</div>
		</div>
	);
}

export function BallotReorder({
	electionId,
	initialBallots,
}: BallotReorderProps) {
	const [ballots, setBallots] = useState(initialBallots);
	const [hasChanges, setHasChanges] = useState(false);

	const utils = api.useUtils();
	const reorderMutation = api.ballot.reorder.useMutation({
		onSuccess: () => {
			setHasChanges(false);
			void utils.ballot.getByElection.invalidate({ electionId });
		},
	});

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;

		if (over && active.id !== over.id) {
			setBallots((items) => {
				const oldIndex = items.findIndex((item) => item.id === active.id);
				const newIndex = items.findIndex((item) => item.id === over.id);

				const newItems = arrayMove(items, oldIndex, newIndex);
				setHasChanges(true);
				return newItems;
			});
		}
	};

	const handleSave = () => {
		const ballotOrders = ballots.map((ballot, index) => ({
			id: ballot.id,
			order: index,
		}));

		reorderMutation.mutate({
			electionId,
			ballotOrders,
		});
	};

	const handleReset = () => {
		setBallots(initialBallots);
		setHasChanges(false);
	};

	if (ballots.length === 0) {
		return (
			<Card>
				<CardContent className="py-8">
					<p className="text-center text-muted-foreground">
						No ballots to reorder. Create some ballots first.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Reorder Ballots</CardTitle>
				<CardDescription>
					Drag and drop to change the order ballots appear to voters
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={handleDragEnd}
				>
					<SortableContext
						items={ballots.map((b) => b.id)}
						strategy={verticalListSortingStrategy}
					>
						<div className="space-y-2">
							{ballots.map((ballot) => (
								<SortableBallotItem key={ballot.id} ballot={ballot} />
							))}
						</div>
					</SortableContext>
				</DndContext>

				{hasChanges && (
					<div className="flex gap-2 pt-4">
						<Button onClick={handleSave} disabled={reorderMutation.isPending}>
							{reorderMutation.isPending ? "Saving..." : "Save Order"}
						</Button>
						<Button
							variant="outline"
							onClick={handleReset}
							disabled={reorderMutation.isPending}
						>
							Reset
						</Button>
					</div>
				)}

				{reorderMutation.isError && (
					<p className="text-destructive text-sm">
						Failed to save ballot order. Please try again.
					</p>
				)}
			</CardContent>
		</Card>
	);
}
