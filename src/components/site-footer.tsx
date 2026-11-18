import Link from "next/link";
import { Heart } from "lucide-react";
import { InstagramIcon, YoutubeIcon } from "@/components/brand-icons";

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-800/60 py-8 text-center space-y-4">
      <p className="flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest text-amber-300">
        <Heart className="h-4 w-4 text-rose-400" />
        Tribute to THALA
        <span
          aria-label="Jersey number 7"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-amber-400 text-slate-950 text-xs font-black tracking-normal"
        >
          7
        </span>
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-bold">
        <a
          href="https://www.youtube.com/@alwaysthala"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-200 hover:border-red-500/50 hover:text-red-300 transition"
        >
          <YoutubeIcon className="h-4 w-4" />
          @alwaysthala
        </a>
        <a
          href="https://www.instagram.com/apoorv.chowdhary_/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-200 hover:border-rose-500/50 hover:text-rose-300 transition"
        >
          <InstagramIcon className="h-4 w-4" />
          @apoorv.chowdhary_
        </a>
      </div>
      <div className="inline-block px-4 py-1.5 rounded-full border border-slate-800/50 text-slate-600 text-xs font-medium uppercase tracking-widest">
        Pundit Arena
      </div>
      <p className="text-[11px] text-slate-600 max-w-xl mx-auto leading-relaxed px-4">
        A fan-made cricket playground. Not affiliated with, endorsed by, or
        connected to the BCCI, the IPL, or any franchise. Player names and
        team marks belong to their respective owners.
      </p>
      <nav className="flex items-center justify-center gap-4 text-[11px] text-slate-500">
        <Link href="/privacy" className="hover:text-slate-300 transition-colors">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-slate-300 transition-colors">
          Terms
        </Link>
        <Link
          href="/support"
          className="text-amber-400/80 hover:text-amber-300 transition-colors font-semibold"
        >
          Support ♥
        </Link>
      </nav>
    </footer>
  );
}