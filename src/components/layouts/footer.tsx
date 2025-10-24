import { GitCommit } from "lucide-react";

export function Footer() {
	const gitCommit = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;

	return (
		<footer className="mt-auto border-gray-200 border-t bg-white">
			<div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
				<div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
					<div className="text-center text-gray-600 text-sm sm:text-left">
						<p>© 2025 Central Student Association</p>
						<p className="text-gray-500 text-xs">
							Secure, transparent, and verifiable elections
						</p>
						{gitCommit && (
							<a
								href={`https://github.com/csaguelph/voting/commit/${gitCommit}`}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-1 font-mono text-gray-400 text-xs hover:text-gray-600 hover:underline"
							>
								<GitCommit className="h-3 w-3" />v{gitCommit.slice(0, 7)}
							</a>
						)}
					</div>
					<div className="flex gap-4 text-sm">
						<a
							href="https://github.com/csaguelph/voting"
							target="_blank"
							rel="noopener noreferrer"
							className="text-gray-600 hover:text-gray-900"
						>
							GitHub
						</a>
					</div>
				</div>
			</div>
		</footer>
	);
}
