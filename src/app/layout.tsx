import "@/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";

export const metadata: Metadata = {
	title: "CSA Voting Platform",
	description:
		"Transparent and verifiable voting platform for the Central Student Association",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
	robots: {
		index: false,
		follow: false,
	},
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" className={geist.variable}>
			<body>{children}</body>
		</html>
	);
}
