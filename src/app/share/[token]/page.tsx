import Link from "next/link";
import type { Metadata } from "next";

import SharedMatch from "./shared-match";
import { toPublicMatch } from "@/lib/dto";
import { query } from "@/lib/store";

export const dynamic = "force-dynamic";

async function findByToken(token: string) {
  return query((db) => {
    const match = db.matches.find((item) => item.shareToken === token);
    return match ? toPublicMatch(match) : null;
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const match = await findByToken(token);
  if (!match) return { title: "Scorecard not found — Pavilion XI" };
  return {
    title: `${match.scoreline} — Pavilion XI`,
    description: `${match.result} · ${match.format} · ${match.venue}`,
    openGraph: {
      title: match.scoreline,
      description: match.result,
      type: "article",
    },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const match = await findByToken(token);

  if (!match) {
    return (
      <div className="min-h-screen grid place-items-center px-6 text-white">
        <div className="glass rounded-3xl p-10 text-center max-w-md">
          <div className="text-5xl mb-3">🔍</div>
          <h1 className="text-2xl font-black mb-2">Scorecard not found</h1>
          <p className="text-slate-400 mb-6 text-sm">
            This share link is no longer available. It may have been revoked by
            the person who scored the match.
          </p>
          <Link
            href="/"
            className="inline-block rounded-xl px-6 py-3 font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-[1.02] transition-all"
          >
            Back to the hub
          </Link>
        </div>
      </div>
    );
  }

  return <SharedMatch match={match} />;
}
