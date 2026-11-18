"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ClipboardList,
  Gavel,
  Heart,
  History,
  ListOrdered,
  MessageCircle,
  Trophy,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

import AccountMenu from "@/components/account-menu";
import AuthModal from "@/components/auth-modal";
import SupportCard from "@/components/support-card";
import { TOOLS } from "@/data/tools";

const ICONS: Record<string, LucideIcon> = {
  auction: Gavel,
  "xi-builder": Users,
  scorer: ClipboardList,
  history: History,
  series: ListOrdered,
  "mini-game": Zap,
  players: Trophy,
  banter: MessageCircle,
};

export default function SiteNav({ email }: { email: string | null }) {
  const pathname = usePathname();
  const [donateOpen, setDonateOpen] = useState(false);

  useEffect(() => {
    if (!donateOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDonateOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [donateOpen]);

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <span className="text-xl">🏏</span>
            <span className="font-black text-lg tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent group-hover:to-green-400 transition-all">
              PUNDIT ARENA
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {TOOLS.map((tool) => (
              <Link
                key={tool.id}
                href={tool.href}
                aria-current={isActive(tool.href) ? "page" : undefined}
                title={tool.navLabel}
                className={`px-2 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  isActive(tool.href)
                    ? "text-white bg-white/10"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <span className="text-base">{tool.emoji}</span>
                <span className="hidden xl:inline">{tool.navLabel}</span>
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setDonateOpen(true)}
              aria-label="Support via UPI"
              title="Support Pundit Arena — UPI QR & ID"
              className="inline-flex h-9 items-center gap-1.5 px-2.5 sm:px-3 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition"
            >
              <Heart className="h-4 w-4" />
              <span className="text-xs font-bold">Support</span>
            </button>
            <AccountMenu email={email} />
          </div>
        </div>
      </nav>

      <nav
        aria-label="Primary"
        className="md:hidden fixed bottom-0 inset-x-0 z-50 glass border-t border-slate-700/50 pb-[env(safe-area-inset-bottom)]"
      >
        {/* Rolodex of tools: fits evenly on wide phones, scrolls on narrow ones. */}
        <div className="flex overflow-x-auto custom-scrollbar">
          {TOOLS.map((tool) => {
            const Icon = ICONS[tool.id] ?? Trophy;
            const active = isActive(tool.href);
            return (
              <Link
                key={tool.id}
                href={tool.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex-1 min-w-[64px] shrink-0 flex flex-col items-center justify-center gap-1 py-2.5 px-1 transition-colors ${
                  active ? "text-emerald-300" : "text-slate-500 active:text-slate-300"
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-emerald-400" />
                )}
                <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
                <span className="text-[9px] font-bold uppercase tracking-wide whitespace-nowrap">
                  {tool.navLabel.split(" ")[0]}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {donateOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          onClick={() => setDonateOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Support via UPI"
            className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setDonateOpen(false)}
              aria-label="Close support panel"
              className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/90 border border-slate-700 text-slate-300 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
            <SupportCard />
          </div>
        </div>
      )}

      <AuthModal />
    </>
  );
}
