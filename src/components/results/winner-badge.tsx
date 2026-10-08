import { AlertCircle, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface WinnerBadgeProps {
	isWinner: boolean;
	isTied: boolean;
}

export function WinnerBadge({ isWinner, isTied }: WinnerBadgeProps) {
	if (!isWinner) return null;

	if (isTied) {
		return (
			<Badge variant="destructive" className="gap-1">
				<AlertCircle className="h-3 w-3" />
				Tied
			</Badge>
		);
	}

	return (
		<Badge variant="default" className="gap-1 bg-green-700">
			<Crown className="h-3 w-3" />
			Winner
		</Badge>
	);
}
