import ToolHeader from "@/components/tool-header";
import RetentionClient from "./retention-client";

export const metadata = {
  title: "Retention 2027 — Pavilion XI",
  description:
    "Plan your six retentions: four capped, two uncapped. Lock the squad and share it.",
};

export default function RetentionPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 left-1/4 w-[520px] h-[520px] bg-emerald-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] bg-orange-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <ToolHeader
          eyebrow="Auction Room"
          title="Retention 2027"
          blurb="Pick the six you refuse to lose. Four capped, two uncapped — no exceptions."
          gradient="from-emerald-200 via-white to-orange-200"
        />
        <RetentionClient />
      </div>
    </div>
  );
}
