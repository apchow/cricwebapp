"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  History,
  ListOrdered,
  Lock,
  MessageCircle,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

import AccountMenu from "@/components/account-menu";
import AuthModal from "@/components/auth-modal";
import { TOOLS } from "@/data/tools";

const ICONS: Record<string, LucideIcon> = {
  retention: Lock,
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
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  isActive(tool.href)
                    ? "text-white bg-white/10"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <span className="text-base">{tool.emoji}</span>
                <span className="hidden lg:inline">{tool.navLabel}</span>
              </Link>
            ))}
          </div>

          <AccountMenu email={email} />
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

      <AuthModal />
    </>
  );
}
