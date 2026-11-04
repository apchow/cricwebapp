import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import ScorerClient from "./scorer-client";

export const metadata = {
  title: "Gully Scorer — Pundit Arena",
  description: "Ball-by-ball gully cricket scoring with custom rules.",
};
export const dynamic = "force-dynamic";

export default async function ScorerPage() {
  const session = await currentSession();
  if (!session) redirect("/login?next=/scorer");
  return <ScorerClient />;
}
