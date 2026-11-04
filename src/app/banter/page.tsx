import type { Metadata } from "next";
import BanterWall from "./banter-client";

export const metadata: Metadata = {
  title: "Banter Wall — Pundit Arena",
  description:
    "Hot takes, cold takes and everything in between. Post your reaction and see what the rest of the arena has to say.",
};

export default function BanterPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 left-1/4 w-[500px] h-[500px] bg-fuchsia-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-10 w-[420px] h-[420px] bg-purple-700/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <BanterWall />
      </div>
    </div>
  );
}
