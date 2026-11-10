"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Trash2,
  RefreshCw,
  Copy,
  Link as LinkIcon,
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  Search,
  ArrowUpDown,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  evaluateSelection,
  autoPlan,
  clampPrice,
  clampRtmPrice,
  priceOptions,
  formatCr,
  type RetentionPlayer,
  type RetentionSelection,
  type RetentionStatus,
} from "@/lib/retention/rules";
import { RETENTION_RULES } from "@/lib/retention/constants";

const FLAGS: Record<string, string> = {
  India: "🇮🇳",
  Australia: "🇦🇺",
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "South Africa": "🇿🇦",
  "New Zealand": "🇳🇿",
  "West Indies": "🇮🇨",
  Pakistan: "🇵🇰",
  "Sri Lanka": "🇱🇰",
  Bangladesh: "🇧🇩",
  Afghanistan: "🇦🇫",
  Ireland: "🇮🇪",
  Zimbabwe: "🇿🇼",
};

function flag(country: string) {
  return FLAGS[country] ?? "🏳️";
}

function base64UrlEncode(obj: unknown) {
  if (typeof window === "undefined") return "";
  const json = JSON.stringify(obj);
  const bin = Array.from(json, (c) => c.charCodeAt(0) & 0xff);
  let str = "";
  for (const b of bin) str += String.fromCharCode(b);
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string) {
  if (typeof window === "undefined") return null;
  try {
    const normalized = str.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(normalized);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

interface Props {
  team: {
    id: string;
    name: string;
    short: string;
    color: string;
    ink: string;
  };
  squad: RetentionPlayer[];
}

export function RetentionPlanner({ team, squad }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storageKey = `pavilion-xi:retention:${team.id}`;
  const [selection, setSelection] = useState<RetentionSelection>({ retained: [], rtm: [] });
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [uncappedOnly, setUncappedOnly] = useState(false);
  const [overseasOnly, setOverseasOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"value" | "name">("value");
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const loadedRef = useRef(false);

  const playersById = useMemo(() => new Map(squad.map((p) => [p.id, p])), [squad]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as RetentionSelection;
        if (parsed && Array.isArray(parsed.retained) && Array.isArray(parsed.rtm)) {
          setSelection(parsed);
        }
      }
    } catch {
      // ignore corrupt localStorage
    }

    const shared = searchParams.get("plan");
    if (shared) {
      const decoded = base64UrlDecode(shared);
      if (decoded && Array.isArray(decoded.retained) && Array.isArray(decoded.rtm)) {
        setSelection(decoded);
      }
    }
  }, [storageKey, searchParams]);

  useEffect(() => {
    if (!loadedRef.current) return;
    localStorage.setItem(storageKey, JSON.stringify(selection));
  }, [selection, storageKey]);

  const status = useMemo(() => evaluateSelection(selection, playersById), [selection, playersById]);

  const filtered = useMemo(() => {
    return squad
      .filter((p) => {
        if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
        if (roleFilter && p.role !== roleFilter) return false;
        if (uncappedOnly && !p.uncapped) return false;
        if (overseasOnly && !p.overseas) return false;
        return true;
      })
      .sort((a, b) =>
        sortBy === "name"
          ? a.name.localeCompare(b.name)
          : b.retentionValue - a.retentionValue || b.impact - a.impact
      );
  }, [squad, query, roleFilter, uncappedOnly, overseasOnly, sortBy]);

  const isRetained = useCallback(
    (id: string) => selection.retained.some((s) => s.playerId === id),
    [selection]
  );
  const isRtm = useCallback(
    (id: string) => selection.rtm.some((s) => s.playerId === id),
    [selection]
  );

  const addRetention = useCallback(
    (player: RetentionPlayer) => {
      if (isRetained(player.id)) return;
      if (selection.retained.length >= RETENTION_RULES.maxRetained) return;
      setSelection((prev) => ({
        ...prev,
        retained: [
          ...prev.retained,
          { playerId: player.id, priceCr: clampPrice(player.retentionValue) },
        ],
      }));
    },
    [selection.retained.length, isRetained]
  );

  const addRtm = useCallback(
    (player: RetentionPlayer) => {
      if (isRtm(player.id) || isRetained(player.id)) return;
      setSelection((prev) => ({
        ...prev,
        rtm: [...prev.rtm, { playerId: player.id, priceCr: clampRtmPrice(player.retentionValue) }],
      }));
    },
    [isRtm, isRetained]
  );

  const removeRetention = useCallback((id: string) => {
    setSelection((prev) => ({
      ...prev,
      retained: prev.retained.filter((s) => s.playerId !== id),
    }));
  }, []);

  const removeRtm = useCallback((id: string) => {
    setSelection((prev) => ({
      ...prev,
      rtm: prev.rtm.filter((s) => s.playerId !== id),
    }));
  }, []);

  const setRetentionPrice = useCallback((id: string, value: number) => {
    setSelection((prev) => ({
      ...prev,
      retained: prev.retained.map((s) => (s.playerId === id ? { ...s, priceCr: clampPrice(value) } : s)),
    }));
  }, []);

  const setRtmPrice = useCallback((id: string, value: number) => {
    setSelection((prev) => ({
      ...prev,
      rtm: prev.rtm.map((s) => (s.playerId === id ? { ...s, priceCr: clampRtmPrice(value) } : s)),
    }));
  }, []);

  const resetPlan = useCallback(() => setSelection({ retained: [], rtm: [] }), []);

  const applyAutoPlan = useCallback(() => {
    setSelection(autoPlan(squad));
  }, [squad]);

  const copyPlan = useCallback(() => {
    const text = `
${team.name} — Retention Plan 2027
${formatCr(status.retentionSpendCr)} / ₹${status.retentionCapCr}cr retention cap
Retained (${status.retainedCount}/${RETENTION_RULES.maxRetained}, ${status.uncappedCount} uncapped):
${selection.retained.map((s) => { const p = playersById.get(s.playerId); return `- ${p?.name} — ${formatCr(s.priceCr)}`; }).join("\n")}
RTM (${status.rtmCount}):
${selection.rtm.map((s) => { const p = playersById.get(s.playerId); return `- ${p?.name} — ${formatCr(s.priceCr)}`; }).join("\n")}
Errors: ${status.errors.join("; ") || "none"}
Warnings: ${status.warnings.join("; ") || "none"}
Provisional rules; reputation coins only.
    `.trim();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }, [team, status, selection, playersById]);

  const copyLink = useCallback(() => {
    const encoded = base64UrlEncode({ retained: selection.retained, rtm: selection.rtm });
    const url = new URL(window.location.href);
    url.searchParams.set("plan", encoded);
    setShareUrl(url.toString());
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }, [selection]);

  const priceStep = (current: number, delta: number, min: number, max: number) => {
    return clampPrice(Math.min(max, Math.max(min, current + delta)));
  };

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      {/* Left: squad pool */}
      <div className="lg:col-span-7 space-y-4">
        <section className="glass p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase"
                style={{
                  borderColor: team.color + "40",
                  color: team.color,
                  backgroundColor: team.color + "10",
                }}
              >
                {team.short}
              </span>
              <h2 className="font-bold text-white">{team.name}</h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={applyAutoPlan}
                disabled={status.valid && status.complete}
                className="rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-slate-200 font-bold transition px-3 py-1.5 text-xs disabled:opacity-50"
              >
                <RefreshCw className="h-3 w-3 mr-1.5" /> Auto-plan
              </button>
              <button
                onClick={resetPlan}
                className="text-[10px] font-bold text-slate-500 hover:text-rose-400"
              >
                Reset
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              onClick={() => setRoleFilter(null)}
              className={`px-2 py-1 rounded border ${roleFilter === null ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-transparent bg-slate-800 text-slate-400"}`}
            >
              All
            </button>
            {["BAT", "BOWL", "AR", "WK"].map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(roleFilter === role ? null : role)}
                className={`px-2 py-1 rounded border ${roleFilter === role ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-transparent bg-slate-800 text-slate-400"}`}
              >
                {role}
              </button>
            ))}
            <button
              onClick={() => setUncappedOnly(!uncappedOnly)}
              className={`px-2 py-1 rounded border ${uncappedOnly ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-transparent bg-slate-800 text-slate-400"}`}
            >
              Uncapped
            </button>
            <button
              onClick={() => setOverseasOnly(!overseasOnly)}
              className={`px-2 py-1 rounded border ${overseasOnly ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-transparent bg-slate-800 text-slate-400"}`}
            >
              Overseas
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search players…"
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900 text-xs text-slate-200 focus:border-orange-400 focus:outline-none"
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-500 mb-1">
            <span>{filtered.length} players</span>
            <button
              onClick={() => setSortBy(sortBy === "value" ? "name" : "value")}
              className="flex items-center gap-1 hover:text-white"
            >
              Sort by {sortBy === "value" ? "Pundit value" : "Name"} <ArrowUpDown className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-1">
            {filtered.map((player) => {
              const r = selection.retained.find((s) => s.playerId === player.id);
              const m = selection.rtm.find((s) => s.playerId === player.id);
              return (
                <PlayerCard
                  key={player.id}
                  player={player}
                  retained={isRetained(player.id)}
                  rtm={isRtm(player.id)}
                  retentionPrice={r?.priceCr}
                  rtmPrice={m?.priceCr}
                  onRetain={() => addRetention(player)}
                  onRtm={() => addRtm(player)}
                  onRemoveRetention={() => removeRetention(player.id)}
                  onRemoveRtm={() => removeRtm(player.id)}
                  onSetRetentionPrice={(v) => setRetentionPrice(player.id, v)}
                  onSetRtmPrice={(v) => setRtmPrice(player.id, v)}
                />
              );
            })}
            {filtered.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4">No players match the filters.</p>
            )}
          </div>
        </section>
      </div>

      {/* Right: plan summary */}
      <div className="lg:col-span-5 space-y-4">
        <section className="glass p-4 sticky top-24">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-400">Your plan</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-1">
              <span>Retention purse</span>
              <span className={`font-mono ${status.retentionSpendCr > status.retentionCapCr ? "text-rose-400" : "text-orange-400"}`}>
                {formatCr(status.retentionSpendCr)} / ₹{status.retentionCapCr}cr
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition ${status.retentionSpendCr > status.retentionCapCr ? "bg-rose-500" : "bg-emerald-500"}`}
                style={{ width: Math.min(100, (status.retentionSpendCr / status.retentionCapCr) * 100) + "%" }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
              <div className="p-2 rounded border border-slate-700 bg-slate-900/50">
                <div className="text-[10px] text-slate-500 uppercase">Retained</div>
                <div className="font-bold text-white">{status.retainedCount}/{RETENTION_RULES.maxRetained}</div>
              </div>
              <div className="p-2 rounded border border-slate-700 bg-slate-900/50">
                <div className="text-[10px] text-slate-500 uppercase">Uncapped</div>
                <div className={`font-bold ${status.uncappedCount === RETENTION_RULES.minUncapped ? "text-emerald-400" : "text-rose-400"}`}>
                  {status.uncappedCount}/{RETENTION_RULES.minUncapped}
                </div>
              </div>
              <div className="p-2 rounded border border-slate-700 bg-slate-900/50">
                <div className="text-[10px] text-slate-500 uppercase">RTM picks</div>
                <div className="font-bold text-white">{status.rtmCount}</div>
              </div>
              <div className="p-2 rounded border border-slate-700 bg-slate-900/50">
                <div className="text-[10px] text-slate-500 uppercase">RTM total</div>
                <div className="font-bold text-white">{formatCr(status.rtmSpendCr)}</div>
              </div>
            </div>
            {status.errors.length > 0 && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 space-y-1">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-3 w-3 text-rose-400 mt-0.5" />
                  <div className="text-xs text-rose-200 leading-relaxed">
                    {status.errors.map((e) => <p key={e}>{e}</p>)}
                  </div>
                </div>
              </div>
            )}
            {status.warnings.length > 0 && status.errors.length === 0 && (
              <div className="rounded-xl border border-slate-700 bg-slate-800 p-3 space-y-1">
                {status.warnings.map((w) => (
                  <div key={w} className="flex items-start gap-2">
                    <ShieldCheck className="h-3 w-3 text-emerald-400 mt-0.5" />
                    <p className="text-xs text-emerald-200">{w}</p>
                  </div>
                ))}
              </div>
            )}
            {status.complete && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-3 w-3 text-emerald-400 mt-0.5" />
                  <p className="text-xs text-emerald-200">Plan is valid and complete.</p>
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={copyPlan} className="rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-slate-200 font-bold transition flex-1 text-xs py-1.5">
                <Copy className="h-3 w-3 mr-1.5" /> Copy plan
              </button>
              <button onClick={copyLink} className="rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-slate-200 font-bold transition flex-1 text-xs py-1.5">
                <LinkIcon className="h-3 w-3 mr-1.5" /> Share link
              </button>
            </div>
            {shareUrl && (
              <p className="text-[10px] text-slate-500 break-all">{shareUrl}</p>
            )}
          </div>
          <div className="mt-3 space-y-2 text-xs text-slate-400 border-t pt-3">
            <div className="flex justify-between">
              <span>Retained players</span>
              <span className="text-slate-300">{selection.retained.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Retention spend</span>
              <span className="text-slate-300">{formatCr(status.retentionSpendCr)}</span>
            </div>
            <div className="flex justify-between">
              <span>RTM commitment</span>
              <span className="text-slate-300">{formatCr(status.rtmSpendCr)}</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-500">
            Auto-saved to this browser. Rules provisional; reputation coins only.
          </p>
        </section>

        <section className="glass p-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-3">Retained</h2>
          <div className="space-y-2">
            {selection.retained.map((s) => {
              const p = playersById.get(s.playerId);
              if (!p) return null;
              return (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded border border-slate-700 bg-slate-800/50">
                  <span className="text-xs font-bold">{p.name}</span>
                  <span className="ml-auto text-xs text-slate-400">{p.role}</span>
                  <input
                    type="number"
                    min={RETENTION_RULES.minPriceCr}
                    max={RETENTION_RULES.maxPriceCr}
                    step="0.5"
                    value={s.priceCr}
                    onChange={(e) => setRetentionPrice(p.id, Number(e.target.value || s.priceCr))}
                    className="w-12 text-right text-xs border rounded px-1 text-orange-400 bg-transparent"
                  />
                  <span className="ml-1 text-xs text-slate-500">cr</span>
                  <button
                    onClick={() => removeRetention(p.id)}
                    className="ml-2 text-[10px] text-rose-500 hover:text-rose-300"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
            {selection.retained.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-3">No retentions yet.</p>
            )}
          </div>
        </section>

        <section className="glass p-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-3">RTM shortlist</h2>
          <div className="space-y-2">
            {selection.rtm.map((s) => {
              const p = playersById.get(s.playerId);
              if (!p) return null;
              return (
                <div key={p.id} className="flex items-center gap-2 p-2 rounded border border-slate-700 bg-slate-800/50">
                  <span className="text-xs font-bold">{p.name}</span>
                  <span className="ml-auto text-xs text-slate-400">{p.country}</span>
                  <input
                    type="number"
                    min={0}
                    max={RETENTION_RULES.maxRtmPerPlayerCr}
                    step="0.5"
                    value={s.priceCr}
                    onChange={(e) => setRtmPrice(p.id, Number(e.target.value || s.priceCr))}
                    className="w-14 text-right text-xs border rounded px-1 text-emerald-400 bg-transparent"
                  />
                  <span className="ml-1 text-xs text-slate-500">cr</span>
                  <button
                    onClick={() => removeRtm(p.id)}
                    className="ml-2 text-[10px] text-rose-500 hover:text-rose-300"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
            {selection.rtm.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-3">No RTM picks yet.</p>
            )}
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            RTM price up to ₹{RETENTION_RULES.maxRtmPerPlayerCr}cr per player.
          </p>
        </section>
      </div>
    </div>
  );
}

function PlayerCard({
  player,
  retained,
  rtm,
  retentionPrice,
  rtmPrice,
  onRetain,
  onRtm,
  onRemoveRetention,
  onRemoveRtm,
  onSetRetentionPrice,
  onSetRtmPrice,
}: {
  player: RetentionPlayer;
  retained: boolean;
  rtm: boolean;
  retentionPrice?: number;
  rtmPrice?: number;
  onRetain: () => void;
  onRtm: () => void;
  onRemoveRetention: () => void;
  onRemoveRtm: () => void;
  onSetRetentionPrice: (v: number) => void;
  onSetRtmPrice: (v: number) => void;
}) {
  const overseasTag = player.overseas ? `${flag(player.country)} ${player.country}` : flag("India") + " India";
  return (
    <div className="glass p-3 hover:border-emerald-500/50 transition group">
      <div className="flex flex-wrap items-center gap-1 mb-1.5">
        <span
          className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${
            player.role === "BAT" ? "border-orange-400/40 text-orange-300" :
            player.role === "BOWL" ? "border-emerald-400/40 text-emerald-300" :
            player.role === "AR" ? "border-blue-400/40 text-blue-300" : "border-rose-400/40 text-rose-300"
          }`}
        >
          {player.role}
        </span>
        {player.uncapped && (
          <span className="rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-1.5 py-0.5 text-[10px] font-bold">Uncapped</span>
        )}
        {player.overseas && (
          <span className="rounded border border-slate-600/50 bg-slate-800 text-slate-300 px-1.5 py-0.5 text-[10px]">{overseasTag}</span>
        )}
        <span className="ml-auto text-[10px] font-bold text-slate-500">₹{player.retentionValue.toFixed(1)}cr</span>
      </div>
      <h4 className="text-sm font-bold text-white group-hover:text-orange-300 transition">{player.name}</h4>
      <div className="mb-2">
        <p className="text-[10px] text-slate-500">
          {player.iplMatches} IPL · {player.runs} runs · {player.strikeRate ? player.strikeRate.toFixed(1) + " SR" : "—"} ·
          {player.wickets} wk · {player.economy ? player.economy.toFixed(2) + " Econ" : "—"}
        </p>
        {player.seasonMatches > 0 && (
          <p className="text-[10px] text-slate-500">
            2026: {player.seasonMatches} g · {player.seasonRuns} runs
            {player.seasonStrikeRate ? ` · ${player.seasonStrikeRate.toFixed(1)} SR` : ""}
            {player.seasonWickets ? ` · ${player.seasonWickets} wk` : ""}
            {player.seasonEconomy ? ` · ${player.seasonEconomy.toFixed(2)} Econ` : ""}
          </p>
        )}
      </div>
      <div className="flex gap-1">
        {retained ? (
          <>
            <input
              type="number"
              min={RETENTION_RULES.minPriceCr}
              max={RETENTION_RULES.maxPriceCr}
              step="0.5"
              defaultValue={retentionPrice ?? 4}
              onChange={(e) => onSetRetentionPrice(Number(e.target.value || (retentionPrice ?? 4)))}
              className="w-14 text-right text-xs border rounded px-1 text-orange-400 bg-transparent"
            />
            <span className="text-[10px] text-slate-500">cr</span>
            <button onClick={onRemoveRetention} className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 font-bold transition text-xs py-1.5 px-2">Remove</button>
          </>
        ) : (
          <button onClick={onRetain} className="flex-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition text-xs py-1.5">
            <Plus className="h-3 w-3 mr-1" /> Retain
          </button>
        )}
        {rtm ? (
          <>
            <input
              type="number"
              min={0}
              max={RETENTION_RULES.maxRtmPerPlayerCr}
              step="0.5"
              defaultValue={rtmPrice ?? 4}
              onChange={(e) => onSetRtmPrice(Number(e.target.value || (rtmPrice ?? 4)))}
              className="w-14 text-right text-xs border rounded px-1 text-emerald-400 bg-transparent"
            />
            <span className="text-[10px] text-slate-500">cr</span>
            <button onClick={onRemoveRtm} className="rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 font-bold transition text-xs py-1.5 px-2">Remove RTM</button>
          </>
        ) : (
          <button onClick={onRtm} className="flex-1 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-slate-200 font-bold transition text-xs py-1.5">
            RTM
          </button>
        )}
      </div>
    </div>
  );
}
