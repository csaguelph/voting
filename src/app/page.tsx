import { Footer } from "@/components/layouts/footer";

export default function Home() {
	return (
		<div className="flex min-h-screen flex-col">
			<div className="flex flex-1 flex-col items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 px-4">
				<div className="w-full max-w-2xl space-y-8 text-center">
					<div className="space-y-4">
						<h1 className="font-bold text-5xl text-slate-900 tracking-tight sm:text-6xl md:text-7xl">
							Coming Soon
						</h1>
						<h2 className="font-semibold text-2xl text-slate-700 sm:text-3xl">
							Central Student Association
						</h2>
						<h3 className="text-slate-600 text-xl sm:text-2xl">
							Voting Platform
						</h3>
					</div>

					<p className="mx-auto max-w-xl text-lg text-slate-600 leading-relaxed">
						We&apos;re building a transparent, verifiable, and secure voting
						platform for students. Stay tuned for updates.
					</p>

					<div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-slate-500 text-sm">
						<div className="flex items-center gap-2">
							<span className="text-2xl">🔒</span>
							<span>Secure</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="text-2xl">✓</span>
							<span>Verifiable</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="text-2xl">👁️</span>
							<span>Transparent</span>
						</div>
					</div>
				</div>
			</div>
			<Footer />
		</div>
	);
}
