import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import AccountMenu from "@/components/account-menu";
import { currentSession } from "@/lib/auth";
import { TOOLS } from "@/data/tools";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CricHub — The Cricket Toolkit",
  description: "XI Builder, Street Strike Mini-Game, and Gully Scorer in one app.",
  applicationName: "CricHub",
  openGraph: {
    title: "CricHub — The Cricket Toolkit",
    description: "Build squads. Smash sixes. Score matches.",
    siteName: "CricHub",
    type: "website",
  },
  twitter: { card: "summary" },
};

export const viewport: Viewport = {
  themeColor: "#0a0f1a",
  colorScheme: "dark",
};

export const dynamic = "force-dynamic";

function Navbar({ email }: { email: string | null }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-xl">🏏</span>
          <span className="font-black text-lg tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent group-hover:to-green-400 transition-all">
            CRIC HUB
          </span>
        </Link>
        <div className="flex items-center gap-1">
          {TOOLS.map((tool) => (
            <NavLink
              key={tool.id}
              href={tool.href}
              emoji={tool.emoji}
              label={tool.navLabel}
            />
          ))}
          <AccountMenu email={email} />
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, emoji, label }: { href: string; emoji: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-1.5"
    >
      <span className="text-base">{emoji}</span>
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await currentSession();

  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans antialiased min-h-screen">
        <Navbar email={session?.email ?? null} />
        <main className="pt-14">{children}</main>
      </body>
    </html>
  );
}
