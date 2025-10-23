# CSA Voting Platform

A transparent, verifiable online voting system for the Central Student Association at the University of Guelph. This platform enables secure student elections with cryptographic verification, supporting 30,000+ eligible voters across multiple ballot types.

## Features

### 🗳️ Comprehensive Voting System
- **Multiple Ballot Types**: Executive positions, Director positions by college, and Referendums
- **Secure Authentication**: Microsoft Entra ID (M365) integration for student authentication
- **Vote Verification**: Cryptographic vote hashing with SHA-256 for public verification
- **Merkle Tree Proofs**: Advanced cryptographic proofs for vote inclusion verification
- **Anonymous Voting**: Vote records separated from voter identity to ensure anonymity
- **Double-Vote Prevention**: Database constraints and tracking prevent duplicate voting

### 👨‍💼 Admin Dashboard
- **Election Management**: Create, edit, and manage elections with start/end times
- **CSV Voter Import**: Bulk import 30,000+ voters with batch processing and validation
- **Ballot Builder**: Create ballots with drag-and-drop candidate management
- **Real-Time Monitoring**: Live turnout tracking, quorum monitoring, and college-level statistics
- **Results Management**: Calculate results, finalize, and publish with audit trail
- **Referendum Support**: Create Yes/No referendum ballots with preamble and sponsorship

### 📊 Results & Transparency
- **Real-Time Statistics**: Monitor voter turnout and participation by college
- **Export Options**: Download results in CSV, JSON, and text formats
- **Public Verification**: Anyone can verify vote hashes without revealing vote choice
- **Audit Logging**: Complete audit trail of all system actions

### 🔒 Security & Privacy
- **Cryptographic Hashing**: SHA-256 hashing for vote integrity
- **Merkle Trees**: Cryptographic proof of vote inclusion
- **Audit Logs**: Immutable audit trail for compliance
- **Role-Based Access**: Three-tier access control (Student, Admin, CRO)
- **Vote Anonymity**: No linkage between voter identity and vote records
- **Session Security**: Secure session management with NextAuth.js

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org) with App Router
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- **API**: [tRPC v11](https://trpc.io) for type-safe APIs
- **Database**: [PostgreSQL](https://www.postgresql.org/) with [Prisma 6](https://www.prisma.io/)
- **Authentication**: [NextAuth.js v5](https://next-auth.js.org/)
- **Code Quality**: [Biome](https://biomejs.dev/) for linting and formatting
- **Package Manager**: [pnpm](https://pnpm.io/)

## Getting Started

### Prerequisites

- Node.js 22+ and pnpm
- PostgreSQL database (or Docker)
- Microsoft Entra ID (Azure AD) application credentials

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/csaguelph/voting.git
   cd voting
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

4. **Start the database** (using Docker)
   ```bash
   docker-compose up -d
   ```

5. **Run database migrations**
   ```bash
   pnpm prisma migrate
   ```

6. **Seed the database** (optional, for development)
   ```bash
   pnpm db:seed
   ```

7. **Start the development server**
   ```bash
   pnpm dev
   ```

8. **Open your browser**
   - Main site: http://localhost:3000
   - Admin dashboard: http://localhost:3000/admin

## Available Scripts

```bash
# Development
pnpm dev              # Start development server with Turbopack
pnpm build            # Build for production
pnpm start            # Start production server
pnpm preview          # Build and start production server

# Database
pnpm db:push          # Push schema changes to database
pnpm db:generate      # Generate Prisma Client
pnpm db:migrate       # Create and apply migrations
pnpm db:seed          # Seed database with test data
pnpm db:studio        # Open Prisma Studio (database GUI)

# Code Quality
pnpm check            # Run Biome linter
pnpm check:write      # Fix linting issues automatically
pnpm check:unsafe     # Fix linting issues (including unsafe fixes)
pnpm typecheck        # Run TypeScript type checking
```

## Database Schema

The platform uses PostgreSQL with the following main models:

- **Election**: Election metadata with dates and status
- **Ballot**: Individual ballots (Executive, Director, Referendum types)
- **Candidate**: Candidates for each ballot
- **Vote**: Anonymous votes with cryptographic hashes
- **EligibleVoter**: Per-election voter registry (30k+ rows)
- **AuditLog**: Immutable audit trail
- **User**: Authenticated users with roles (Student, Admin, CRO)
- **GlobalSettings**: System-wide configuration (quorum percentages)

See `prisma/schema.prisma` for the complete schema definition.

## Security

This platform implements multiple security layers:

- **Authentication**: Secure OAuth 2.0 with Microsoft Entra ID
- **Authorization**: Role-based access control (RBAC)
- **Vote Integrity**: SHA-256 cryptographic hashing
- **Vote Anonymity**: Separated voter identity from vote records
- **Audit Trail**: Complete logging of all system actions
- **Input Validation**: Zod schema validation on all inputs
- **SQL Injection Prevention**: Prisma ORM with parameterized queries
- **CSRF Protection**: Built-in Next.js CSRF protection

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## License

This project is developed for the Central Student Association at the University of Guelph.

## Support

For issues, questions, or contributions, please open an issue on GitHub.

## Acknowledgments

- Built with [T3 Stack](https://create.t3.gg/)
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Inspired by transparent voting systems worldwide ❤️
