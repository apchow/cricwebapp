import Link from "next/link";
import { Coffee, Server, ShieldCheck, Sparkles } from "lucide-react";
import ToolHeader from "@/components/tool-header";
import SupportCard from "@/components/support-card";

export const metadata = {
  title: "Support Pundit Arena — UPI donation",
  description:
    "Pundit Arena is free and always will be. If it earned you a smile, chip in voluntarily over UPI to keep the servers humming.",
};

const PERKS = [
  {
    icon: Server,
    title: "Keeps the lights on",
    body: "Hosting, the database and the live-score feed all cost real money every month. Donations go straight into that bill.",
  },
  {
    icon: Sparkles,
    title: "Funds the next toy",
    body: "More sims, sharper stats, new games. Support buys the evenings that build them.",
  },
  {
    icon: ShieldCheck,
    title: "No paywall, ever",
    body: "Every tool stays free for everyone. Donating changes nothing about what you can use — it just keeps it alive.",
  },
];

export default function SupportPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 left-1/4 w-[520px] h-[520px] bg-amber-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] bg-rose-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <ToolHeader
          eyebrow="Buy the dev a chai"
          title="Support the Arena"
          blurb="Pundit Arena is a one-person fan project. If the auction room or the scorer earned you a smile, a small voluntary tip keeps it running."
          gradient="from-amber-300 via-yellow-400 to-rose-400"
        />

        <SupportCard />

        <div className="grid sm:grid-cols-3 gap-4 mt-6">
          {PERKS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="glass rounded-2xl p-5 space-y-2">
              <Icon className="w-5 h-5 text-amber-400" />
              <h2 className="text-sm font-black text-white">{title}</h2>
              <p className="text-xs leading-relaxed text-slate-400">{body}</p>
            </div>
          ))}
        </div>

        <div className="glass rounded-2xl p-5 mt-6 text-xs leading-relaxed text-slate-500 space-y-2">
          <p className="flex items-start gap-2">
            <Coffee className="w-4 h-4 shrink-0 text-amber-400/70 mt-0.5" />
            <span>
              Donations are <strong className="text-slate-300">voluntary tips</strong>,
              not purchases: they unlock no features, no coins and no advantage,
              and they are separate from the fictional crores in the auction
              sim. Payments happen inside your own UPI app — this site never
              sees your bank details, and tips are not refundable.
            </span>
          </p>
          <p>
            See the{" "}
            <Link href="/terms" className="underline hover:text-slate-300">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-slate-300">
              Privacy Policy
            </Link>
            . Pundit Arena is not affiliated with the BCCI, the IPL or any
            franchise.
          </p>
        </div>
      </div>
    </div>
  );
}