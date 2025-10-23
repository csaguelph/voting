import "@/styles/globals.css";

import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { Geist } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { TRPCReactProvider } from "@/trpc/react";

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
			<body>
				<SessionProvider>
					<TRPCReactProvider>{children}</TRPCReactProvider>
					<Toaster />
				</SessionProvider>
			</body>
		</html>
	);
}
