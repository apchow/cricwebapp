import dynamic from "next/dynamic";
import ToolHeader from "@/components/tool-header";

export const metadata = {
  title: "Street Strike — Pavilion XI",
  description:
    "Two overs, two wickets, one neon pitch. Time the sweep gauge, pick your gap and smash sixes in Street Strike.",
};

// The game renders a canvas and owns a requestAnimationFrame loop, so it is
// loaded lazily. `ssr: false` is not permitted from a Server Component, and the
// game touches window/canvas only inside effects, so a normal dynamic import
// with a skeleton fallback keeps the page a thin server component.
const StreetStrike = dynamic(() => import("./street-strike"), {
  loading: () => (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
      <div className="glass rounded-3xl p-4 sm:p-6">
        <div className="h-14 rounded-xl bg-slate-800/40 animate-pulse mb-4" />
        <div className="aspect-[21/25] w-full rounded-2xl bg-slate-800/40 animate-pulse" />
        <div className="h-14 rounded-2xl bg-slate-800/40 animate-pulse mt-4" />
      </div>
      <div className="space-y-4">
        <div className="h-24 rounded-2xl bg-slate-800/40 animate-pulse" />
        <div className="h-40 rounded-2xl bg-slate-800/40 animate-pulse" />
        <div className="h-32 rounded-2xl bg-slate-800/40 animate-pulse" />
      </div>
    </div>
  ),
});

export default function MiniGamePage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 left-1/4 w-[520px] h-[520px] bg-emerald-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] bg-sky-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -left-24 w-[380px] h-[380px] bg-fuchsia-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <ToolHeader
          eyebrow="Mini Game"
          title="Street Strike"
          blurb="Two overs, two wickets, one glowing pitch. Read the delivery, time the sweep gauge and pick your gap — the first balls are forgiving, the last two are razor thin."
          gradient="from-emerald-300 via-teal-200 to-cyan-300"
        />
        <StreetStrike />
      </div>
    </div>
  );
}
