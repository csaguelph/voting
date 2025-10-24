import { PublicLayout } from "@/components/layouts/public-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	CheckCircle,
	Code,
	Eye,
	FileCheck,
	GitBranch,
	Lock,
	ShieldCheck,
	Users,
} from "lucide-react";
import Link from "next/link";

export default function AboutPage() {
	return (
		<PublicLayout>
			<div className="space-y-8">
				{/* Hero Section */}
				<div className="space-y-4 text-center">
					<h1 className="font-bold text-4xl tracking-tight">
						Secure, Transparent, Fair
					</h1>
					<p className="mx-auto max-w-3xl text-muted-foreground text-xl">
						Our voting system is built on cryptographic principles and
						open-source transparency to ensure every vote counts and can be
						verified.
					</p>
				</div>

				{/* Key Principles */}
				<div className="grid gap-6 md:grid-cols-3">
					<Card>
						<CardHeader>
							<ShieldCheck className="mb-2 h-8 w-8 text-green-600" />
							<CardTitle>Security First</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-muted-foreground text-sm">
								Military-grade cryptography protects every vote from tampering
								and unauthorized access.
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<Eye className="mb-2 h-8 w-8 text-blue-600" />
							<CardTitle>Full Transparency</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-muted-foreground text-sm">
								Open-source code and public audit logs mean anyone can verify
								the integrity of the election.
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<Users className="mb-2 h-8 w-8 text-purple-600" />
							<CardTitle>Fair Elections</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-muted-foreground text-sm">
								Role-based access, audit trails, and verified voter lists ensure
								only eligible students can vote once.
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Technical Features */}
				<div className="space-y-6">
					<h2 className="font-bold text-3xl tracking-tight">
						How We Ensure Security
					</h2>
					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<Lock className="h-6 w-6 text-blue-600" />
								<CardTitle>HMAC-Protected Vote Hashing</CardTitle>
								<Badge variant="secondary">Tamper-Proof</Badge>
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							<p className="text-muted-foreground">
								Every vote is converted into a unique cryptographic hash using{" "}
								<strong>HMAC-SHA256</strong> (Hash-based Message Authentication
								Code), a military-grade algorithm that provides both integrity
								and authenticity verification.
							</p>
							<div className="rounded-lg bg-muted p-4 font-mono text-xs">
								Hash = HMAC-SHA256(electionId | ballotId | candidateId | voterId
								| timestamp, SECRET_KEY)
							</div>
							<p className="text-muted-foreground text-sm">
								This deterministic hash acts as a digital fingerprint. Even the
								slightest change to vote data produces a completely different
								hash, making tampering immediately detectable.
							</p>
							<div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
								<p className="text-amber-900 text-sm">
									<strong>Protection Against Database Manipulation:</strong> The
									HMAC secret key is never stored in the database or shared with
									the database hosting provider. This means even if someone has
									full database access, they cannot modify votes and recalculate
									valid hashes—any tampering will be immediately detected during
									verification.
								</p>
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<Lock className="h-6 w-6 text-indigo-600" />
								<CardTitle>Database Field Encryption</CardTitle>
								<Badge variant="secondary">AES-256-GCM</Badge>
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							<p className="text-muted-foreground">
								Sensitive personally identifiable information is encrypted at
								rest using <strong>AES-256-GCM</strong> encryption, the same
								standard used by governments and financial institutions
								worldwide.
							</p>
							<ul className="space-y-2 text-muted-foreground text-sm">
								<li className="flex items-start gap-2">
									<CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
									<span>
										<strong>Student IDs are encrypted</strong> in the database,
										protecting against data breaches and unauthorized access
									</span>
								</li>
								<li className="flex items-start gap-2">
									<CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
									<span>
										<strong>Transparent encryption:</strong> Data is
										automatically encrypted when stored and decrypted when
										retrieved by the application
									</span>
								</li>
								<li className="flex items-start gap-2">
									<CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
									<span>
										<strong>Database host cannot read encrypted fields</strong>{" "}
										without the encryption key, which is never shared with them
									</span>
								</li>
								<li className="flex items-start gap-2">
									<CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
									<span>
										Meets compliance requirements for GDPR, FERPA, and other
										data protection regulations
									</span>
								</li>
							</ul>
							<div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
								<p className="text-indigo-900 text-sm">
									<strong>Defense in depth:</strong> Even if someone gains
									unauthorized access to the database, encrypted fields remain
									protected. The encryption keys are managed separately and
									never stored in the database itself.
								</p>
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<FileCheck className="h-6 w-6 text-green-600" />
								<CardTitle>Merkle Tree Proofs</CardTitle>
								<Badge variant="secondary">Mathematical Verification</Badge>
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							<p className="text-muted-foreground">
								After an election closes, all vote hashes are organized into a{" "}
								<strong>Merkle tree</strong>—a cryptographic data structure
								invented by computer scientist Ralph Merkle in 1979. This
								mathematical framework is used to verify large datasets
								efficiently and securely, including in distributed systems,
								secure file storage (IPFS), and version control systems like
								Git.
							</p>
							<ul className="space-y-2 text-muted-foreground text-sm">
								<li className="flex items-start gap-2">
									<CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
									<span>
										The tree creates a single <strong>root hash</strong> that
										mathematically represents all votes in the election
									</span>
								</li>
								<li className="flex items-start gap-2">
									<CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
									<span>
										You can verify your vote is included without revealing how
										you voted
									</span>
								</li>
								<li className="flex items-start gap-2">
									<CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
									<span>
										Anyone can verify that no votes were added, removed, or
										modified after the election closed
									</span>
								</li>
								<li className="flex items-start gap-2">
									<CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
									<span>
										Verification requires only log₂(n) hashes, making it
										efficient even for elections with thousands of votes
									</span>
								</li>
							</ul>
							<div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
								<p className="text-blue-900 text-sm">
									<strong>How it works:</strong> After voting, you receive a
									receipt with your vote hash. You can use this hash on the{" "}
									<Link href="/verify/proof" className="font-medium underline">
										verification page
									</Link>{" "}
									to generate a cryptographic proof that your vote is included
									in the Merkle tree, without revealing your choices. The
									mathematical properties of hash functions ensure this proof
									cannot be forged.
								</p>
							</div>
						</CardContent>
					</Card>{" "}
					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<ShieldCheck className="h-6 w-6 text-purple-600" />
								<CardTitle>Multi-Layer Tamper Protection</CardTitle>
								<Badge variant="secondary">Database-Agnostic Security</Badge>
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							<p className="text-muted-foreground">
								Our system employs multiple layers of protection to detect any
								vote tampering, even by database administrators:
							</p>
							<ul className="space-y-2 text-muted-foreground text-sm">
								<li className="flex items-start gap-2">
									<CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
									<span>
										<strong>HMAC Protection:</strong> Vote hashes require a
										secret key to generate—database admins cannot recalculate
										valid hashes if they modify vote data
									</span>
								</li>
								<li className="flex items-start gap-2">
									<CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
									<span>
										<strong>Field Encryption:</strong> Student IDs are encrypted
										in the database using AES-256-GCM, protecting personally
										identifiable information
									</span>
								</li>
								<li className="flex items-start gap-2">
									<CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
									<span>
										<strong>Deterministic Verification:</strong> The same vote
										data always produces the same hash—if data is altered, the
										hash won't match
									</span>
								</li>
								<li className="flex items-start gap-2">
									<CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
									<span>
										Students can verify their own vote integrity by providing
										their student ID on the{" "}
										<Link href="/verify" className="font-medium underline">
											verification page
										</Link>
									</span>
								</li>
							</ul>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<Eye className="h-6 w-6 text-amber-600" />
								<CardTitle>Comprehensive Audit Logging</CardTitle>
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							<p className="text-muted-foreground">
								Every action in the system is logged with tamper-proof records:
							</p>
							<div className="grid gap-4 text-sm md:grid-cols-2">
								<div className="space-y-2">
									<h4 className="font-medium">Logged Events Include:</h4>
									<ul className="space-y-1 text-muted-foreground">
										<li>• Election creation and modifications</li>
										<li>• Ballot and candidate additions</li>
										<li>• Vote submissions</li>
										<li>• Voter list uploads</li>
										<li>• Deadline extensions</li>
										<li>• Results finalization</li>
									</ul>
								</div>
								<div className="space-y-2">
									<h4 className="font-medium">Each Log Contains:</h4>
									<ul className="space-y-1 text-muted-foreground">
										<li>• User ID and role</li>
										<li>• Exact timestamp</li>
										<li>• Action performed</li>
										<li>• IP address</li>
										<li>• Changed data (before/after)</li>
									</ul>
								</div>
							</div>
							<p className="text-muted-foreground text-sm">
								Chief Returning Officers can review complete audit trails to
								investigate any concerns about election integrity.
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Transparency Features */}
				<div className="space-y-6">
					<h2 className="font-bold text-3xl tracking-tight">
						Transparency & Fairness
					</h2>

					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<Users className="h-6 w-6 text-indigo-600" />
								<CardTitle>Eligible Voter Verification</CardTitle>
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							<ul className="space-y-2 text-muted-foreground text-sm">
								<li className="flex items-start gap-2">
									<CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
									<span>
										Elections are restricted to verified student lists
										(typically imported via CSV)
									</span>
								</li>
								<li className="flex items-start gap-2">
									<CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
									<span>
										Each student can vote exactly once per election (enforced by
										the database)
									</span>
								</li>
								<li className="flex items-start gap-2">
									<CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
									<span>
										Vote submissions are validated against the eligible voter
										list in real-time
									</span>
								</li>
							</ul>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<Lock className="h-6 w-6 text-rose-600" />
								<CardTitle>Role-Based Access Control</CardTitle>
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid gap-4 md:grid-cols-3">
								<div className="space-y-2">
									<Badge variant="secondary">Student</Badge>
									<ul className="space-y-1 text-muted-foreground text-sm">
										<li>• View active elections</li>
										<li>• Cast votes</li>
										<li>• View receipts</li>
										<li>• Verify vote integrity</li>
									</ul>
								</div>
								<div className="space-y-2">
									<Badge variant="secondary">Admin</Badge>
									<ul className="space-y-1 text-muted-foreground text-sm">
										<li>• Create elections</li>
										<li>• Manage candidates</li>
										<li>• Upload voter lists</li>
										<li>• View audit logs</li>
									</ul>
								</div>
								<div className="space-y-2">
									<Badge variant="secondary">CRO</Badge>
									<ul className="space-y-1 text-muted-foreground text-sm">
										<li>• All admin permissions</li>
										<li>• Finalize results</li>
										<li>• Generate Merkle trees</li>
										<li>• Full audit access</li>
									</ul>
								</div>
							</div>
							<p className="text-muted-foreground text-sm">
								Separation of duties prevents any single person from
								compromising the election.
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<Eye className="h-6 w-6 text-teal-600" />
								<CardTitle>Public Results & Verification</CardTitle>
							</div>
						</CardHeader>
						<CardContent className="space-y-4">
							<ul className="space-y-2 text-muted-foreground text-sm">
								<li className="flex items-start gap-2">
									<CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
									<span>
										Election results are publicly viewable after the CRO
										finalizes them
									</span>
								</li>
								<li className="flex items-start gap-2">
									<CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
									<span>
										Detailed vote counts, percentages, and winner determination
										are transparent
									</span>
								</li>
								<li className="flex items-start gap-2">
									<CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
									<span>
										Anyone can verify votes using the public verification
										tools—no login required
									</span>
								</li>
							</ul>
						</CardContent>
					</Card>
				</div>

				{/* Open Source */}
				<Card className="border-2 border-primary">
					<CardHeader>
						<div className="flex items-center gap-2">
							<GitBranch className="h-6 w-6 text-primary" />
							<CardTitle>Open Source & Community Driven</CardTitle>
							<Badge>Apache 2.0 Licensed</Badge>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							This voting system is <strong>completely open source</strong> and
							available on GitHub. This means:
						</p>
						<ul className="space-y-2 text-muted-foreground text-sm">
							<li className="flex items-start gap-2">
								<Code className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
								<span>
									<strong>Full Code Transparency:</strong> Anyone can review the
									source code to verify there are no backdoors or
									vulnerabilities
								</span>
							</li>
							<li className="flex items-start gap-2">
								<Code className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
								<span>
									<strong>Security Audits:</strong> Security researchers and
									developers can audit the cryptographic implementation
								</span>
							</li>
							<li className="flex items-start gap-2">
								<Code className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
								<span>
									<strong>Community Contributions:</strong> Improvements and bug
									fixes can be submitted by anyone via pull requests
								</span>
							</li>
							<li className="flex items-start gap-2">
								<Code className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
								<span>
									<strong>Other Organizations Can Use It:</strong> Any student
									government or organization can deploy their own instance
								</span>
							</li>
						</ul>
						<div className="rounded-lg border border-primary/20 bg-primary/10 p-4">
							<p className="text-sm">
								<strong>View the code:</strong>{" "}
								<a
									href="https://github.com/csaguelph/voting"
									target="_blank"
									rel="noopener noreferrer"
									className="font-medium underline hover:text-primary"
								>
									github.com/csaguelph/voting
								</a>
							</p>
						</div>
					</CardContent>
				</Card>

				{/* Technology Stack */}
				<Card>
					<CardHeader>
						<CardTitle>Built With Modern Technology</CardTitle>
						<CardDescription>
							Industry-standard tools ensure reliability and security
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid gap-6 md:grid-cols-2">
							<div className="space-y-3">
								<h4 className="font-medium">Frontend & Backend</h4>
								<ul className="space-y-2 text-muted-foreground text-sm">
									<li>• Next.js 15 (React framework)</li>
									<li>• TypeScript (type-safe code)</li>
									<li>• tRPC (type-safe API layer)</li>
									<li>• NextAuth.js (authentication)</li>
									<li>• Tailwind CSS (styling)</li>
								</ul>
							</div>
							<div className="space-y-3">
								<h4 className="font-medium">Database & Security</h4>
								<ul className="space-y-2 text-muted-foreground text-sm">
									<li>• PostgreSQL (reliable database)</li>
									<li>• Prisma ORM (type-safe queries)</li>
									<li>• HMAC-SHA256 (vote integrity)</li>
									<li>• AES-256-GCM (field encryption)</li>
									<li>• MerkleTree.js (cryptographic proofs)</li>
									<li>• Zod (input validation)</li>
								</ul>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Try It Out */}
				<Card className="border-0 bg-linear-to-br from-blue-50 to-purple-50">
					<CardHeader>
						<CardTitle>Experience the Security Yourself</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground">
							Don't just take our word for it—test the verification features:
						</p>
						<div className="flex flex-wrap gap-3">
							<Button asChild>
								<Link href="/verify">Verify Vote Hash</Link>
							</Button>
							<Button asChild variant="outline">
								<Link href="/verify/proof">Check Merkle Proof</Link>
							</Button>
						</div>
					</CardContent>
				</Card>

				{/* Footer */}
				<div className="border-t pt-8 text-center text-muted-foreground text-sm">
					<p>
						Questions about election security? Contact your Chief Returning
						Officer or view the source code on GitHub.
					</p>
				</div>
			</div>
		</PublicLayout>
	);
}
