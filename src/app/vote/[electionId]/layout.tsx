import { Footer } from "@/components/layouts/footer";

export default function VoteLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="flex min-h-screen flex-col bg-gray-50">
			<main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
				{children}
			</main>
			<Footer />
		</div>
	);
}
