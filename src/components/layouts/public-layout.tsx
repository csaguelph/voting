"use client";

import { Menu, Vote, X } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Footer } from "@/components/layouts/footer";
import { Button } from "@/components/ui/button";

export function PublicLayout({ children }: { children: React.ReactNode }) {
	const { data: session } = useSession();
	const pathname = usePathname();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	const navigation = [
		{ name: "Home", href: "/" },
		{ name: "About", href: "/about" },
		{ name: "Verify Vote", href: "/verify" },
	];

	const isActivePath = (href: string) => {
		if (href === "/") {
			return pathname === "/";
		}
		return pathname.startsWith(href);
	};

	return (
		<div className="flex min-h-screen flex-col bg-gray-50">
			{/* Navbar */}
			<nav className="border-gray-200 border-b bg-white">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
					<div className="flex h-16 items-center justify-between">
						{/* Logo and Navigation */}
						<div className="flex items-center gap-8">
							{/* Logo */}
							<Link
								href="/"
								className="flex items-center gap-2 font-bold text-xl"
							>
								<Vote className="h-8 w-8 text-blue-600" />
								<span className="hidden text-gray-900 sm:block">
									CSA Voting
								</span>
							</Link>

							{/* Desktop Navigation */}
							<div className="hidden md:flex md:gap-1">
								{navigation.map((item) => {
									const isActive = isActivePath(item.href);
									return (
										<Link
											key={item.name}
											href={item.href}
											className={`flex items-center gap-2 rounded-md px-3 py-2 font-medium text-sm transition-colors ${
												isActive
													? "bg-gray-100 text-gray-900"
													: "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
											}`}
										>
											{item.name}
										</Link>
									);
								})}
							</div>
						</div>

						{/* Right side - Auth buttons */}
						<div className="flex items-center gap-4">
							{session ? (
								<Button asChild size="sm">
									<Link href="/dashboard">My Dashboard</Link>
								</Button>
							) : (
								<Button asChild size="sm">
									<Link href="/api/auth/signin">Sign In</Link>
								</Button>
							)}

							{/* Mobile menu toggle */}
							<Button
								variant="ghost"
								size="icon"
								className="text-gray-700 md:hidden"
								onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
							>
								{mobileMenuOpen ? (
									<X className="h-6 w-6" />
								) : (
									<Menu className="h-6 w-6" />
								)}
							</Button>
						</div>
					</div>

					{/* Mobile Navigation */}
					{mobileMenuOpen && (
						<div className="border-gray-200 border-t py-4 md:hidden">
							<div className="flex flex-col gap-1">
								{navigation.map((item) => {
									const isActive = isActivePath(item.href);
									return (
										<Link
											key={item.name}
											href={item.href}
											className={`flex items-center gap-2 rounded-md px-3 py-2 font-medium text-sm transition-colors ${
												isActive
													? "bg-gray-100 text-gray-900"
													: "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
											}`}
											onClick={() => setMobileMenuOpen(false)}
										>
											{item.name}
										</Link>
									);
								})}
							</div>
						</div>
					)}
				</div>
			</nav>

			{/* Main Content */}
			<main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
				{children}
			</main>

			<Footer />
		</div>
	);
}
