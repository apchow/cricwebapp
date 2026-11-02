"use client";

import { teamMeta } from "@/data/teams";
import type { IplTeam } from "@/types/player";

export default function TeamBadge({
  team,
  size = 36,
  active = false,
  showName = false,
  glyph,
}: {
  team: IplTeam | string;
  size?: number;
  active?: boolean;
  showName?: boolean;
  /** Crest shown instead of the team code, e.g. the franchise emblem. */
  glyph?: string;
}) {
  const meta = teamMeta(team);
  if (!meta) return null;

  return (
    <span className="flex items-center gap-2">
      <span
        className="relative grid place-items-center rounded-full font-black text-[10px] tracking-tight border transition-all"
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, ${meta.primary}44, ${meta.primary}18)`,
          borderColor: active ? meta.primary : "rgba(51,65,85,0.6)",
          color: meta.primary,
          boxShadow: active ? `0 0 18px ${meta.primary}66` : "none",
        }}
      >
        <span style={{ fontSize: size * (glyph ? 0.52 : 0.42) }}>
          {glyph ?? meta.short}
        </span>
      </span>
      {showName && (
        <span className="flex flex-col leading-tight text-left">
          <span className="text-xs font-bold text-slate-200">{meta.short}</span>
          <span className="text-[10px] text-slate-500">{meta.name}</span>
        </span>
      )}
    </span>
  );
}
