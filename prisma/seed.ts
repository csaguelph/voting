import { createHmac } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function hashStudentId(studentId: string): string {
	const secret = process.env.VOTE_HASH_SECRET;
	if (!secret) {
		throw new Error("VOTE_HASH_SECRET is required for seeding");
	}
	return createHmac("sha256", secret).update(studentId).digest("hex");
}

async function main() {
	console.log("🌱 Starting database seed...");

	// Create admin user
	const adminUser = await prisma.user.upsert({
		where: { email: "admin@example.com" },
		update: {},
		create: {
			email: "admin@example.com",
			name: "Admin User",
			role: "ADMIN",
			emailVerified: new Date(),
		},
	});

	console.log("✅ Created admin user:", adminUser.email);

	// Create CRO user
	const croUser = await prisma.user.upsert({
		where: { email: "cro@example.com" },
		update: {},
		create: {
			email: "cro@example.com",
			name: "Chief Returning Officer",
			role: "CRO",
			emailVerified: new Date(),
		},
	});

	console.log("✅ Created CRO user:", croUser.email);

	// Create test student user
	const studentUser = await prisma.user.upsert({
		where: { email: "student@example.com" },
		update: {},
		create: {
			email: "student@example.com",
			name: "Test Student",
			role: "STUDENT",
			emailVerified: new Date(),
		},
	});

	console.log("✅ Created student user:", studentUser.email);

	// Create a sample election (inactive, future dates)
	const futureDate = new Date();
	futureDate.setDate(futureDate.getDate() + 30);
	const endDate = new Date(futureDate);
	endDate.setDate(endDate.getDate() + 7);

	const sampleElection = await prisma.election.create({
		data: {
			name: "2025 CSA General Election",
			description:
				"Annual election for CSA Executive and College Director positions",
			startTime: futureDate,
			endTime: endDate,
			isActive: false,
		},
	});

	console.log("✅ Created sample election:", sampleElection.name);

	// Create Executive ballot
	const executiveBallot = await prisma.ballot.create({
		data: {
			electionId: sampleElection.id,
			title: "President",
			type: "EXECUTIVE",
			college: null,
		},
	});

	console.log("✅ Created Executive ballot");

	// Create candidates for Executive ballot
	await prisma.candidate.createMany({
		data: [
			{
				ballotId: executiveBallot.id,
				name: "Jane Smith",
				statement:
					"I will work to improve student services and increase transparency in CSA operations.",
			},
			{
				ballotId: executiveBallot.id,
				name: "John Doe",
				statement:
					"My focus will be on sustainability initiatives and better campus facilities.",
			},
		],
	});

	console.log("✅ Created Executive candidates");

	// Create Director ballot for COE
	const coeBallot = await prisma.ballot.create({
		data: {
			electionId: sampleElection.id,
			title: "College of Engineering Director",
			type: "DIRECTOR",
			college: "COE",
		},
	});

	console.log("✅ Created COE Director ballot");

	// Create candidates for COE ballot
	await prisma.candidate.createMany({
		data: [
			{
				ballotId: coeBallot.id,
				name: "Alice Johnson",
				statement:
					"I will advocate for more funding for engineering programs and better tech.",
			},
			{
				ballotId: coeBallot.id,
				name: "Bob Wilson",
				statement:
					"My priority is improving career services for engineering students.",
			},
		],
	});

	console.log("✅ Created COE Director candidates");

	// Create some eligible voters
	await prisma.eligibleVoter.createMany({
		data: [
			{
				electionId: sampleElection.id,
				email: "student1@uoguelph.ca",
				studentId: "1234567",
				studentIdHash: hashStudentId("1234567"),
				firstName: "Emily",
				lastName: "Brown",
				college: "COA",
			},
			{
				electionId: sampleElection.id,
				email: "student2@uoguelph.ca",
				studentId: "2345678",
				studentIdHash: hashStudentId("2345678"),
				firstName: "Michael",
				lastName: "Chen",
				college: "COE",
			},
			{
				electionId: sampleElection.id,
				email: "student3@uoguelph.ca",
				studentId: "3456789",
				studentIdHash: hashStudentId("3456789"),
				firstName: "Sarah",
				lastName: "Davis",
				college: "CBS",
			},
		],
	});

	console.log("✅ Created sample eligible voters");

	// Create a referendum ballot
	const referendumBallot = await prisma.ballot.create({
		data: {
			electionId: sampleElection.id,
			title: "Campus Sustainability Fee",
			type: "REFERENDUM",
			college: null,
			preamble:
				"The CSA is proposing a $5 per semester sustainability fee to fund green initiatives on campus.",
			question:
				"Do you support the implementation of a $5 per semester Campus Sustainability Fee?",
			sponsor: "Environmental Action Committee",
			order: 2,
		},
	});

	console.log("✅ Created referendum ballot");

	// Create some test votes (for demonstration - normally votes would come from actual voting)
	const candidates = await prisma.candidate.findMany({
		where: {
			ballotId: {
				in: [executiveBallot.id, coeBallot.id],
			},
		},
	});

	// Cast some test votes (5 votes for Executive, 3 for COE Director, 4 for Referendum)
	const janeCandidate = candidates.find((c) => c.name === "Jane Smith");
	const johnCandidate = candidates.find((c) => c.name === "John Doe");
	const aliceCandidate = candidates.find((c) => c.name === "Alice Johnson");
	const bobCandidate = candidates.find((c) => c.name === "Bob Wilson");

	if (janeCandidate && johnCandidate && aliceCandidate && bobCandidate) {
		// Executive votes: Jane (3), John (2) - using ranked choice
		await prisma.vote.createMany({
			data: [
				{
					electionId: sampleElection.id,
					ballotId: executiveBallot.id,
					voteData: { type: "RANKED", rankings: [janeCandidate.id] },
					voteHash: "hash1_executive_jane_1",
				},
				{
					electionId: sampleElection.id,
					ballotId: executiveBallot.id,
					voteData: {
						type: "RANKED",
						rankings: [janeCandidate.id, johnCandidate.id],
					},
					voteHash: "hash2_executive_jane_2",
				},
				{
					electionId: sampleElection.id,
					ballotId: executiveBallot.id,
					voteData: { type: "RANKED", rankings: [janeCandidate.id] },
					voteHash: "hash3_executive_jane_3",
				},
				{
					electionId: sampleElection.id,
					ballotId: executiveBallot.id,
					voteData: {
						type: "RANKED",
						rankings: [johnCandidate.id, janeCandidate.id],
					},
					voteHash: "hash4_executive_john_1",
				},
				{
					electionId: sampleElection.id,
					ballotId: executiveBallot.id,
					voteData: { type: "RANKED", rankings: [johnCandidate.id] },
					voteHash: "hash5_executive_john_2",
				},
			],
		});

		// COE Director votes: Alice (2), Bob (1) - using ranked choice
		await prisma.vote.createMany({
			data: [
				{
					electionId: sampleElection.id,
					ballotId: coeBallot.id,
					voteData: {
						type: "RANKED",
						rankings: [aliceCandidate.id, bobCandidate.id],
					},
					voteHash: "hash6_coe_alice_1",
				},
				{
					electionId: sampleElection.id,
					ballotId: coeBallot.id,
					voteData: { type: "RANKED", rankings: [aliceCandidate.id] },
					voteHash: "hash7_coe_alice_2",
				},
				{
					electionId: sampleElection.id,
					ballotId: coeBallot.id,
					voteData: {
						type: "RANKED",
						rankings: [bobCandidate.id, aliceCandidate.id],
					},
					voteHash: "hash8_coe_bob_1",
				},
			],
		});

		// Referendum votes: YES (5), NO (2)
		await prisma.vote.createMany({
			data: [
				{
					electionId: sampleElection.id,
					ballotId: referendumBallot.id,
					voteData: { type: "YES" },
					voteHash: "hash9_referendum_yes_1",
				},
				{
					electionId: sampleElection.id,
					ballotId: referendumBallot.id,
					voteData: { type: "YES" },
					voteHash: "hash10_referendum_yes_2",
				},
				{
					electionId: sampleElection.id,
					ballotId: referendumBallot.id,
					voteData: { type: "YES" },
					voteHash: "hash11_referendum_yes_3",
				},
				{
					electionId: sampleElection.id,
					ballotId: referendumBallot.id,
					voteData: { type: "YES" },
					voteHash: "hash12_referendum_yes_4",
				},
				{
					electionId: sampleElection.id,
					ballotId: referendumBallot.id,
					voteData: { type: "YES" },
					voteHash: "hash13_referendum_yes_5",
				},
				{
					electionId: sampleElection.id,
					ballotId: referendumBallot.id,
					voteData: { type: "NO" },
					voteHash: "hash14_referendum_no_1",
				},
				{
					electionId: sampleElection.id,
					ballotId: referendumBallot.id,
					voteData: { type: "NO" },
					voteHash: "hash15_referendum_no_2",
				},
			],
		});

		console.log("✅ Created test votes");
		console.log("   Executive: Jane Smith (3), John Doe (2)");
		console.log("   COE Director: Alice Johnson (2), Bob Wilson (1)");
		console.log("   Referendum: YES (5), NO (2)");
	}

	// Create audit log entry
	await prisma.auditLog.create({
		data: {
			electionId: sampleElection.id,
			action: "ELECTION_CREATED",
			details: {
				message: "Election created during database seed",
				createdBy: "system",
			},
		},
	});

	console.log("✅ Created audit log entry");

	console.log("\n🎉 Database seed completed successfully!");
	console.log("\n📝 Test Users:");
	console.log("   Admin: admin@example.com");
	console.log("   CRO: cro@example.com");
	console.log("   Student: student@example.com");
	console.log("\n📊 Test Data:");
	console.log(
		"   - 1 election with 3 ballots (EXECUTIVE, DIRECTOR, REFERENDUM)",
	);
	console.log("   - 4 candidates across 2 ballots");
	console.log("   - 15 test votes across all ballots");
	console.log("   - 3 eligible voters");
}

main()
	.catch((e) => {
		console.error("❌ Error seeding database:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
