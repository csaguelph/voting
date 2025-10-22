import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
				firstName: "Emily",
				lastName: "Brown",
				college: "COA",
			},
			{
				electionId: sampleElection.id,
				email: "student2@uoguelph.ca",
				studentId: "2345678",
				firstName: "Michael",
				lastName: "Chen",
				college: "COE",
			},
			{
				electionId: sampleElection.id,
				email: "student3@uoguelph.ca",
				studentId: "3456789",
				firstName: "Sarah",
				lastName: "Davis",
				college: "CBS",
			},
		],
	});

	console.log("✅ Created sample eligible voters");

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
}

main()
	.catch((e) => {
		console.error("❌ Error seeding database:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
