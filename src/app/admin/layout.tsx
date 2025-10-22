"use client";

import { FileText, LogOut, Menu, Settings, User, Vote, X } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { data: session } = useSession();
	const pathname = usePathname();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	const navigation = [
		{ name: "Dashboard", href: "/admin", icon: Vote },
		{ name: "Audit Logs", href: "/admin/audit", icon: FileText },
		{ name: "Settings", href: "/admin/settings", icon: Settings },
	];

	const isActivePath = (href: string) => {
		if (href === "/admin") {
			return pathname === "/admin";
		}
		return pathname.startsWith(href);
	};

	const handleSignOut = () => {
		signOut({ callbackUrl: "/" });
	};

	return (
		<div className="min-h-screen bg-gray-50">
			{/* Navbar */}
			<nav className="border-gray-200 border-b bg-white">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
					<div className="flex h-16 items-center justify-between">
						{/* Logo and Navigation */}
						<div className="flex items-center gap-8">
							{/* Logo */}
							<Link
								href="/admin"
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
									const Icon = item.icon;
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
											<Icon className="h-4 w-4" />
											{item.name}
										</Link>
									);
								})}
							</div>
						</div>

						{/* Right side - User menu and mobile toggle */}
						<div className="flex items-center gap-4">
							{/* User Menu */}
							{session?.user && (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="ghost" className="flex items-center gap-2">
											<div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
												<User className="h-4 w-4" />
											</div>
											<div className="hidden flex-col items-start text-left sm:flex">
												<span className="font-medium text-gray-900 text-sm">
													{session.user.name || "Admin"}
												</span>
												<span className="text-gray-500 text-xs">
													{session.user.role}
												</span>
											</div>
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" className="w-56">
										<DropdownMenuLabel>
											<div className="flex flex-col">
												<span>{session.user.name || "Admin"}</span>
												<span className="font-normal text-gray-500 text-xs">
													{session.user.email}
												</span>
											</div>
										</DropdownMenuLabel>
										<DropdownMenuSeparator />
										<DropdownMenuItem asChild>
											<Link href="/dashboard">
												<User className="mr-2 h-4 w-4" />
												Student View
											</Link>
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem
											onClick={handleSignOut}
											className="text-red-600"
										>
											<LogOut className="mr-2 h-4 w-4" />
											Sign Out
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
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
									const Icon = item.icon;
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
											<Icon className="h-4 w-4" />
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
			<main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
				{children}
			</main>
		</div>
	);
}
