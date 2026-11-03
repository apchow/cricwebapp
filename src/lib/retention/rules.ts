"use client";

import {
  RETENTION_RULES,
  DEFAULT_RTM_COUNT,
} from "./constants";

export type RetentionPlayer = {
  id: string;
  name: string;
  shortName?: string;
  role: string;
  country: string;
  overseas: boolean;
  uncapped: boolean;
  impact: number;
  retentionValue: number; // pundit suggested value in cr
  iplMatches: number;
  seasonMatches: number;
  latestSeasonMatches: number;
  lastSeason: string;
  runs: number;
  balls: number;
  strikeRate: number | null;
  wickets: number;
  economy: number | null;
  lastPlayed: string | null;
};

export type RetentionSelection = {
  retained: { playerId: string; priceCr: number }[];
  rtm: { playerId: string; priceCr: number }[];
};

export type RetentionStatus = {
  retainedCount: number;
  uncappedCount: number;
  uncappedRetainedCount: number;
  retentionSpendCr: number;
  retentionCapCr: number;
  rtmCount: number;
  rtmSpendCr: number;
  errors: string[];
  warnings: string[];
  valid: boolean;
  complete: boolean;
};

export function defaultSelection(): RetentionSelection {
  return { retained: [], rtm: [] };
}

export function clampPrice(value: number, { min = RETENTION_RULES.minPriceCr, max = RETENTION_RULES.maxPriceCr } = {}) {
  return Math.min(max, Math.max(min, Math.round(value * 10) / 10));
}

export function clampRtmPrice(value: number) {
  return Math.min(RETENTION_RULES.maxRtmPerPlayerCr, Math.max(0, Math.round(value * 10) / 10));
}

export function evaluateSelection(
  selection: RetentionSelection,
  playersById: Map<string, RetentionPlayer>,
  rules = RETENTION_RULES,
): RetentionStatus {
  const errors: string[] = [];
  const warnings: string[] = [];

  const retained = selection.retained ?? [];
  const rtm = selection.rtm ?? [];

  if (retained.length > rules.maxRetained) {
    errors.push(`Up to ${rules.maxRetained} retentions allowed (currently ${retained.length}).`);
  }

  const retainedIds = new Set(retained.map((s) => s.playerId));
  const rtmIds = new Set(rtm.map((s) => s.playerId));
  const duplicates = [...retainedIds].filter((id) => rtmIds.has(id));
  if (duplicates.length) {
    errors.push(`${duplicates.length} player(s) cannot be both retained and RTM.`);
  }

  let retentionSpend = 0;
  let uncappedRetained = 0;
  let overseasRetained = 0;

  for (const s of retained) {
    const price = clampPrice(s.priceCr);
    retentionSpend += price;
    const player = playersById.get(s.playerId);
    if (player) {
      if (player.uncapped) uncappedRetained += 1;
      if (player.overseas) overseasRetained += 1;
    }
  }

  if (retentionSpend > rules.retentionCapCr) {
    errors.push(`Retention spend ₹${retentionSpend.toFixed(1)}cr exceeds ₹${rules.retentionCapCr}cr cap.`);
  } else {
    warnings.push(`₹${(rules.retentionCapCr - retentionSpend).toFixed(1)}cr retention purse remaining.`);
  }

  retained.forEach((s) => {
    if (s.priceCr < rules.minPriceCr || s.priceCr > rules.maxPriceCr) {
      errors.push(`Retention price must be ₹${rules.minPriceCr}–${rules.maxPriceCr}cr.`);
    }
  });

  let rtmSpend = 0;
  rtm.forEach((s) => {
    rtmSpend += clampRtmPrice(s.priceCr);
    if (s.priceCr > rules.maxRtmPerPlayerCr) {
      errors.push(`RTM price cannot exceed ₹${rules.maxRtmPerPlayerCr}cr.`);
    }
  });

  if (uncappedRetained < rules.minUncapped) {
    errors.push(`Include at least ${rules.minUncapped} uncapped retention (currently ${uncappedRetained}).`);
  } else if (uncappedRetained > rules.maxUncapped) {
    errors.push(`Maximum ${rules.maxUncapped} uncapped retentions allowed.`);
  }

  if (overseasRetained > rules.maxOverseas) {
    errors.push(`Maximum ${rules.maxOverseas} overseas players in squad.`);
  }

  if (retained.length === 0) warnings.push("No retentions selected yet.");
  if (retentionSpend === 0 && retained.length > 0) {
    warnings.push("Set prices for retained players.");
  }

  const complete =
    retained.length === rules.maxRetained &&
    uncappedRetained === rules.minUncapped &&
    retentionSpend <= rules.retentionCapCr &&
    duplicates.length === 0 &&
    !errors.some((e) => e.startsWith("Retention price"));

  return {
    retainedCount: retained.length,
    uncappedCount: uncappedRetained,
    uncappedRetainedCount: uncappedRetained,
    retentionSpendCr: Math.round(retentionSpend * 10) / 10,
    retentionCapCr: rules.retentionCapCr,
    rtmCount: rtm.length,
    rtmSpendCr: Math.round(rtmSpend * 10) / 10,
    errors,
    warnings,
    valid: errors.length === 0,
    complete,
  };
}

export function autoPlan(
  players: RetentionPlayer[],
  rules = RETENTION_RULES,
): RetentionSelection {
  const byRole: Record<string, RetentionPlayer[]> = {};
  for (const p of players) {
    const rolePlayers = byRole[p.role] ?? [];
    rolePlayers.push(p);
    byRole[p.role] = rolePlayers;
  }

  const pickByRole = (role: string, count: number, exclude = new Set<string>()) => {
    return (byRole[role] ?? [])
      .sort((a, b) => b.retentionValue - a.retentionValue)
      .filter((p) => !exclude.has(p.id))
      .slice(0, count);
  };

  const exclude = new Set<string>();
  const picked: { playerId: string; priceCr: number }[] = [];

  // Two uncapped slots first.
  const uncapped = players
    .filter((p) => p.uncapped && !exclude.has(p.id))
    .sort((a, b) => b.retentionValue - a.retentionValue)
    .slice(0, rules.minUncapped);
  for (const p of uncapped) {
    exclude.add(p.id);
    picked.push({ playerId: p.id, priceCr: clampPrice(Math.min(p.retentionValue, 8)) });
  }

  // Fill remaining retentions by value across roles, preferring capped players.
  const remaining = rules.maxRetained - picked.length;
  const fill = players
    .filter((p) => !exclude.has(p.id))
    .sort((a, b) => b.retentionValue - a.retentionValue)
    .slice(0, remaining);
  for (const p of fill) {
    picked.push({ playerId: p.id, priceCr: clampPrice(p.retentionValue) });
    exclude.add(p.id);
  }

  // If over cap, reduce prices proportionally, keeping >= min.
  let spend = picked.reduce((sum, s) => sum + s.priceCr, 0);
  if (spend > rules.retentionCapCr) {
    const scale = rules.retentionCapCr / spend;
    for (const s of picked) {
      s.priceCr = clampPrice(s.priceCr * scale);
    }
  }

  // RTM: top 4 high-value players not retained, max price each.
  const rtm = players
    .filter((p) => !exclude.has(p.id))
    .sort((a, b) => b.retentionValue - a.retentionValue)
    .slice(0, 4)
    .map((p) => ({ playerId: p.id, priceCr: Math.min(rules.maxRtmPerPlayerCr, Math.max(4, p.retentionValue)) }));

  return { retained: picked, rtm };
}

export function priceOptions() {
  const out: number[] = [];
  for (let v = RETENTION_RULES.minPriceCr; v <= RETENTION_RULES.maxPriceCr; v += 0.5) out.push(v);
  return out;
}

export function formatCr(v: number) {
  return `₹${Math.max(0, Math.round(v * 10) / 10).toFixed(1)}cr`;
}

