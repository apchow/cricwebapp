import dynamic from "next/dynamic";
import ToolHeader from "@/components/tool-header";

export const metadata = {
  title: "XI Builder — Pavilion XI",
  description:
    "Architect your dream eleven on a top-down pitch. Drag and drop, respect the four-overseas cap, and name a captain and vice-captain.",
};

// The builder ships the whole player drawer and drag-and-drop wiring, so it is
// split out of the initial payload and streamed in behind a skeleton.
const XiBuilderClient = dynamic(() => import("./xi-builder-client"), {
  loading: () => (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
      <div className="glass rounded-3xl p-6">
        <div className="aspect-[3/4] w-full rounded-2xl bg-slate-800/40 animate-pulse" />
      </div>
      <div className="space-y-4">
        <div className="h-32 rounded-2xl bg-slate-800/40 animate-pulse" />
        <div className="h-64 rounded-2xl bg-slate-800/40 animate-pulse" />
      </div>
    </div>
  ),
});

export default function XiBuilderPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 left-1/3 w-[520px] h-[520px] bg-emerald-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[420px] h-[420px] bg-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <ToolHeader
          eyebrow="Selection Room"
          title="XI Builder"
          blurb="Architect your dream eleven on the pitch. Four overseas, one captain, one vice-captain — no exceptions."
          gradient="from-emerald-200 via-white to-indigo-200"
        />
        <XiBuilderClient />
      </div>
    </div>
  );
}
