"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BallotResult } from "@/lib/results/calculator";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

interface ResultsChartProps {
	ballot: BallotResult;
	type?: "bar" | "pie";
}

const COLORS = [
	"hsl(var(--chart-1))",
	"hsl(var(--chart-2))",
	"hsl(var(--chart-3))",
	"hsl(var(--chart-4))",
	"hsl(var(--chart-5))",
];

export function ResultsChart({ ballot, type = "bar" }: ResultsChartProps) {
	// Prepare data for charts
	let chartData: { name: string; votes: number; percentage: number }[] = [];

	if (ballot.ballotType === "REFERENDUM" && ballot.referendum) {
		chartData = [
			{
				name: "YES",
				votes: ballot.referendum.yes,
				percentage: ballot.referendum.yesPercentage,
			},
			{
				name: "NO",
				votes: ballot.referendum.no,
				percentage: ballot.referendum.noPercentage,
			},
		];
	} else if (ballot.candidates) {
		chartData = ballot.candidates.map((c) => ({
			name: c.name,
			votes: c.votes,
			percentage: c.percentage,
		}));
	}

	if (chartData.length === 0) {
		return null;
	}

	if (type === "pie") {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Vote Distribution</CardTitle>
				</CardHeader>
				<CardContent>
					<ResponsiveContainer width="100%" height={300}>
						<PieChart>
							<Pie
								data={chartData}
								dataKey="votes"
								nameKey="name"
								cx="50%"
								cy="50%"
								outerRadius={80}
								label={(entry) => {
									const data = entry.payload as {
										name: string;
										percentage: number;
									};
									return `${data.name}: ${data.percentage.toFixed(1)}%`;
								}}
							>
								{chartData.map((entry, index) => (
									<Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
								))}
							</Pie>
							<Tooltip
								formatter={(value: number) => `${value} votes`}
								contentStyle={{
									backgroundColor: "hsl(var(--background))",
									border: "1px solid hsl(var(--border))",
									borderRadius: "6px",
								}}
							/>
							<Legend />
						</PieChart>
					</ResponsiveContainer>
				</CardContent>
			</Card>
		);
	}

	// Bar chart (default)
	return (
		<Card>
			<CardHeader>
				<CardTitle>Vote Distribution</CardTitle>
			</CardHeader>
			<CardContent>
				<ResponsiveContainer width="100%" height={300}>
					<BarChart data={chartData}>
						<CartesianGrid
							strokeDasharray="3 3"
							stroke="hsl(var(--border))"
							opacity={0.3}
						/>
						<XAxis
							dataKey="name"
							stroke="hsl(var(--foreground))"
							fontSize={12}
							tickLine={false}
							axisLine={false}
						/>
						<YAxis
							stroke="hsl(var(--foreground))"
							fontSize={12}
							tickLine={false}
							axisLine={false}
						/>
						<Tooltip
							contentStyle={{
								backgroundColor: "hsl(var(--background))",
								border: "1px solid hsl(var(--border))",
								borderRadius: "6px",
							}}
							formatter={(value: number) => [`${value} votes`, "Votes"]}
							labelFormatter={(label) => `Candidate: ${label}`}
						/>
						<Bar
							dataKey="votes"
							fill="hsl(var(--primary))"
							radius={[8, 8, 0, 0]}
						/>
					</BarChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	);
}
