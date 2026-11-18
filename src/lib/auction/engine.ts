import {
  AUCTION_RULES,
  SET_ORDER,
  setFor,
  type AuctionPlayer,
  type OfficialTeam,
  type SetName,
} from "./data.ts";
import type { RetentionPlan } from "./plan.ts";

const MIN_BASE_CR = 0.2;
const RESERVE_PER_SLOT_CR = 0.3;
/** Impact scales differ by role — a 64-rated bowler is elite, a 64 bat is not. */
const STARTER_IMPACT: Record<string, number> = { BAT: 75, WK: 75, AR: 62, BOWL: 55 };

/** Rivals are stingy: hoard cash on ordinary names, fight only for headliners. */
const STINGY = { value: 0.72, prob: 0.55, cool: 1.6 };
/** When the user shows interest in a marquee lot, rivals escalate into a war. */
const USER_INTEREST_BOOST = 1.35;
/** Editorial ceilings while the user sits out — these names never draw a frenzy alone. */
const NO_INTEREST_CAP_CR: Record<string, number> = { acdc62f5: 10 };

export interface EngineConfig {
  userTeamId: string;
  plan: RetentionPlan;
  teams: OfficialTeam[];
  pool: AuctionPlayer[];
  seed?: number;
}

export interface SquadBuy {
  player: AuctionPlayer;
  priceCr: number;
}

export interface EngineTeam {
  id: string;
  name: string;
  short: string;
  color: string;
  isUser: boolean;
  purseCr: number;
  initialPurseCr: number;
  slots: number;
  overseasSlots: number;
  retained: AuctionPlayer[];
  buys: SquadBuy[];
  spentCr: number;
}

export type LotPhase = "open" | "countdown" | "sold" | "unsold";

export interface Lot {
  player: AuctionPlayer;
  set: SetName;
  bidCr: number;
  leaderId: string | null;
  phase: LotPhase;
  idleMs: number;
  countdownMs: number;
  holdMs: number;
}

export interface AuctionEvent {
  type: "lot" | "bid" | "user-bid" | "countdown" | "sold" | "unsold" | "end";
  teamId?: string;
  player?: AuctionPlayer;
  priceCr?: number;
}

export interface LogEntry {
  kind: "bid" | "sold" | "unsold" | "info";
  text: string;
  teamId?: string;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** IPL-style bid ladder. */
export function nextBidCr(current: number): number {
  if (current < 1) return round2(current + 0.2);
  if (current < 5) return round2(current + 0.25);
  if (current < 10) return round2(current + 0.5);
  return round2(current + 1);
}

/**
 * What a player is actually worth right now: the past-auction / market anchor
 * (valueCr) adjusted for last season's form and real-life IPL bidding trends
 * (uncapped frenzy, overseas-star premium, rust for those who didn't feature).
 */
export function formValueCr(p: AuctionPlayer): number {
  let m = 1;
  const games = Math.max(0, p.latestSeasonMatches);
  const bat = p.role === "BAT" || p.role === "WK" || p.role === "AR";
  const bowl = p.role === "BOWL" || p.role === "AR";
  if (bat && p.seasonBalls > 0 && p.seasonStrikeRate != null) {
    const sr = p.seasonStrikeRate;
    const rpm = p.seasonRuns / Math.max(1, games);
    if (sr >= 140 && rpm >= 25) m *= 1.25;
    else if (sr >= 125 && rpm >= 18) m *= 1.1;
    else if (sr < 110 || rpm < 10) m *= 0.8;
  }
  if (bowl && p.seasonWickets > 0 && p.seasonEconomy != null) {
    const econ = p.seasonEconomy;
    const wpm = p.seasonWickets / Math.max(1, games);
    if (econ <= 7.5 && wpm >= 1.5) m *= 1.25;
    else if (econ <= 8.5 && wpm >= 1) m *= 1.1;
    else if (econ >= 9.5) m *= 0.8;
  }
  if (games === 0) m *= 0.85;
  if (p.uncapped && p.impact >= 55) m *= 1.2;
  if (p.overseas && p.valueCr >= 8) m *= 1.08;
  return round2(p.valueCr * Math.min(1.6, Math.max(0.5, m)));
}

export interface Archetype {
  name: string;
  lo: number;
  hi: number;
  mRole: number;
  ceiling: number | null;
}

/** Mini-auction valuation tiers: scarce skills carry premiums, backups stay cheap. */
export function archetypeFor(p: AuctionPlayer): Archetype {
  if (p.uncapped) return { name: "Uncapped breakout", lo: 0.5, hi: 1.5, mRole: 1.2, ceiling: 6 };
  if (p.role === "BOWL") {
    if (p.valueCr >= 4) return { name: "Marquee pace / death", lo: 4, hi: 9, mRole: 1.45, ceiling: null };
    if (p.valueCr >= 2) return { name: "Wrist / mystery spin", lo: 2, hi: 4, mRole: 1.15, ceiling: null };
    return { name: "Squad backup", lo: 0.3, hi: 1, mRole: 0.85, ceiling: 1.5 };
  }
  if (p.role === "AR") {
    if (p.valueCr >= 3.5) return { name: "Pace all-rounder", lo: 3.5, hi: 7, mRole: 1.4, ceiling: null };
    if (p.valueCr >= 2) return { name: "Power finisher", lo: 2.5, hi: 5.5, mRole: 1.3, ceiling: null };
    return { name: "Squad backup", lo: 0.3, hi: 1, mRole: 0.85, ceiling: 1.5 };
  }
  if (p.valueCr >= 3) {
    const sr = p.seasonStrikeRate ?? p.strikeRate ?? 120;
    if (sr >= 140) return { name: "Power finisher", lo: 2.5, hi: 5.5, mRole: 1.3, ceiling: null };
    return { name: "Explosive top-order / WK", lo: 3, hi: 6.5, mRole: 1.25, ceiling: null };
  }
  if (p.valueCr >= 1.5) return { name: "Rotation batter", lo: 1.5, hi: 2.5, mRole: 1, ceiling: 3 };
  return { name: "Squad backup", lo: 0.3, hi: 1, mRole: 0.85, ceiling: 1.5 };
}

export class AuctionEngine {
  readonly userTeamId: string;
  readonly pool: AuctionPlayer[];
  teams: EngineTeam[];
  phase: "live" | "done" = "live";
  lotIndex = 0;
  lot: Lot;
  userPassed = false;
  speed: 1 | 4 = 1;
  log: LogEntry[] = [];
  soldCount = 0;
  unsoldCount = 0;
  totalSpendCr = 0;
  biggestSale: SquadBuy & { teamId: string } | null = null;

  private rng: () => number;
  private events: AuctionEvent[] = [];
  private cooldowns = new Map<string, number>();
  /** Per player-team personality noise (0.90–1.12), drawn once at auction start. */
  private noise = new Map<string, Map<string, number>>();
  /** Last two distinct paddles on the current lot — the active duel. */
  private lastBidders: string[] = [];
  /** Teams that already placed a spoiling tax bid on this lot. */
  private spoiled = new Set<string>();
  /** User raised a paddle on this lot — rivals smell a war and escalate. */
  private userLotInterest = false;

  constructor(config: EngineConfig) {
    this.userTeamId = config.userTeamId;
    this.rng = mulberry32(config.seed ?? Date.now() % 2147483647);

    this.teams = config.teams.map((t) => {
      const isUser = t.id === config.userTeamId;
      const purse = isUser ? config.plan.purseCr : t.purseCr;
      return {
        id: t.id,
        name: t.name,
        short: t.short,
        color: t.color,
        isUser,
        purseCr: purse,
        initialPurseCr: purse,
        slots: isUser ? config.plan.slots : t.slots,
        overseasSlots: isUser ? config.plan.overseasSlots : t.overseasSlots,
        retained: isUser ? config.plan.retained : t.retained,
        buys: [],
        spentCr: 0,
      };
    });

    // Personality noise per player-team pair so rivals don't drop at identical thresholds.
    for (const p of config.pool) {
      const m = new Map<string, number>();
      for (const t of this.teams) m.set(t.id, 0.9 + this.rng() * 0.22);
      this.noise.set(p.id, m);
    }

    // Sets in auction order, shuffled inside each set.
    const bySet = new Map<SetName, AuctionPlayer[]>(SET_ORDER.map((s) => [s, []]));
    for (const p of config.pool) bySet.get(setFor(p))!.push(p);
    this.pool = [];
    for (const s of SET_ORDER) {
      const list = bySet.get(s)!;
      for (let i = list.length - 1; i > 0; i -= 1) {
        const j = Math.floor(this.rng() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      this.pool.push(...list);
    }

    this.lot = this.makeLot(0);
    this.pushLog("info", `${this.lot.set} set opens the auction — ${this.pool.length} players on the block.`);
    this.events.push({ type: "lot", player: this.lot.player });
  }

  private makeLot(index: number): Lot {
    const player = this.pool[index];
    return {
      player,
      set: setFor(player),
      bidCr: player.basePriceCr,
      leaderId: null,
      phase: "open",
      idleMs: 0,
      countdownMs: 0,
      holdMs: 0,
    };
  }

  team(id: string): EngineTeam {
    return this.teams.find((t) => t.id === id)!;
  }

  user(): EngineTeam {
    return this.team(this.userTeamId);
  }

  drainEvents(): AuctionEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  private pushLog(kind: LogEntry["kind"], text: string, teamId?: string): void {
    this.log.push({ kind, text, teamId });
    if (this.log.length > 80) this.log.splice(0, this.log.length - 80);
  }

  /** Most the user may bid while still affording base-price fills for the rest. */
  userMaxBidCr(): number {
    const u = this.user();
    return round2(Math.max(0, u.purseCr - MIN_BASE_CR * Math.max(0, u.slots - 1)));
  }

  canUserBid(): boolean {
    if (this.phase !== "live") return false;
    if (this.lot.phase !== "open" && this.lot.phase !== "countdown") return false;
    if (this.userPassed || this.lot.leaderId === this.userTeamId) return false;
    const u = this.user();
    if (u.slots <= 0) return false;
    if (this.lot.player.overseas && u.overseasSlots <= 0) return false;
    const next = this.lot.leaderId ? nextBidCr(this.lot.bidCr) : this.lot.bidCr;
    return next <= this.userMaxBidCr() + 1e-9;
  }

  userBid(): boolean {
    if (!this.canUserBid()) return false;
    const amount = this.lot.leaderId ? nextBidCr(this.lot.bidCr) : this.lot.bidCr;
    this.placeBid(this.userTeamId, amount);
    return true;
  }

  userPass(): void {
    if (this.phase !== "live") return;
    this.userPassed = true;
  }

  private placeBid(teamId: string, amount: number): void {
    const prevLeader = this.lot.leaderId;
    this.lot.bidCr = amount;
    this.lot.leaderId = teamId;
    this.lot.phase = "open";
    this.lot.idleMs = 0;
    this.lot.countdownMs = 0;
    const t = this.team(teamId);
    if (teamId === this.userTeamId) this.userLotInterest = true;
    this.events.push({ type: teamId === this.userTeamId ? "user-bid" : "bid", teamId, priceCr: amount, player: this.lot.player });
    this.pushLog("bid", `${t.short} bid ₹${amount.toFixed(2)}cr for ${this.lot.player.name}`, teamId);
    this.cooldowns.set(teamId, 700 + this.rng() * 1500);
    // The outbid duelist needs a beat to react before countering.
    if (prevLeader && prevLeader !== teamId) this.cooldowns.set(prevLeader, 400 + this.rng() * 800);
    this.lastBidders = [teamId, ...this.lastBidders.filter((id) => id !== teamId)].slice(0, 2);
  }

  private startersInRole(t: EngineTeam, role: string): number {
    const bar = STARTER_IMPACT[role] ?? 65;
    return [...t.retained, ...t.buys.map((b) => b.player)].filter((s) => s.role === role && s.impact >= bar).length;
  }

  /** Team-specific max bid: spendable guardrail × tiered valuation, under the hard cap. */
  private maxBidCr(t: EngineTeam, p: AuctionPlayer): number {
    if (p.overseas && t.overseasSlots <= 0) return 0;
    if (t.slots <= 0) return 0;
    const spendable = Math.max(0, t.purseCr - RESERVE_PER_SLOT_CR * Math.max(0, t.slots - 1));
    const squadSize = t.retained.length + t.buys.length;
    const remainingInRole = this.pool.slice(this.lotIndex).filter((x) => x.role === p.role).length;

    // Accelerated round: squads below 18 panic-buy matching names; settled squads go value-only.
    if (this.lot.set === "Uncapped") {
      if (squadSize >= AUCTION_RULES.minSquad) return Math.min(1.25 * p.basePriceCr, spendable);
      if (remainingInRole <= t.slots) {
        return Math.min(formValueCr(p) * 1.6, spendable);
      }
    }

    const starters = this.startersInRole(t, p.role);
    const critical = starters === 0;
    const marquee = p.valueCr >= 6;
    let mNeed = critical ? 1.4 : starters === 1 ? 1 : 0.45;
    // Marquee headliners draw upgrade wars even from saturated squads.
    if (marquee) mNeed = Math.max(mNeed, 1);
    // User raised a paddle on a headliner: rivals smell blood and fight past 15cr.
    if (marquee && this.userLotInterest) mNeed = Math.max(mNeed, 1.4);
    const arch = archetypeFor(p);
    const formFactor = formValueCr(p) / Math.max(0.01, p.valueCr);
    const vBase = Math.min(arch.hi, Math.max(arch.lo, p.valueCr)) * formFactor;
    const needing = this.teams.filter(
      (x) => x.slots > 0 && (!p.overseas || x.overseasSlots > 0) && this.startersInRole(x, p.role) < 2
    ).length;
    const mScarcity = Math.min(1.45, 1 + 0.15 * (needing / Math.max(1, remainingInRole)));
    const eps = this.noise.get(p.id)?.get(t.id) ?? 1;
    let value = vBase * arch.mRole * mNeed * mScarcity * eps * (marquee ? 1 : STINGY.value);
    if (marquee && this.userLotInterest) {
      value = Math.max(value * USER_INTEREST_BOOST, 13 + p.valueCr * 0.5);
    } else if (marquee) {
      // 15cr+ wars are reserved for lots the user actually contested.
      value = Math.min(value, 14, NO_INTEREST_CAP_CR[p.id] ?? 14);
    }
    if (arch.ceiling != null) value = Math.min(value, arch.ceiling);
    // Only marquee headliners may cross 6cr — nobodies never out-earn stars.
    if (!marquee) value = Math.min(value, 6);
    // Hoarding reserve: rich teams with room won't blow half the purse on one name
    // unless it plugs a critical starting-XI gap or the user started a war.
    if (t.slots >= 4 && t.purseCr > 25 && !critical && !(marquee && this.userLotInterest)) {
      value = Math.min(value, 0.55 * t.purseCr);
    }
    return Math.min(value, spendable);
  }

  private resolveSold(): void {
    const lot = this.lot;
    const t = this.team(lot.leaderId!);
    t.purseCr = round2(t.purseCr - lot.bidCr);
    t.spentCr = round2(t.spentCr + lot.bidCr);
    t.slots -= 1;
    if (lot.player.overseas) t.overseasSlots -= 1;
    t.buys.push({ player: lot.player, priceCr: lot.bidCr });
    lot.phase = "sold";
    lot.holdMs = 0;
    this.soldCount += 1;
    this.totalSpendCr = round2(this.totalSpendCr + lot.bidCr);
    if (!this.biggestSale || lot.bidCr > this.biggestSale.priceCr) {
      this.biggestSale = { player: lot.player, priceCr: lot.bidCr, teamId: t.id };
    }
    this.events.push({ type: "sold", teamId: t.id, priceCr: lot.bidCr, player: lot.player });
    this.pushLog("sold", `SOLD — ${lot.player.name} to ${t.short} for ₹${lot.bidCr.toFixed(2)}cr`, t.id);
  }

  private resolveUnsold(): void {
    this.lot.phase = "unsold";
    this.lot.holdMs = 0;
    this.unsoldCount += 1;
    this.events.push({ type: "unsold", player: this.lot.player });
    this.pushLog("unsold", `UNSOLD — ${this.lot.player.name}`);
  }

  private advance(): void {
    if (this.lotIndex + 1 >= this.pool.length || this.teams.every((t) => t.slots <= 0)) {
      this.phase = "done";
      this.events.push({ type: "end" });
      this.pushLog("info", "The hammer falls on the last lot. Auction closed.");
      return;
    }
    this.lotIndex += 1;
    this.userPassed = false;
    this.userLotInterest = false;
    this.lastBidders = [];
    this.spoiled.clear();
    const prevSet = this.lot.set;
    this.lot = this.makeLot(this.lotIndex);
    if (this.lot.set !== prevSet) this.pushLog("info", `${this.lot.set} set begins.`);
    this.events.push({ type: "lot", player: this.lot.player });
  }

  /** Advance the simulation. dtMs is wall time; speed multiplies it. */
  tick(dtMs: number): void {
    if (this.phase === "done") return;
    const dt = dtMs * this.speed;
    const lot = this.lot;

    if (lot.phase === "sold" || lot.phase === "unsold") {
      lot.holdMs += dt;
      if (lot.holdMs >= 2000) this.advance();
      return;
    }

    if (lot.phase === "countdown") {
      lot.countdownMs -= dt;
      if (lot.countdownMs <= 0) this.resolveSold();
      return;
    }

    lot.idleMs += dt;

    // Rival paddles: active duelists counter first, challengers enter by headroom.
    const next = lot.leaderId ? nextBidCr(lot.bidCr) : lot.bidCr;
    for (const t of this.teams) {
      const cd = (this.cooldowns.get(t.id) ?? 0) - dt;
      this.cooldowns.set(t.id, cd > 0 ? cd : 0);
    }
    const eligible = this.teams.filter(
      (t) => !t.isUser && t.slots > 0 && t.id !== lot.leaderId && next <= t.purseCr + 1e-9
    );
    const caps = new Map(eligible.map((t) => [t.id, this.maxBidCr(t, lot.player)]));
    const ready = (t: EngineTeam) => (this.cooldowns.get(t.id) ?? 0) <= 0;
    const canPay = (t: EngineTeam) => next <= (caps.get(t.id) ?? 0) + 1e-9;

    let bidder: EngineTeam | null = null;
    const duelists = this.lastBidders
      .filter((id) => id !== lot.leaderId)
      .map((id) => this.team(id))
      .filter((t) => eligible.includes(t));
    for (const t of duelists) {
      if (ready(t) && canPay(t)) { bidder = t; break; }
    }
    if (!bidder) {
      const challengers = eligible
        .filter((t) => !duelists.includes(t) && ready(t) && canPay(t))
        .sort((a, b) => (caps.get(b.id)! - next) - (caps.get(a.id)! - next));
      for (const t of challengers) {
        const ratio = next / Math.max(caps.get(t.id)!, 0.01);
        const base = ratio < 0.5 ? 0.9 : ratio < 0.8 ? 0.6 : 0.35;
        // Low-impact names draw few paddles — many go unsold at base, like real auctions.
        const interest = lot.player.impact >= 50 ? 1 : lot.player.impact >= 40 ? 0.55 : 0.3;
        const p = Math.min(0.95, base * STINGY.prob * (lot.leaderId ? 1 : interest));
        if (this.rng() < p) { bidder = t; break; }
        this.cooldowns.set(t.id, (400 + this.rng() * 800) * STINGY.cool);
      }
    }
    // Strategic spoiling: a rich, saturated rival may tax-bid a purse-strapped leader once per lot.
    if (!bidder && lot.leaderId) {
      const leader = this.team(lot.leaderId);
      if (leader.purseCr < 0.25 * leader.initialPurseCr) {
        for (const t of eligible) {
          const cap = caps.get(t.id)!;
          if (!ready(t) || this.spoiled.has(t.id) || t.purseCr <= 30) continue;
          if (next > cap && next <= cap * 1.15 && this.startersInRole(t, lot.player.role) >= 2 && this.rng() < 0.25) {
            bidder = t;
            this.spoiled.add(t.id);
            break;
          }
        }
      }
    }
    if (bidder) this.placeBid(bidder.id, next);

    if (lot.leaderId) {
      if (lot.idleMs > 2600) {
        lot.phase = "countdown";
        lot.countdownMs = 3000;
        this.events.push({ type: "countdown", teamId: lot.leaderId, priceCr: lot.bidCr });
      }
    } else if (lot.idleMs > 4200) {
      this.resolveUnsold();
    }
  }

  /** Run the rest of the auction instantly (user sits out). */
  finishNow(): void {
    let guard = 0;
    while (this.phase === "live" && guard < 50000) {
      this.userPassed = true;
      this.tick(600);
      guard += 1;
    }
    this.drainEvents();
  }

  /** Post-auction verdict on the user's squad. */
  rateUserSquad(): {
    score: number;
    grade: string;
    bestBuy: SquadBuy | null;
    squadSize: number;
    overseas: number;
    uncapped: number;
  } {
    const u = this.user();
    const squad = [...u.retained, ...u.buys.map((b) => b.player)];
    const impact = squad.reduce((s, p) => s + p.impact, 0);
    const roles = new Set(squad.map((p) => p.role));
    const balance = roles.size * 4;
    const steals = u.buys.reduce((s, b) => s + Math.max(0, b.player.valueCr - b.priceCr), 0);
    const score = Math.max(
      5,
      Math.min(99, Math.round(impact / Math.max(1, squad.length) * 0.9 + balance + steals * 1.5))
    );
    const grade =
      score >= 85 ? "Title contenders" :
      score >= 70 ? "Playoff material" :
      score >= 55 ? "Mid-table scrap" :
      score >= 40 ? "Rebuild season" : "Wooden spoon";
    let bestBuy: SquadBuy | null = null;
    for (const b of u.buys) {
      if (!bestBuy || b.player.valueCr - b.priceCr > bestBuy.player.valueCr - bestBuy.priceCr) {
        bestBuy = b;
      }
    }
    return {
      score,
      grade,
      bestBuy,
      squadSize: squad.length,
      overseas: squad.filter((p) => p.overseas).length,
      uncapped: squad.filter((p) => p.uncapped).length,
    };
  }
}