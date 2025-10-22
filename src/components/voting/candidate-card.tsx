"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroupItem } from "@/components/ui/radio-group";

interface CandidateCardProps {
	id: string;
	name: string;
	statement?: string | null;
	isSelected: boolean;
}

export function CandidateCard({
	id,
	name,
	statement,
	isSelected,
}: CandidateCardProps) {
	return (
		<div className="flex items-start gap-3">
			<RadioGroupItem value={id} id={id} className="mt-1" />
			<Label htmlFor={id} className="flex-1 cursor-pointer">
				<Card
					className={`transition-all ${
						isSelected
							? "border-primary bg-primary/5"
							: "hover:border-primary/50"
					}`}
				>
					<CardContent className="p-4">
						<div className="space-y-2">
							<div className="font-semibold">{name}</div>
							{statement && (
								<div className="mt-2 text-muted-foreground text-sm">
									{statement}
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			</Label>
		</div>
	);
}
