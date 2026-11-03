"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  Search,
  Share2,
  Sparkles,
  Target,
  Trash2,
  Users,
  X,
} from "lucide-react";

import TeamBadge from "@/components/team-badge";
import { crores, PLAYERS, playerById } from "@/data/player-db";
import { TEAMS, isOverseas } from "@/data/teams";
import { autoPickXI } from "@/lib/autopick";
import { flagOf } from "@/lib/flags";
import { readLocal, useToast, writeLocal } from "@/lib/client";
import type { IplTeam, Player, PlayerRole } from "@/types/player";

/* ─── Constants ─────────────────────────────────────────── */

const STORE_KEY = "pavilion.xi.v16";
const MAX_XI = 11;

/** The pool of currently active cricketers, sorted by form in the drawer. */
const POOL: Player[] = PLAYERS.filter((player) => player.isActive);

const ROLES: PlayerRole[] = ["Batter", "Bowler", "All-Rounder", "Wicket-Keeper"];

type SlotId = number | null;

/** Batting-order role hints, top of the strip down to the lower order. */
const SLOT_LABELS: string[] = [
  "Opener",
  "Opener",
  "No.3",
  "No.4",
  "Finisher",
  "Finisher",
  "All-Rounder",
  "All-Rounder",
  "Spinner",
  "Pacer",
  "Pacer",
];

/** Absolute positions (% of the pitch) for the eleven drop slots. */
const SLOT_LAYOUT: { top: string; left: string }[] = [
  { top: "7%", left: "30%" },
  { top: "7%", left: "70%" },
  { top: "19%", left: "50%" },
  { top: "31%", left: "30%" },
  { top: "31%", left: "70%" },
  { top: "43%", left: "50%" },
  { top: "56%", left: "30%" },
  { top: "56%", left: "70%" },
  { top: "69%", left: "50%" },
  { top: "84%", left: "30%" },
  { top: "84%", left: "70%" },
];

function emptySlots(): SlotId[] {
  return Array.from({ length: MAX_XI }, () => null);
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

/* ─── Component ─────────────────────────────────────────── */

export default function XiBuilderClient() {
  const [slots, setSlots] = useState<SlotId[]>(emptySlots);
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [query, setQuery] = useState("");
  const [team, setTeam] = useState<IplTeam | "ALL">("ALL");
  const [role, setRole] = useState<PlayerRole | "ALL">("ALL");

  const [selectedPoolId, setSelectedPoolId] = useState<number | null>(null);
  const [dragPlayerId, setDragPlayerId] = useState<number | null>(null);
  const [dragFromSlot, setDragFromSlot] = useState<number | null>(null);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const dragCount = useRef<Map<number, number>>(new Map());

  const { message, notify } = useToast();

  /* ── persistence ── */

  useEffect(() => {
    const stored = readLocal(STORE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as {
          slots?: (number | null)[];
          captainId?: number | null;
          viceCaptainId?: number | null;
        };
        if (Array.isArray(parsed.slots) && parsed.slots.length === MAX_XI) {
          setSlots(
            parsed.slots.map((id) =>
              typeof id === "number" && playerById(id) ? id : null
            )
          );
        }
        if (typeof parsed.captainId === "number") setCaptainId(parsed.captainId);
        if (typeof parsed.viceCaptainId === "number") {
          setViceCaptainId(parsed.viceCaptainId);
        }
      } catch {
        /* ignore a corrupt saved XI */
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeLocal(STORE_KEY, JSON.stringify({ slots, captainId, viceCaptainId }));
  }, [hydrated, slots, captainId, viceCaptainId]);

  /* ── derived squad ── */

  const roster = useMemo(
    () => slots.map((id) => (id === null ? null : playerById(id) ?? null)),
    [slots]
  );
  const placedIds = useMemo(
    () => slots.filter((id): id is number => id !== null),
    [slots]
  );
  const placedSet = useMemo(() => new Set(placedIds), [placedIds]);

  const selectedCount = placedIds.length;
  const overseasCount = roster.filter(
    (player): player is Player => player !== null && isOverseas(player.country)
  ).length;
  const batCount = roster.filter((player) => player?.role === "Batter").length;
  const bowlCount = roster.filter((player) => player?.role === "Bowler").length;
  const arCount = roster.filter(
    (player) => player?.role === "All-Rounder"
  ).length;
  const wkCount = roster.filter(
    (player) => player?.role === "Wicket-Keeper"
  ).length;
  const bowlingOptions = bowlCount + arCount;

  const overseasBlocked = overseasCount >= 4;
  const ready =
    selectedCount === MAX_XI &&
    overseasCount <= 4 &&
    wkCount >= 1 &&
    bowlingOptions >= 5;

  const captain = captainId !== null ? playerById(captainId) ?? null : null;
  const viceCaptain =
    viceCaptainId !== null ? playerById(viceCaptainId) ?? null : null;

  const unmet: string[] = [];
  if (selectedCount < MAX_XI) unmet.push("Pick 11 players");
  if (overseasCount > 4) unmet.push("Overseas limit exceeded — max 4");
  if (wkCount < 1) unmet.push("Need at least 1 Wicket-Keeper");
  if (bowlingOptions < 5) unmet.push("Need at least 5 bowling options");

  const pool = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return POOL.filter((player) => {
      if (team !== "ALL" && player.team !== team) return false;
      if (role !== "ALL" && player.role !== role) return false;
      if (needle && !player.name.toLowerCase().includes(needle)) return false;
      return true;
    }).sort((a, b) => b.form - a.form || b.basePrice - a.basePrice);
  }, [team, role, query]);

  /* ── helpers ── */

  function blockReason(player: Player): string | null {
    if (placedSet.has(player.id)) return "Already in your XI";
    if (isOverseas(player.country) && overseasBlocked) {
      return "Overseas limit reached — max 4";
    }
    return null;
  }

  function placeInSlot(slotIndex: number, playerId: number) {
    const player = playerById(playerId);
    if (!player) return;
    if (placedSet.has(playerId)) {
      notify("Already in your XI");
      return;
    }
    if (isOverseas(player.country) && overseasBlocked) {
      notify("Overseas limit reached — max 4");
      return;
    }
    const displaced = slots[slotIndex];
    setSlots((prev) => {
      const next = [...prev];
      next[slotIndex] = playerId;
      return next;
    });
    if (displaced !== null) {
      setCaptainId((current) => (current === displaced ? null : current));
      setViceCaptainId((current) => (current === displaced ? null : current));
    }
    setSelectedPoolId(null);
  }

  function returnToPool(playerId: number) {
    setSlots((prev) => prev.map((id) => (id === playerId ? null : id)));
    setCaptainId((current) => (current === playerId ? null : current));
    setViceCaptainId((current) => (current === playerId ? null : current));
    setSelectedPoolId((current) => (current === playerId ? null : current));
  }

  function selectPoolPlayer(player: Player) {
    if (blockReason(player)) return;
    setSelectedPoolId((current) => (current === player.id ? null : player.id));
  }

  function toggleCaptain(playerId: number) {
    setCaptainId((current) => (current === playerId ? null : playerId));
    setViceCaptainId((current) => (current === playerId ? null : current));
  }

  function toggleViceCaptain(playerId: number) {
    setViceCaptainId((current) => (current === playerId ? null : playerId));
    setCaptainId((current) => (current === playerId ? null : current));
  }

  function clearTeam() {
    setSlots(emptySlots());
    setCaptainId(null);
    setViceCaptainId(null);
    setSelectedPoolId(null);
    notify("Team cleared");
  }

  function autoPick() {
    const result = autoPickXI(POOL);
    if (result.players.length === 0) {
      notify("No active players available");
      return;
    }

    const next = emptySlots();
    result.players.forEach((player, index) => {
      next[index] = player.id;
    });
    setSlots(next);

    const byForm = [...result.players].sort((a, b) => b.form - a.form);
    setCaptainId(byForm[0]?.id ?? null);
    setViceCaptainId(byForm[1]?.id ?? null);
    setSelectedPoolId(null);

    if (result.unmet.length) {
      notify(result.unmet[0]);
    } else {
      notify(`Auto-picked ${result.players.length} players`);
    }
  }

  /* ── drag & drop ── */

  function beginDrag(playerId: number, fromSlot: number | null) {
    dragCount.current.clear();
    setDragPlayerId(playerId);
    setDragFromSlot(fromSlot);
    setHoverSlot(null);
  }

  function endDrag() {
    dragCount.current.clear();
    setDragPlayerId(null);
    setDragFromSlot(null);
    setHoverSlot(null);
  }

  function onPoolDragStart(event: DragEvent<HTMLDivElement>, player: Player) {
    beginDrag(player.id, null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(player.id));
  }

  function onSlotDragStart(
    event: DragEvent<HTMLDivElement>,
    slotIndex: number,
    playerId: number
  ) {
    event.stopPropagation();
    beginDrag(playerId, slotIndex);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(playerId));
  }

  function onSlotDragOver(event: DragEvent<HTMLDivElement>) {
    if (dragPlayerId === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function onSlotDragEnter(slotIndex: number) {
    if (dragPlayerId === null) return;
    const map = dragCount.current;
    map.set(slotIndex, (map.get(slotIndex) ?? 0) + 1);
    setHoverSlot(slotIndex);
  }

  function onSlotDragLeave(slotIndex: number) {
    const map = dragCount.current;
    const count = (map.get(slotIndex) ?? 0) - 1;
    if (count <= 0) {
      map.delete(slotIndex);
      setHoverSlot((current) => (current === slotIndex ? null : current));
    } else {
      map.set(slotIndex, count);
    }
  }

  function onSlotDrop(event: DragEvent<HTMLDivElement>, slotIndex: number) {
    event.preventDefault();
    const playerId = dragPlayerId;
    const fromSlot = dragFromSlot;
    endDrag();
    if (playerId === null) return;
    if (fromSlot !== null) {
      if (fromSlot === slotIndex) return;
      setSlots((prev) => {
        const next = [...prev];
        const moving = next[fromSlot];
        next[fromSlot] = next[slotIndex];
        next[slotIndex] = moving;
        return next;
      });
      return;
    }
    placeInSlot(slotIndex, playerId);
  }

  /* ── share ── */

  async function shareXI() {
    const lines = slots
      .map((id, index) => {
        if (id === null) return null;
        const player = playerById(id);
        if (!player) return null;
        const tag =
          id === captainId ? " (C)" : id === viceCaptainId ? " (VC)" : "";
        return `${index + 1}. ${player.name}${tag} — ${player.team}, ${
          player.role
        }, ${crores(player.basePrice)}`;
      })
      .filter((line): line is string => line !== null);

    if (!lines.length) {
      notify("Pick a few players first");
      return;
    }

    const text = `Pavilion XI — My XI\n${lines.join("\n")}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        notify("XI copied to clipboard");
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: "My XI", text });
        return;
      }
      notify("Could not copy");
    } catch {
      notify("Could not share");
    }
  }

  /* ── render ── */

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
      {/* ─── Pitch ─── */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
            The pitch · batting order
          </h2>
          <span className="text-[11px] text-slate-500">
            Drag a player to a slot, or tap to select then tap a slot.
          </span>
        </div>

        <div className="relative rounded-3xl overflow-hidden border border-emerald-900/60 bg-gradient-to-b from-emerald-950 via-[#0b2e1a] to-emerald-950 min-h-[620px] sm:min-h-[720px]">
          {/* turf mow stripes */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background:
                "repeating-linear-gradient(0deg, rgba(16,185,129,0.08) 0px, rgba(16,185,129,0.08) 2px, transparent 2px, transparent 46px)",
            }}
          />
          {/* 22-yard strip */}
          <div className="absolute left-1/2 top-[3%] bottom-[3%] w-[62%] -translate-x-1/2 rounded-2xl bg-gradient-to-b from-emerald-800/45 via-emerald-700/25 to-emerald-800/45 border border-emerald-500/20" />
          {/* crease lines */}
          <div className="absolute left-1/2 top-[8%] w-[54%] -translate-x-1/2 h-px bg-white/25" />
          <div className="absolute left-1/2 bottom-[8%] w-[54%] -translate-x-1/2 h-px bg-white/25" />
          <div className="absolute left-1/2 top-[5.5%] w-px h-[5%] -translate-x-1/2 bg-white/20" />
          <div className="absolute left-1/2 bottom-[5.5%] w-px h-[5%] -translate-x-1/2 bg-white/20" />

          {SLOT_LAYOUT.map((position, index) => {
            const player = roster[index];
            const isHover = hoverSlot === index;
            const canDropHere = selectedPoolId !== null;

            return (
              <div
                key={index}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ top: position.top, left: position.left }}
                onDragOver={onSlotDragOver}
                onDragEnter={() => onSlotDragEnter(index)}
                onDragLeave={() => onSlotDragLeave(index)}
                onDrop={(event) => onSlotDrop(event, index)}
              >
                {player ? (
                  <div
                    draggable
                    onDragStart={(event) =>
                      onSlotDragStart(event, index, player.id)
                    }
                    onDragEnd={endDrag}
                    onClick={() => {
                      if (selectedPoolId !== null) {
                        placeInSlot(index, selectedPoolId);
                      }
                    }}
                    className="relative"
                  >
                    <motion.div
                      key={player.id}
                      initial={{ scale: 0.85, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 320, damping: 22 }}
                      className={`w-[92px] h-[92px] sm:w-[106px] sm:h-[106px] rounded-full border-2 bg-slate-950/85 backdrop-blur grid place-items-center text-center px-1.5 transition-all cursor-grab active:cursor-grabbing ${
                        isHover
                          ? "ring-4 ring-emerald-400/70 border-emerald-400"
                          : "border-slate-700/70"
                      }`}
                    >
                      <span className="absolute -top-1.5 -left-1.5 w-5 h-5 grid place-items-center rounded-full bg-slate-800 border border-slate-700 text-[9px] font-mono text-slate-300">
                        {index + 1}
                      </span>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          returnToPool(player.id);
                        }}
                        aria-label={`Remove ${player.name} from the XI`}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 grid place-items-center rounded-full bg-red-500/25 border border-red-500/50 text-red-200 hover:bg-red-500/40 transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>

                      <div className="flex flex-col items-center gap-0.5 min-w-0">
                        <TeamBadge team={player.team} size={22} />
                        <span className="text-[9px] font-bold text-slate-100 leading-tight max-w-[86px] truncate">
                          {shortName(player.name)}
                        </span>
                        <span className="text-[8px] text-slate-400 truncate max-w-[86px]">
                          {player.role}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleCaptain(player.id);
                            }}
                            aria-label={
                              captainId === player.id
                                ? `Clear captain ${player.name}`
                                : `Make ${player.name} captain`
                            }
                            className={`px-1.5 py-0.5 rounded text-[8px] font-black border transition-all ${
                              captainId === player.id
                                ? "bg-amber-400 text-slate-900 border-amber-300"
                                : "bg-slate-800 text-slate-400 border-slate-700 hover:text-amber-200"
                            }`}
                          >
                            {captainId === player.id ? "★ C" : "C"}
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleViceCaptain(player.id);
                            }}
                            aria-label={
                              viceCaptainId === player.id
                                ? `Clear vice-captain ${player.name}`
                                : `Make ${player.name} vice-captain`
                            }
                            className={`px-1.5 py-0.5 rounded text-[8px] font-black border transition-all ${
                              viceCaptainId === player.id
                                ? "bg-sky-400 text-slate-900 border-sky-300"
                                : "bg-slate-800 text-slate-400 border-slate-700 hover:text-sky-200"
                            }`}
                          >
                            {viceCaptainId === player.id ? "▲ VC" : "VC"}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (selectedPoolId !== null) {
                        placeInSlot(index, selectedPoolId);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && selectedPoolId !== null) {
                        placeInSlot(index, selectedPoolId);
                      }
                    }}
                    className={`w-[92px] h-[92px] sm:w-[106px] sm:h-[106px] rounded-full border-2 border-dashed grid place-items-center text-center px-2 transition-all ${
                      isHover
                        ? "border-emerald-400 ring-4 ring-emerald-400/60 bg-emerald-500/15"
                        : canDropHere
                        ? "border-emerald-500/50 bg-emerald-500/[0.06]"
                        : "border-emerald-300/25 bg-emerald-950/40"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-mono text-emerald-200/60">
                        #{index + 1}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-300/80">
                        {SLOT_LABELS[index]}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Player drawer + validation ─── */}
      <aside className="lg:sticky lg:top-20 self-start space-y-4">
        {/* Validation summary */}
        <div
          className={`rounded-2xl border p-4 ${
            ready
              ? "border-emerald-500/40 bg-emerald-500/[0.07]"
              : "border-slate-800 bg-slate-900/70"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Squad check
            </h2>
            <span className="font-mono text-xs text-slate-400 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {selectedCount}/{MAX_XI}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5 mb-3">
            <Stat label="BAT" value={batCount} />
            <Stat label="BOWL" value={bowlCount} />
            <Stat label="AR" value={arCount} />
            <Stat label="WK" value={wkCount} />
          </div>

          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-400">Overseas</span>
            <span
              className={`font-mono font-bold ${
                overseasCount > 4 ? "text-red-300" : "text-slate-200"
              }`}
            >
              Overseas {overseasCount}/4
            </span>
          </div>

          <div className="text-[11px] text-slate-400 mb-3">
            Captain:{" "}
            <span className="text-amber-200 font-semibold">
              {captain?.name ?? "—"}
            </span>{" "}
            · Vice-captain:{" "}
            <span className="text-sky-200 font-semibold">
              {viceCaptain?.name ?? "—"}
            </span>
          </div>

          {ready ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
              <Check className="w-4 h-4 text-emerald-300" />
              <span className="text-xs font-bold text-emerald-200">
                Squad ready
              </span>
            </div>
          ) : (
            <ul className="space-y-1">
              {unmet.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-1.5 text-[11px] text-red-200/90"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>

        {overseasBlocked && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-xs font-bold text-red-200">
              Overseas limit reached — max 4
            </span>
          </div>
        )}

        {/* Filters */}
        <div className="glass rounded-2xl p-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a player…"
              className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
            <button
              onClick={() => setTeam("ALL")}
              className={`shrink-0 rounded-xl px-3 py-2 border text-[11px] font-bold transition-all ${
                team === "ALL"
                  ? "border-slate-400/60 bg-white/10 text-white"
                  : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
              }`}
            >
              All
            </button>
            {TEAMS.map((meta) => {
              const selected = team === meta.id;
              return (
                <button
                  key={meta.id}
                  onClick={() => setTeam(meta.id)}
                  aria-pressed={selected}
                  title={meta.name}
                  className={`shrink-0 grid place-items-center rounded-xl p-1.5 border transition-all ${
                    selected
                      ? `${meta.ring} bg-white/10`
                      : "border-slate-800 bg-slate-900/60 hover:bg-slate-900"
                  }`}
                >
                  <TeamBadge team={meta.id} size={28} active={selected} />
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-1.5 mt-2">
            <button
              onClick={() => setRole("ALL")}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                role === "ALL"
                  ? "bg-violet-500/20 border-violet-500/40 text-violet-200"
                  : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              All roles
            </button>
            {ROLES.map((item) => (
              <button
                key={item}
                onClick={() => setRole(item)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                  role === item
                    ? "bg-violet-500/20 border-violet-500/40 text-violet-200"
                    : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* Player list */}
        <div className="glass rounded-2xl p-3 max-h-[52vh] overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-[11px] text-slate-500">
              {pool.length} players
            </span>
            <span className="text-[11px] text-slate-500">
              {selectedCount}/{MAX_XI} picked
            </span>
          </div>

          <div className="space-y-2">
            {pool.map((player) => {
              const blocked = blockReason(player);
              const placed = placedSet.has(player.id);
              const isSelected = selectedPoolId === player.id;
              return (
                <div
                  key={player.id}
                  draggable={!blocked}
                  onDragStart={(event) => onPoolDragStart(event, player)}
                  onDragEnd={endDrag}
                  onClick={() => selectPoolPlayer(player)}
                  title={blocked ?? "Drag to the pitch, or tap to select"}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all ${
                    blocked
                      ? "border-slate-800/60 bg-slate-900/40 opacity-50 cursor-not-allowed"
                      : isSelected
                      ? "border-emerald-500/60 bg-emerald-500/10 cursor-pointer"
                      : "border-slate-800/70 bg-slate-900/60 hover:border-emerald-500/40 cursor-grab active:cursor-grabbing"
                  }`}
                >
                  <span className="text-lg leading-none shrink-0">
                    {flagOf(player.country)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-100 truncate">
                        {player.name}
                      </span>
                      {isOverseas(player.country) && (
                        <span className="text-[8px] px-1 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 font-bold shrink-0">
                          OS
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {player.role} · {crores(player.basePrice)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <TeamBadge team={player.team} size={22} />
                    {placed && (
                      <span className="text-[9px] font-bold text-emerald-300">
                        In XI
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {pool.length === 0 && (
              <p className="text-xs text-slate-500 px-1 py-6 text-center">
                No players match your filters.
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={autoPick}
          title="Pick a balanced XI — max 4 overseas, keeper and five bowling options"
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-black bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:scale-[1.01] active:scale-[0.99] transition-all"
        >
          <Sparkles className="w-4 h-4" />
          Auto-pick best XI
        </button>

        <div className="flex gap-2">
          <button
            onClick={shareXI}
            disabled={selectedCount === 0}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-black bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-35 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all"
          >
            <Share2 className="w-4 h-4" />
            Share XI
          </button>
          <button
            onClick={clearTeam}
            disabled={selectedCount === 0}
            className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold text-slate-300 bg-slate-900/70 border border-slate-800 hover:bg-slate-900 disabled:opacity-35 disabled:cursor-not-allowed transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Clear team
          </button>
        </div>
      </aside>

      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] rounded-xl px-4 py-2.5 text-sm font-semibold bg-slate-900/95 border border-slate-700 shadow-xl"
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-900/70 border border-slate-800/70 px-2 py-1.5 text-center">
      <div className="text-[8px] uppercase tracking-wider text-slate-500 font-bold">
        {label}
      </div>
      <div className="text-xs font-mono font-bold text-slate-200">{value}</div>
    </div>
  );
}
