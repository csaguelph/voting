import { ProofVerificationPage } from "./proof-client";

export const metadata = {
	title: "Merkle Proof Verification | CSA Voting",
	description:
		"Generate and verify cryptographic Merkle proofs for vote inclusion",
};

export default function Page() {
	return <ProofVerificationPage />;
}
