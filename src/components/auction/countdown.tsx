"use client";

import { useEffect, useState } from "react";

function parts(target: number, now: number) {
  const ms = Math.max(0, target - now);
  return {
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms % 86400000) / 3600000),
    mins: Math.floor((ms % 3600000) / 60000),
    secs: Math.floor((ms % 60000) / 1000),
    done: ms === 0,
  };
}

export default function AuctionCountdown({ date }: { date: string }) {
  const target = new Date(`${date}T10:00:00+05:30`).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) {
    return <div className="h-16 rounded-xl bg-slate-800/40 animate-pulse" aria-hidden />;
  }
  const t = parts(target, now);
  if (t.done) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-black text-amber-300">
        The auction is underway — hammer time!
      </div>
    );
  }
  const cells = [
    { v: t.days, l: "days" },
    { v: t.hours, l: "hrs" },
    { v: t.mins, l: "min" },
    { v: t.secs, l: "sec" },
  ];
  return (
    <div className="flex items-center gap-2" role="timer" aria-label="Time until the IPL 2027 auction">
      {cells.map((c) => (
        <div
          key={c.l}
          className="flex-1 sm:flex-none rounded-xl border border-amber-500/25 bg-gradient-to-b from-slate-900 to-slate-950 px-3 py-2 text-center min-w-[64px]"
        >
          <div className="text-2xl font-black tabular-nums text-amber-300 leading-none">
            {String(c.v).padStart(2, "0")}
          </div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-1">{c.l}</div>
        </div>
      ))}
      <div className="hidden sm:block text-xs text-slate-400 font-semibold pl-2 leading-tight">
        until the hammer
        <br />
        falls in Goa
      </div>
    </div>
  );
}