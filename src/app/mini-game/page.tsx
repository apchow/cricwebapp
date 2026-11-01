"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const BEST_KEY = "crichub.streetstrike.best";
const LAST_KEY = "crichub.streetstrike.lastinnings";
const TOTAL_BALLS = 12;
const MAX_WICKETS = 2;
const GRACE_MS = 300;

type Point = { x: number; y: number };
type BallState = Point & { size: number };
type Tone = "six" | "four" | "run" | "dot" | "wicket";
type WicketKind = "bowled" | "lbw" | "caught" | "caught_behind";
type Phase = "idle" | "ready" | "delivery" | "shot" | "result" | "over";

const CX = 200;
const CY = 232;
const RX = 182;
const RY = 168;
const RELEASE: Point = { x: 200, y: 146 };
const BAT: Point = { x: 200, y: 314 };
const STUMPS: Point = { x: 200, y: 334 };
const KEEPER_POS: Point = { x: 200, y: 366 };
const PASS_POINT: Point = { x: 200, y: 331 };

const toRad = (value: number) => (value * Math.PI) / 180;
const toDeg = (value: number) => (value * 180) / Math.PI;
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const chance = (p: number) => Math.random() < p;

function ropeDistance(angle: number): number {
  const a = toRad(angle);
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const ex = BAT.x - CX;
  const ey = BAT.y - CY;
  const A = (dx * dx) / (RX * RX) + (dy * dy) / (RY * RY);
  const B = 2 * ((ex * dx) / (RX * RX) + (ey * dy) / (RY * RY));
  const C = (ex * ex) / (RX * RX) + (ey * ey) / (RY * RY) - 1;
  const disc = B * B - 4 * A * C;
  if (disc <= 0) return 60;
  return (-B + Math.sqrt(disc)) / (2 * A);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function fromBat(angle: number, dist: number): Point {
  const a = toRad(angle);
  return {
    x: clamp(BAT.x + Math.sin(a) * dist, 10, 390),
    y: clamp(BAT.y - Math.cos(a) * dist, 10, 400),
  };
}

function angleOf(p: Point): number {
  return toDeg(Math.atan2(p.x - BAT.x, BAT.y - p.y));
}

function wrapDelta(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

type DeliveryType = {
  id: string;
  name: string;
  phrase: string;
  emoji: string;
  ms: number;
  pitch: number;
  bounce: number;
  drift: number;
  turn: number;
  hint: string;
};

const DELIVERY_TYPES: DeliveryType[] = [
  {
    id: "pace",
    name: "Seam, good length",
    phrase: "the good length",
    emoji: "⚡",
    ms: 700,
    pitch: 0.62,
    bounce: 1,
    drift: 9,
    turn: 12,
    hint: "Carries on off the seam",
  },
  {
    id: "spin",
    name: "Off-spin, flighted",
    phrase: "the flighted delivery",
    emoji: "🌀",
    ms: 1050,
    pitch: 0.58,
    bounce: 0.8,
    drift: 17,
    turn: 26,
    hint: "Loops in the air, then turns away",
  },
  {
    id: "yorker",
    name: "Toe-crushing yorker",
    phrase: "the yorker",
    emoji: "🎯",
    ms: 620,
    pitch: 0.94,
    bounce: 0.4,
    drift: 5,
    turn: 7,
    hint: "Full and quick — dig it out",
  },
  {
    id: "bouncer",
    name: "Short ball, rears up",
    phrase: "the short ball",
    emoji: "💥",
    ms: 560,
    pitch: 0.74,
    bounce: 2.1,
    drift: 11,
    turn: -9,
    hint: "Rises off a length to the chest",
  },
];

function deliveryBallAt(type: DeliveryType, f: number): BallState {
  const p = Math.max(0, Math.min(1, f));
  const y = RELEASE.y + (BAT.y - RELEASE.y) * p;
  const pre = type.pitch > 0 ? Math.min(1, p / type.pitch) : 1;
  const post = p >= type.pitch ? Math.min(1, (p - type.pitch) / (1 - type.pitch)) : 0;
  const swingX = type.drift * Math.sin(Math.PI * pre * 0.6);
  const turnX = type.turn * post * post;
  const height = p <= type.pitch ? 1 - pre : type.bounce * Math.sin(Math.PI * post * 0.9);
  return { x: RELEASE.x + swingX + turnX, y, size: 3 + 2.5 * Math.max(0, height) };
}

type Fielder = { name: string; pos: Point; label: Point; angle: number };

const FIELDER_LAYOUT: { name: string; angle: number; frac: number }[] = [
  { name: "silly point", angle: 32, frac: 0.27 },
  { name: "gully", angle: 100, frac: 0.3 },
  { name: "cover", angle: 46, frac: 0.78 },
  { name: "mid-off", angle: 8, frac: 0.56 },
  { name: "long-off", angle: 26, frac: 0.96 },
  { name: "mid-wicket", angle: -14, frac: 0.56 },
  { name: "square leg", angle: -92, frac: 0.88 },
  { name: "long-on", angle: -28, frac: 0.96 },
  { name: "deep fine leg", angle: -136, frac: 0.92 },
];

const FIELDERS: Fielder[] = FIELDER_LAYOUT.map((item) => {
  const dist = ropeDistance(item.angle) * item.frac;
  const pos = fromBat(item.angle, dist);
  return {
    name: item.name,
    pos,
    label: fromBat(item.angle, Math.max(24, dist - 13)),
    angle: item.angle,
  };
});

const FIELDER_ANGLES = FIELDERS.map((f) => f.angle).sort((a, b) => a - b);

function nearestFielder(angle: number): Fielder {
  let best = FIELDERS[0];
  let bestDelta = Infinity;
  for (const f of FIELDERS) {
    const d = Math.abs(wrapDelta(angle, f.angle));
    if (d < bestDelta) {
      bestDelta = d;
      best = f;
    }
  }
  return best;
}

function gapAngle(preferred: number): number {
  let best = preferred;
  let bestDelta = Infinity;
  const count = FIELDER_ANGLES.length;
  for (let i = 0; i < count; i++) {
    const a = FIELDER_ANGLES[i];
    const b = FIELDER_ANGLES[(i + 1) % count];
    const mid = a + wrapDelta(a, b) / 2;
    const d = Math.abs(wrapDelta(preferred, mid));
    if (d < bestDelta) {
      bestDelta = d;
      best = mid;
    }
  }
  return best + wrapDelta(best, preferred) * 0.3;
}

const GULLY = FIELDERS.find((f) => f.name === "gully") ?? FIELDERS[0];
const KEEPER_FIELDER: Fielder = {
  name: "the keeper",
  pos: KEEPER_POS,
  label: KEEPER_POS,
  angle: angleOf(KEEPER_POS),
};

const BATTER_NAMES = ["A. Tharaka", "J. Pembroke", "M. Dane", "K. Osei"];
const BOWLER_NAMES = ["R. Vardhan", "S. Menon"];

type BatterRow = { name: string; runs: number; balls: number };
type Figures = { runs: number; wkts: number; balls: number };
type LogRow = { id: number; text: string; tone: Tone };
type StripRow = { id: number; label: string; tone: Tone };
type Banner = {
  id: number;
  headline: string;
  text: string;
  tone: Tone;
  dt: number | null;
};

type Innings = {
  phase: Phase;
  score: number;
  wickets: number;
  balls: number;
  batters: BatterRow[];
  striker: number;
  nonStriker: number;
  bowlerIndex: number;
  figures: Figures[];
  log: LogRow[];
  strip: StripRow[];
  banner: Banner | null;
};

function freshInnings(): Innings {
  return {
    phase: "ready",
    score: 0,
    wickets: 0,
    balls: 0,
    batters: [
      { name: BATTER_NAMES[0], runs: 0, balls: 0 },
      { name: BATTER_NAMES[1], runs: 0, balls: 0 },
    ],
    striker: 0,
    nonStriker: 1,
    bowlerIndex: 0,
    figures: BOWLER_NAMES.map(() => ({ runs: 0, wkts: 0, balls: 0 })),
    log: [],
    strip: [],
    banner: null,
  };
}

function initialInnings(): Innings {
  return { ...freshInnings(), phase: "idle" };
}

type Resolution = {
  runs: number;
  tone: Tone;
  headline: string;
  text: string;
  target: Point;
  loft: number;
  speed: number;
  wicket: WicketKind | null;
  catcher: string | null;
};

type Anim =
  | { kind: "delivery"; start: number; ms: number; type: DeliveryType }
  | { kind: "shot"; start: number; ms: number; from: Point; to: Point; loft: number };

function beatenResolution(
  dt: number | null,
  type: DeliveryType,
  striker: string,
  bowler: string
): Resolution {
  const silent = dt === null;
  const late = dt !== null && dt > 0;
  const side = dt === null ? (chance(0.5) ? -1 : 1) : dt < 0 ? -1 : 1;
  const miss = silent
    ? "plays and misses"
    : late
      ? "is slow off the mark and misses"
      : "gets right ahead of it and misses";
  const roll = Math.random();
  if (roll < 0.11) {
    return {
      runs: 0,
      tone: "wicket",
      headline: "BOWLED!",
      text: `${striker} ${miss} at ${type.phrase} — ${bowler} hits the base of timber!`,
      target: { x: STUMPS.x - 5, y: STUMPS.y + 9 },
      loft: 0.05,
      speed: 0.5,
      wicket: "bowled",
      catcher: null,
    };
  }
  if (roll < 0.2) {
    return {
      runs: 0,
      tone: "wicket",
      headline: "LBW!",
      text: `${striker} ${miss}, struck on the pad by ${type.phrase} and trapped in front. ${bowler} appeals and it is given.`,
      target: { x: BAT.x + side * 8, y: BAT.y + 14 },
      loft: 0.05,
      speed: 0.4,
      wicket: "lbw",
      catcher: null,
    };
  }
  return {
    runs: 0,
    tone: "dot",
    headline: silent ? "BEATEN" : "MISSED",
    text: silent
      ? `${striker} leaves ${type.phrase} alone — no bat, and it steams through to the keeper.`
      : `${striker} was ${late ? "a long way late" : "a long way early"} on ${type.phrase}, the ball runs through to the keeper. ${bowler} grins.`,
    target: KEEPER_POS,
    loft: 0.05,
    speed: 0.45,
    wicket: null,
    catcher: null,
  };
}

function edgeResolution(striker: string, bowler: string, type: DeliveryType): Resolution {
  const behind = chance(0.55);
  const catcher = behind ? KEEPER_FIELDER : GULLY;
  return {
    runs: 0,
    tone: "wicket",
    headline: behind ? "CAUGHT BEHIND!" : "EDGE TO GULLY!",
    text: `Thick edge off ${type.phrase} and ${catcher.name} takes a sharp chance. ${striker} walks, ${bowler} strikes.`,
    target: catcher.pos,
    loft: 0.3,
    speed: 0.34,
    wicket: behind ? "caught_behind" : "caught",
    catcher: catcher.name,
  };
}

function toFielderResolution(
  angle: number,
  striker: string,
  bowler: string,
  type: DeliveryType,
  single: boolean
): Resolution {
  const fielder = nearestFielder(angle);
  if (single) {
    const gap = gapAngle(angle);
    const dist = ropeDistance(gap) * rand(0.36, 0.6);
    return {
      runs: 1,
      tone: "run",
      headline: "1 RUN",
      text: `${striker} only gets the bat to ${type.phrase} but threads the gap at the ${sideName(gap)} for a single.`,
      target: fromBat(gap, dist),
      loft: 0.1,
      speed: 0.28,
      wicket: null,
      catcher: null,
    };
  }
  return {
    runs: 0,
    tone: "dot",
    headline: "DOT BALL",
    text: `${striker} offers no defence to ${type.phrase} — fielded easily at ${fielder.name}, no run.`,
    target: fielder.pos,
    loft: 0.08,
    speed: 0.32,
    wicket: null,
    catcher: fielder.name,
  };
}

function sideName(angle: number): string {
  return angle < 0 ? "leg side" : "off side";
}

// Delivery pace varies by up to 8% per ball, so a human-plausible window has to
// sit wider than the jitter or the sweet spot is unreachable.
const TIMING = { six: 60, four: 120, good: 185, ok: 250, loose: 320 } as const;

function decide(
  dt: number | null,
  type: DeliveryType,
  striker: string,
  bowler: string
): Resolution {
  if (dt === null) return beatenResolution(null, type, striker, bowler);
  const ad = Math.abs(dt);
  const side = dt < 0 ? -1 : 1;
  if (ad > TIMING.loose) return beatenResolution(dt, type, striker, bowler);

  if (ad <= TIMING.six) {
    const angle = side * rand(16, 74);
    const rope = ropeDistance(angle);
    const where = nearestFielder(angle).name;
    return {
      runs: 6,
      tone: "six",
      headline: "SIX!",
      text: `${striker} times ${type.phrase} to perfection and ${side < 0 ? "pulls" : "launches"} it high over ${where}. That is maximum!`,
      target: fromBat(angle, rope * rand(1.05, 1.2)),
      loft: 1,
      speed: 0.34,
      wicket: null,
      catcher: null,
    };
  }

  if (ad <= TIMING.four) {
    const angle = side * rand(8, 62);
    const rope = ropeDistance(angle);
    const where = nearestFielder(angle).name;
    return {
      runs: 4,
      tone: "four",
      headline: "FOUR!",
      text: `${striker} is bang on time, ${side < 0 ? "flicks it" : "drives it"} fine past ${where} and the ball races to the rope.`,
      target: fromBat(angle, rope * 0.99),
      loft: 0.12,
      speed: 0.46,
      wicket: null,
      catcher: null,
    };
  }

  if (ad <= TIMING.good) {
    const angle = gapAngle(side * rand(14, 70));
    const dist = ropeDistance(angle) * rand(0.52, 0.8);
    const three = chance(0.45);
    return {
      runs: three ? 3 : 2,
      tone: "run",
      headline: three ? "3 RUNS" : "2 RUNS",
      text: `Good weight of shot from ${striker}, into the gap at the ${sideName(angle)} — they come back for ${three ? "three" : "two"}.`,
      target: fromBat(angle, dist),
      loft: 0.18,
      speed: 0.34,
      wicket: null,
      catcher: null,
    };
  }

  if (ad <= TIMING.ok) {
    const angle = side * rand(38, 104);
    if (chance(0.6)) {
      const gap = gapAngle(angle);
      const dist = ropeDistance(gap) * rand(0.42, 0.68);
      return {
        runs: 1,
        tone: "run",
        headline: "1 RUN",
        text: `${striker} is a touch ${side < 0 ? "early" : "late"} on ${type.phrase}, worked into the ${sideName(gap)} for a single.`,
        target: fromBat(gap, dist),
        loft: 0.1,
        speed: 0.3,
        wicket: null,
        catcher: null,
      };
    }
    return toFielderResolution(angle, striker, bowler, type, false);
  }

  const roll = Math.random();
  if (roll < 0.12) return edgeResolution(striker, bowler, type);
  if (roll < 0.3) return toFielderResolution(side * rand(20, 90), striker, bowler, type, true);
  return toFielderResolution(side * rand(12, 84), striker, bowler, type, false);
}

function ratingFor(score: number) {
  if (score >= 34) return { title: "Match-Warming Masterclass", emoji: "👑" };
  if (score >= 24) return { title: "Top-Order Material", emoji: "🏏" };
  if (score >= 15) return { title: "Clean Strike, Good Game", emoji: "🥇" };
  if (score >= 8) return { title: "Grafting In The Middle", emoji: "🙂" };
  if (score >= 3) return { title: "Twitchy At The Crease", emoji: "🧢" };
  return { title: "Back To The Nets", emoji: "🎽" };
}

const TONE_HEADLINE: Record<Tone, string> = {
  six: "text-emerald-400 score-flash",
  four: "text-sky-400 score-flash",
  run: "text-white score-flash",
  dot: "text-slate-500",
  wicket: "text-red-400 wicket-shake",
};

const TONE_CHIP: Record<Tone, string> = {
  six: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300",
  four: "border-sky-500/50 bg-sky-500/15 text-sky-300",
  run: "border-indigo-400/50 bg-indigo-500/15 text-indigo-200",
  dot: "border-slate-700/70 bg-slate-800/50 text-slate-400",
  wicket: "border-red-500/50 bg-red-500/15 text-red-300",
};

const TONE_DOT: Record<Tone, string> = {
  six: "bg-emerald-400",
  four: "bg-sky-400",
  run: "bg-indigo-400",
  dot: "bg-slate-600",
  wicket: "bg-red-500",
};

const TRAIL_STROKE: Record<Tone, string> = {
  six: "#34d399",
  four: "#38bdf8",
  run: "#a5b4fc",
  dot: "#94a3b8",
  wicket: "#f87171",
};

const BANDS: { range: string; text: string; tone: Tone }[] = [
  {
    range: `within ${TIMING.six}ms`,
    text: "SIX — the ball is struck on the up",
    tone: "six",
  },
  {
    range: `within ${TIMING.four}ms`,
    text: "FOUR — timed to the boundary",
    tone: "four",
  },
  {
    range: `within ${TIMING.good}ms`,
    text: "2 or 3 runs into a gap",
    tone: "run",
  },
  {
    range: `within ${TIMING.ok}ms`,
    text: "a push for one, or a dot",
    tone: "run",
  },
  {
    range: `within ${TIMING.loose}ms`,
    text: "loose — mostly a dot, edge risk",
    tone: "dot",
  },
  { range: "late or no swing", text: "beaten — bowled, LBW or behind", tone: "wicket" },
];

function oversText(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function readItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

export default function MiniGamePage() {
  const [game, setGame] = useState<Innings>(initialInnings);
  const gameRef = useRef<Innings>(game);
  const [best, setBest] = useState(0);
  const [lastInnings, setLastInnings] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [ballPos, setBallPos] = useState<BallState | null>(null);
  const [trail, setTrail] = useState<Point[]>([]);
  const [pitchMark, setPitchMark] = useState<BallState | null>(null);
  const [bailFly, setBailFly] = useState(false);
  const [catchMark, setCatchMark] = useState<
    { x: number; y: number; name: string; out: boolean } | null
  >(null);
  const [delivery, setDelivery] = useState<DeliveryType | null>(null);

  const ballRef = useRef<BallState | null>(null);
  const trailRef = useRef<Point[]>([]);
  const animRef = useRef<Anim | null>(null);
  const rafRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contactRef = useRef(0);
  const committedRef = useRef(true);
  const pitchRef = useRef<BallState | null>(null);
  const pendingRef = useRef<Resolution | null>(null);
  const pendingDtRef = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(true);
  const bestRef = useRef(0);
  const prevTypeIdRef = useRef("");
  const idRef = useRef(0);

  const nextId = () => {
    idRef.current += 1;
    return idRef.current;
  };

  const patch = useCallback((next: Partial<Innings>) => {
    const merged = { ...gameRef.current, ...next };
    gameRef.current = merged;
    setGame(merged);
    return merged;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const raw = readItem(BEST_KEY);
    const saved = raw === null ? 0 : Number(raw);
    if (Number.isFinite(saved) && saved > 0) {
      bestRef.current = saved;
      setBest(saved);
    }
    const last = readItem(LAST_KEY);
    if (last) setLastInnings(last);
  }, []);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    if (game.phase === "ready" || game.phase === "idle") {
      const rest = deliveryBallAt(DELIVERY_TYPES[0], 0);
      ballRef.current = rest;
      setBallPos(rest);
    }
  }, [game.phase]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
      const ctx = audioRef.current;
      audioRef.current = null;
      if (ctx) void ctx.close();
    };
  }, []);

  const playKnock = useCallback(() => {
    if (mutedRef.current) return;
    let ctx = audioRef.current;
    if (!ctx) {
      if (typeof AudioContext === "undefined") return;
      try {
        ctx = new AudioContext();
        audioRef.current = ctx;
      } catch {
        return;
      }
    }
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(96, t + 0.09);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }, []);

  const closeInnings = useCallback((final: Innings) => {
    const rating = ratingFor(final.score);
    const summary = `${final.score}/${final.wickets} from ${oversText(final.balls)} balls — ${rating.title}`;
    saveItem(LAST_KEY, summary);
    setLastInnings(summary);
    const nextBest = Math.max(bestRef.current, final.score);
    bestRef.current = nextBest;
    setBest(nextBest);
    saveItem(BEST_KEY, String(nextBest));
  }, []);

  const finishShot = useCallback(() => {
    const res = pendingRef.current;
    if (!res) return;
    pendingRef.current = null;
    animRef.current = null;
    const g = gameRef.current;
    const balls = g.balls + 1;
    const score = g.score + res.runs;
    const wickets = g.wickets + (res.wicket ? 1 : 0);
    const batters = g.batters.map((b, i) =>
      i === g.striker ? { ...b, runs: b.runs + res.runs, balls: b.balls + 1 } : b
    );
    let striker = g.striker;
    let nonStriker = g.nonStriker;
    const extra: string[] = [];

    if (res.wicket) {
      if (balls < TOTAL_BALLS && wickets < MAX_WICKETS) {
        const incoming: BatterRow = {
          name: BATTER_NAMES[Math.min(batters.length, BATTER_NAMES.length - 1)],
          runs: 0,
          balls: 0,
        };
        batters.push(incoming);
        striker = batters.length - 1;
        extra.push(`${incoming.name} walks in at ${score}/${wickets}.`);
      }
    } else if (res.runs % 2 === 1) {
      const swap = striker;
      striker = nonStriker;
      nonStriker = swap;
    }

    const bowlerIndex = Math.min(BOWLER_NAMES.length - 1, Math.floor(balls / 6));
    const overDone = balls % 6 === 0 && balls < TOTAL_BALLS;
    if (overDone) {
      const swap = striker;
      striker = nonStriker;
      nonStriker = swap;
      extra.push(`End of over ${balls / 6} — strike rotated, ${BOWLER_NAMES[bowlerIndex]} to operate.`);
    }

    const closed = balls >= TOTAL_BALLS || wickets >= MAX_WICKETS;
    const bowledBy = Math.min(BOWLER_NAMES.length - 1, Math.floor(g.balls / 6));
    const figures = g.figures.map((f, i) =>
      i === bowledBy
        ? { runs: f.runs + res.runs, wkts: f.wkts + (res.wicket ? 1 : 0), balls: f.balls + 1 }
        : f
    );
    const chipLabel =
      res.tone === "wicket" ? "W" : res.tone === "dot" ? "•" : String(res.runs);
    const feed: LogRow[] = [res.text, ...extra]
      .reverse()
      .map((text) => ({ id: nextId(), text, tone: res.tone }));

    if (res.wicket === "bowled") setBailFly(true);
    if (res.catcher)
      setCatchMark({
        x: res.target.x,
        y: res.target.y,
        name: res.catcher,
        out: res.wicket !== null,
      });

    const next: Innings = {
      ...g,
      phase: closed ? "over" : "result",
      score,
      wickets,
      balls,
      batters,
      striker,
      nonStriker,
      bowlerIndex,
      figures,
      banner: {
        id: nextId(),
        headline: res.headline,
        text: res.text,
        tone: res.tone,
        dt: pendingDtRef.current,
      },
      log: [...feed, ...g.log].slice(0, 6),
      strip: [...g.strip, { id: nextId(), label: chipLabel, tone: res.tone }],
    };

    setBallPos({ ...res.target, size: 3 });
    ballRef.current = { ...res.target, size: 3 };
    patch(next);

    if (closed) {
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        closeInnings(next);
      }, 700);
    } else {
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        patch({ phase: "ready" });
      }, res.wicket ? 1500 : 1000);
    }
  }, [clearTimer, closeInnings, patch]);

  const resolveOutcome = useCallback(
    (dt: number | null) => {
      const g = gameRef.current;
      if (committedRef.current || g.phase !== "delivery") return;
      committedRef.current = true;
      pendingDtRef.current = dt;
      const type = delivery ?? DELIVERY_TYPES[0];
      const strikerName = g.batters[g.striker]?.name ?? BATTER_NAMES[0];
      const bowlerName = BOWLER_NAMES[g.bowlerIndex] ?? BOWLER_NAMES[0];
      const res = decide(dt, type, strikerName, bowlerName);
      const from = ballRef.current ?? BAT;
      const dist = Math.hypot(res.target.x - from.x, res.target.y - from.y);
      const ms = Math.max(240, dist / res.speed);
      trailRef.current = [];
      setTrail([]);
      if (dt !== null && Math.abs(dt) <= TIMING.loose) playKnock();
      animRef.current = {
        kind: "shot",
        start: performance.now(),
        ms,
        from: { x: from.x, y: from.y },
        to: res.target,
        loft: res.loft,
      };
      pendingRef.current = res;
      patch({ phase: "shot" });
    },
    [delivery, patch, playKnock]
  );

  const bowlNext = useCallback(() => {
    const p = gameRef.current.phase;
    if (p !== "ready" && p !== "result") return;
    clearTimer();
    let index = Math.floor(Math.random() * DELIVERY_TYPES.length);
    if (DELIVERY_TYPES[index].id === prevTypeIdRef.current) {
      index = (index + 1 + Math.floor(Math.random() * 3)) % DELIVERY_TYPES.length;
    }
    const type = DELIVERY_TYPES[index];
    prevTypeIdRef.current = type.id;
    const ms = Math.round(type.ms * rand(0.95, 1.08));
    const start = performance.now();
    const first = deliveryBallAt(type, 0);
    contactRef.current = start + ms;
    committedRef.current = false;
    pendingRef.current = null;
    pendingDtRef.current = null;
    pitchRef.current = null;
    trailRef.current = [];
    setTrail([]);
    setPitchMark(null);
    setBailFly(false);
    setCatchMark(null);
    setDelivery(type);
    ballRef.current = first;
    setBallPos(first);
    animRef.current = { kind: "delivery", start, ms, type };
    patch({ phase: "delivery", banner: null });
  }, [clearTimer, patch]);

  const startInnings = useCallback(() => {
    clearTimer();
    animRef.current = null;
    committedRef.current = true;
    pendingRef.current = null;
    pitchRef.current = null;
    trailRef.current = [];
    setTrail([]);
    setPitchMark(null);
    setBailFly(false);
    setCatchMark(null);
    setDelivery(null);
    patch(freshInnings());
  }, [clearTimer, patch]);

  const mainAction = useCallback(() => {
    const p = gameRef.current.phase;
    if (p === "idle" || p === "over") {
      startInnings();
      return;
    }
    if (p === "delivery") {
      resolveOutcome(performance.now() - contactRef.current);
      return;
    }
    if (p === "shot") {
      finishShot();
      return;
    }
    if (p === "ready" || p === "result") bowlNext();
  }, [bowlNext, finishShot, resolveOutcome, startInnings]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      event.preventDefault();
      mainAction();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mainAction]);

  useEffect(() => {
    const onHide = () => {
      if (!document.hidden) return;
      animRef.current = null;
      committedRef.current = true;
      if (pendingRef.current) {
        finishShot();
        return;
      }
      clearTimer();
      if (gameRef.current.phase === "delivery") patch({ phase: "ready" });
      ballRef.current = null;
      setBallPos(null);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [clearTimer, finishShot, patch]);

  // The ball position is rAF-driven state, not CSS keyframes, so the delivery
  // timing stays in step with performance.now(); the loop dies with the phase.
  useEffect(() => {
    if (game.phase !== "delivery" && game.phase !== "shot") return;

    const step = (now: number) => {
      const anim = animRef.current;
      if (!anim) return;

      if (anim.kind === "delivery") {
        const elapsed = now - anim.start;
        if (elapsed < anim.ms) {
          const f = elapsed / anim.ms;
          const at = deliveryBallAt(anim.type, f);
          ballRef.current = at;
          setBallPos(at);
          if (f >= anim.type.pitch && !pitchRef.current) {
            const mark = deliveryBallAt(anim.type, anim.type.pitch);
            pitchRef.current = mark;
            setPitchMark(mark);
          }
        } else {
          const u = Math.min((elapsed - anim.ms) / (anim.ms * 0.45), 1);
          const at = {
            x: BAT.x + (PASS_POINT.x - BAT.x) * u,
            y: BAT.y + (PASS_POINT.y - BAT.y) * u,
            size: 3.1,
          };
          ballRef.current = at;
          setBallPos(at);
          if (elapsed - anim.ms >= GRACE_MS) {
            resolveOutcome(null);
            return;
          }
        }
      } else {
        const u = Math.min((now - anim.start) / anim.ms, 1);
        const k = Math.pow(u, 0.72);
        const at = {
          x: anim.from.x + (anim.to.x - anim.from.x) * k,
          y: anim.from.y + (anim.to.y - anim.from.y) * k,
          size: 2.9 + anim.loft * 3.4 * Math.sin(Math.PI * u),
        };
        ballRef.current = at;
        setBallPos(at);
        const last = trailRef.current[trailRef.current.length - 1];
        if (!last || Math.hypot(last.x - at.x, last.y - at.y) > 4) {
          trailRef.current = [...trailRef.current.slice(-80), at];
          setTrail(trailRef.current);
        }
        if (u >= 1) {
          finishShot();
          return;
        }
      }
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [finishShot, game.phase, resolveOutcome]);

  const striker = game.batters[game.striker] ?? game.batters[0];
  const nonStriker = game.batters[game.nonStriker] ?? game.batters[1];
  const ballsLeft = Math.max(0, TOTAL_BALLS - game.balls);
  const runRate = game.balls > 0 ? (game.score / game.balls) * 6 : 0;
  const bowlerIndex = clamp(game.bowlerIndex, 0, BOWLER_NAMES.length - 1);
  const bowlerName = BOWLER_NAMES[bowlerIndex] ?? BOWLER_NAMES[0];
  const figures = game.figures[bowlerIndex] ?? { runs: 0, wkts: 0, balls: 0 };
  const economy = figures.balls > 0 ? (figures.runs / figures.balls) * 6 : 0;
  const rating = ratingFor(game.score);
  const live = game.phase === "delivery" || game.phase === "shot";
  const banner = game.banner;
  const showEnd = game.phase === "over";
  const buttonLabel =
    game.phase === "idle" || game.phase === "over"
      ? "Take strike"
      : game.phase === "ready"
        ? "Bowl delivery"
        : game.phase === "delivery"
          ? "Play the shot"
          : game.phase === "shot"
            ? "Ball in play"
            : "Next ball";
  const buttonDisabled = game.phase === "shot";
  const trailTone: Tone = pendingRef.current?.tone ?? banner?.tone ?? "dot";

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 left-1/4 w-[520px] h-[520px] bg-emerald-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] bg-sky-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/80 mb-2">
              Mini Game
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-emerald-300 via-teal-200 to-sky-300 bg-clip-text text-transparent">
              Pitch Perfect
            </h1>
            <p className="text-slate-400 mt-2 max-w-md">
              Two overs, two wickets, one field. Read the delivery off the pitch
              and time the swing — the timing window is cruelly small.
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            ← Back to hub
          </Link>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_330px] gap-6 items-start">
          <div className="glass rounded-3xl p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold">
                  {game.phase === "delivery" ? "Delivery incoming" : "Bowling"}
                </div>
                <div className="font-bold text-base sm:text-lg leading-tight">
                  {delivery ? `${delivery.emoji} ${delivery.name}` : `${bowlerName} • ${oversText(game.balls)} overs`}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {delivery ? delivery.hint : "Press Space or the button to bowl."}
                </div>
              </div>
              <button
                onClick={() => setMuted((prev) => !prev)}
                aria-label={muted ? "Turn bat sound on" : "Mute bat sound"}
                className="shrink-0 rounded-lg border border-slate-700/70 bg-slate-900/60 px-2.5 py-1.5 text-xs font-bold text-slate-300 hover:text-white transition-colors"
              >
                {muted ? "🔇 Sound off" : "🔊 Sound on"}
              </button>
            </div>

            <div className="relative">
              <svg
                viewBox="0 0 400 408"
                className="w-full h-auto block select-none rounded-2xl"
                role="img"
                aria-label="Top-down view of a cricket ground with fielders, pitch and bat"
              >
                <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="#0a3a24" stroke="#dcfce7" strokeOpacity={0.55} strokeWidth={2.5} />
                <ellipse cx={CX} cy={CY} rx={RX - 9} ry={RY - 9} fill="#0d4a2e" />
                <ellipse cx={CX} cy={CY} rx={RX * 0.74} ry={RY * 0.74} fill="#0a3a24" />
                <ellipse cx={CX} cy={CY} rx={RX * 0.5} ry={RY * 0.5} fill="#0d4a2e" />
                <ellipse cx={CX} cy={CY} rx={RX * 0.62} ry={RY * 0.62} fill="none" stroke="#f8fafc" strokeOpacity={0.13} strokeWidth={1} strokeDasharray="6 8" />

                <rect x={185} y={138} width={30} height={196} fill="#c3a377" stroke="#8b6f4b" strokeWidth={1} />
                <line x1={186} y1={152} x2={214} y2={152} stroke="#f8fafc" strokeOpacity={0.8} strokeWidth={1.3} />
                <line x1={186} y1={163} x2={214} y2={163} stroke="#f8fafc" strokeOpacity={0.6} strokeWidth={1.1} />
                <line x1={186} y1={323} x2={214} y2={323} stroke="#f8fafc" strokeOpacity={0.8} strokeWidth={1.3} />
                <line x1={186} y1={334} x2={214} y2={334} stroke="#f8fafc" strokeOpacity={0.6} strokeWidth={1.1} />
                <line x1={191} y1={152} x2={191} y2={172} stroke="#f8fafc" strokeOpacity={0.45} strokeWidth={1} />
                <line x1={209} y1={152} x2={209} y2={172} stroke="#f8fafc" strokeOpacity={0.45} strokeWidth={1} />
                <line x1={191} y1={314} x2={191} y2={334} stroke="#f8fafc" strokeOpacity={0.45} strokeWidth={1} />
                <line x1={209} y1={314} x2={209} y2={334} stroke="#f8fafc" strokeOpacity={0.45} strokeWidth={1} />
                <line x1={200} y1={100} x2={200} y2={140} stroke="#f8fafc" strokeOpacity={0.18} strokeWidth={3} strokeDasharray="4 6" />

                <g className={bailFly ? "wicket-shake" : undefined}>
                  {[194, 200, 206].map((sx) => (
                    <rect key={sx} x={sx - 1} y={327} width={2} height={13} rx={1} fill="#f8fafc" />
                  ))}
                </g>
                <rect
                  x={193.6}
                  y={325.4}
                  width={5.6}
                  height={1.8}
                  rx={0.9}
                  fill="#e2e8f0"
                  opacity={bailFly ? 0.45 : 1}
                  style={{
                    transform: bailFly ? "translate(-12px, -17px)" : "translate(0px, 0px)",
                    transition: "transform 700ms ease-out, opacity 900ms ease-out",
                  }}
                />
                <rect
                  x={200.8}
                  y={325.4}
                  width={5.6}
                  height={1.8}
                  rx={0.9}
                  fill="#e2e8f0"
                  opacity={bailFly ? 0.45 : 1}
                  style={{
                    transform: bailFly ? "translate(13px, -14px)" : "translate(0px, 0px)",
                    transition: "transform 700ms ease-out, opacity 900ms ease-out",
                  }}
                />

                <circle cx={207} cy={170} r={3.2} fill="#94a3b8" />
                <circle cx={RELEASE.x} cy={RELEASE.y - 6} r={3.4} fill="#38bdf8" />
                <circle cx={211} cy={320} r={3.6} fill="#f8fafc" />
                <circle cx={211} cy={320} r={6} fill="none" stroke="#34d399" strokeOpacity={0.8} strokeWidth={1.2} />
                <line x1={216} y1={310} x2={220} y2={325} stroke="#e2e8f0" strokeWidth={2.2} strokeLinecap="round" />

                {FIELDERS.map((f) => (
                  <g key={f.name}>
                    <circle cx={f.pos.x} cy={f.pos.y} r={3} fill="#e2e8f0" opacity={0.92} />
                    <text
                      x={f.label.x}
                      y={f.label.y}
                      fontSize={6.2}
                      textAnchor="middle"
                      fill="#cbd5e1"
                      opacity={0.62}
                      style={{ letterSpacing: "0.04em" }}
                    >
                      {f.name}
                    </text>
                  </g>
                ))}
                <circle cx={KEEPER_POS.x} cy={KEEPER_POS.y} r={3} fill="#fbbf24" />
                <text x={KEEPER_POS.x + 15} y={KEEPER_POS.y + 2} fontSize={6.2} textAnchor="middle" fill="#cbd5e1" opacity={0.62}>
                  keeper
                </text>

                {pitchMark && (
                  <g>
                    <ellipse cx={pitchMark.x} cy={pitchMark.y} rx={7} ry={3} fill="none" stroke="#fcd34d" strokeOpacity={0.9} strokeWidth={1.2} />
                    <line x1={pitchMark.x} y1={pitchMark.y - 6} x2={pitchMark.x} y2={pitchMark.y - 1.5} stroke="#fcd34d" strokeOpacity={0.6} strokeWidth={1} />
                  </g>
                )}

                {trail.length > 1 && (
                  <polyline
                    points={trail.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
                    fill="none"
                    stroke={TRAIL_STROKE[trailTone]}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    className={
                      game.phase === "shot"
                        ? "opacity-80 transition-opacity duration-700"
                        : "opacity-0 transition-opacity duration-700"
                    }
                  />
                )}

                {catchMark && (
                  <g className="animate-pulse-slow">
                    <circle
                      cx={catchMark.x}
                      cy={catchMark.y}
                      r={9}
                      fill="none"
                      stroke={catchMark.out ? "#f87171" : "#64748b"}
                      strokeWidth={1.6}
                    />
                    <text
                      x={clamp(catchMark.x, 34, 366)}
                      y={clamp(catchMark.y - 13, 14, 400)}
                      fontSize={6.4}
                      textAnchor="middle"
                      fill={catchMark.out ? "#fca5a5" : "#94a3b8"}
                    >
                      {catchMark.name}
                    </text>
                  </g>
                )}

                {ballPos && (
                  <g>
                    <ellipse cx={ballPos.x} cy={ballPos.y + ballPos.size * 0.9} rx={ballPos.size * 0.9} ry={ballPos.size * 0.4} fill="#020617" opacity={0.35} />
                    <circle cx={ballPos.x} cy={ballPos.y} r={ballPos.size} fill="#dc2626" stroke="#f8fafc" strokeWidth={0.7} />
                  </g>
                )}
              </svg>

              {live && (
                <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-300/80">
                  ball in flight
                </div>
              )}
            </div>

            <div className="h-[86px] sm:h-20 flex flex-col items-center justify-center text-center mt-2">
              {banner ? (
                <div key={banner.id} className="animate-slide-up">
                  <div className={`text-3xl sm:text-4xl font-black tracking-tight ${TONE_HEADLINE[banner.tone]}`}>
                    {banner.headline}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    {banner.dt === null
                      ? "no swing offered"
                      : `${banner.dt > 0 ? "+" : ""}${Math.round(banner.dt)}ms — ${Math.abs(banner.dt) <= 190 ? (banner.dt < 0 ? "early, leg side" : "late, off side") : "well outside the window"}`}
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-xs uppercase tracking-[0.2em] font-bold">
                  {game.phase === "delivery"
                    ? "watch the release"
                    : game.phase === "shot"
                      ? "shot away"
                      : `Ball ${Math.min(game.balls + 1, TOTAL_BALLS)} of ${TOTAL_BALLS}`}
                </p>
              )}
            </div>

            {showEnd ? (
              <div className="text-center animate-bounce-in border-t border-slate-700/50 pt-5">
                <div className="text-5xl mb-2">{rating.emoji}</div>
                <div className="text-sm uppercase tracking-widest text-slate-500 font-bold mb-1">
                  {game.wickets >= MAX_WICKETS && game.balls < TOTAL_BALLS
                    ? "Innings folded for 2"
                    : "Innings complete"}
                </div>
                <div className="text-5xl font-black mb-1">
                  {game.score}
                  <span className="text-2xl text-slate-400 font-bold">/{game.wickets}</span>
                </div>
                <div className="text-base text-emerald-300 font-semibold mb-1">{rating.title}</div>
                <div className="text-sm text-slate-400 mb-4">
                  {game.batters.map((b) => `${b.name} ${b.runs}(${b.balls})`).join(" • ")}
                </div>
                <div className="text-xs text-slate-500 mb-5">
                  Personal best {best}
                  {lastInnings ? ` • Last innings ${lastInnings}` : ""}
                </div>
                <button
                  onClick={startInnings}
                  className="rounded-xl px-8 py-3.5 font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-[1.03] active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/25"
                >
                  Bat again
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 border-t border-slate-700/50 pt-4">
                <button
                  onClick={mainAction}
                  disabled={buttonDisabled}
                  className={`w-full sm:w-80 rounded-2xl py-5 text-lg sm:text-xl font-black uppercase tracking-widest transition-all ${
                    buttonDisabled
                      ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                      : game.phase === "delivery"
                        ? "bg-gradient-to-r from-orange-500 to-red-500 hover:scale-[1.02] active:scale-[0.97] shadow-lg shadow-orange-500/25"
                        : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-[1.02] active:scale-[0.97] shadow-lg shadow-emerald-500/25"
                  }`}
                >
                  {buttonLabel}
                </button>
                <p className="text-xs text-slate-500 text-center">
                  {game.phase === "idle"
                    ? "Take strike to start the innings"
                    : "or press "}
                  {game.phase !== "idle" && (
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono">
                      Space
                    </kbd>
                  )}
                </p>
              </div>
            )}

            <div className="mt-5 flex items-center gap-1.5 flex-wrap justify-center">
              {Array.from({ length: TOTAL_BALLS }).map((_, index) => {
                const chip = game.strip[index];
                const active = index === game.balls && !showEnd;
                return (
                  <div
                    key={index}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold border transition-all ${
                      chip
                        ? TONE_CHIP[chip.tone]
                        : active
                          ? "border-emerald-400/70 bg-emerald-400/10 text-emerald-300"
                          : "border-slate-800/60 bg-slate-900/40 text-slate-700"
                    } ${index === 6 ? "ml-3" : ""}`}
                  >
                    {chip ? chip.label : index + 1}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Score" value={`${game.score}/${game.wickets}`} accent="text-emerald-400" />
              <Stat label="Balls left" value={String(ballsLeft)} accent="text-sky-300" />
              <Stat label="Overs" value={`${oversText(game.balls)} / 2.0`} />
              <Stat label="Run rate" value={runRate.toFixed(2)} accent="text-orange-300" />
            </div>

            <div className="glass rounded-2xl p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold mb-2">
                At the crease
              </div>
              <BatRow row={striker} onStrike />
              <BatRow row={nonStriker} />
            </div>

            <div className="glass rounded-2xl p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold mb-1">
                Bowling
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-bold">{bowlerName}</span>
                <span className="font-mono text-sm text-slate-300">
                  {oversText(figures.balls)}-{figures.runs}-{figures.wkts}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Economy {economy.toFixed(2)} • {MAX_WICKETS} wickets available
              </div>
            </div>

            <div className="glass rounded-2xl p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold mb-2">
                Commentary
              </div>
              {game.log.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {game.phase === "idle" || game.phase === "ready"
                    ? "Awaiting the first delivery."
                    : "Ball in play."}
                </p>
              ) : (
                <ul className="space-y-2">
                  {game.log.map((entry) => (
                    <li key={entry.id} className="flex gap-2 text-xs leading-snug text-slate-300">
                      <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[entry.tone]}`} />
                      <span>{entry.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold">
                  Timing bands
                </span>
                <span className="text-[10px] font-mono text-slate-500">best {best}</span>
              </div>
              <ul className="space-y-1.5">
                {BANDS.map((band) => (
                  <li key={band.range} className="flex items-start gap-2 text-[11px] text-slate-400">
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[band.tone]}`} />
                    <span>
                      <span className="font-mono text-slate-200">{band.range}</span> — {band.text}
                    </span>
                  </li>
                ))}
              </ul>
              {lastInnings && (
                <div className="mt-3 pt-3 border-t border-slate-700/50 text-[11px] text-slate-500">
                  Last innings: <span className="text-slate-300">{lastInnings}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = "text-white",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="glass rounded-xl px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold">
        {label}
      </div>
      <div className={`text-xl sm:text-2xl font-black font-mono ${accent}`}>{value}</div>
    </div>
  );
}

function BatRow({ row, onStrike = false }: { row: BatterRow; onStrike?: boolean }) {
  const strike =
    row.balls > 0 ? Math.round((row.runs / row.balls) * 100) : 0;
  return (
    <div className="flex items-center justify-between gap-2 text-sm py-0.5">
      <span className="flex items-center gap-2 min-w-0">
        <span className={onStrike ? "text-emerald-400" : "text-slate-600"}>
          {onStrike ? "🏏" : "·"}
        </span>
        <span className={`truncate ${onStrike ? "text-white font-semibold" : "text-slate-400"}`}>
          {row.name}
        </span>
      </span>
      <span className="font-mono text-xs text-slate-300 shrink-0">
        {row.runs}({row.balls})
        <span className="text-slate-600 ml-2">{strike}</span>
      </span>
    </div>
  );
}
