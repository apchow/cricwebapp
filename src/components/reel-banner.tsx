"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Play, X } from "lucide-react";
import { InstagramIcon } from "@/components/brand-icons";

const REEL_URL = "https://www.instagram.com/p/Df1ojJwMOSN/";
const DISMISS_KEY = "pundit-arena:reel-banner-dismissed";

export default function ReelBanner() {
  const [visible, setVisible] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY) === "1") setVisible(false);
  }, []);

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
      <div className="relative glass rounded-2xl border border-amber-500/20 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_left,rgba(251,191,36,0.08),transparent_60%)]" />
        <button
          onClick={dismiss}
          aria-label="Close reel banner"
          title="Close"
          className="absolute right-2 top-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900/90 border border-slate-600 text-white hover:bg-red-500/30 hover:border-red-400 transition"
        >
          <X className="h-7 w-7" strokeWidth={3} />
        </button>

        {playing ? (
          <div className="relative p-4 pr-14 sm:p-6 sm:pr-16">
            <div className="mb-3 flex items-center justify-center gap-2 text-sm font-black text-white">
              <InstagramIcon className="h-4 w-4 text-rose-400" />
              Tribute to THALA — the reel
            </div>
            <div className="flex justify-center">
              <iframe
                src="https://www.instagram.com/p/Df1ojJwMOSN/embed/captioned/"
                title="Instagram reel — Tribute to THALA"
                width={360}
                height={680}
                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
                className="block rounded-xl border border-slate-700 bg-white shadow-[0_0_70px_rgba(251,191,36,0.14)]"
                style={{ width: "min(360px, 100%)", maxHeight: "78vh" }}
              />
            </div>
            <p className="mt-3 text-center text-[11px] text-slate-500">
              Tap the reel inside the frame for sound —{" "}
              <a href={REEL_URL} target="_blank" rel="noopener noreferrer" className="text-amber-300 hover:text-amber-200 underline">
                open in the app
              </a>{" "}
              if the embed stays blank.
            </p>
          </div>
        ) : (
          <div className="relative flex flex-wrap items-center gap-3 p-4 pr-14">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 text-white">
              <InstagramIcon className="h-5 w-5" />
            </span>
            <div className="flex-1 min-w-[180px]">
              <p className="text-sm font-black text-white">Tribute to THALA — watch the reel</p>
              <p className="text-[11px] text-slate-400">Loads only when you press play, so the app stays fast.</p>
            </div>
            <button
              onClick={() => setPlaying(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 text-sm font-black hover:brightness-110 active:scale-[0.98] transition"
            >
              <Play className="h-4 w-4" />
              Play reel
            </button>
            <a
              href={REEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 text-sm font-bold hover:text-white hover:border-slate-500 transition"
            >
              <ExternalLink className="h-4 w-4" />
              Instagram
            </a>
          </div>
        )}
      </div>
    </div>
  );
}