"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Home,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { readLocal, writeLocal } from "@/lib/client";
import { oversString } from "@/lib/scoring";
import { isMuted, setMuted, sfx, unlockAudio } from "@/lib/game-sound";

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */

const BEST_KEY = "pavilion.streetsrike.best";
const SCORES_KEY = "pavilion.streetsrike.scores";
const MODE_KEY = "pavilion.streetsrike.mode";
const TOTAL_BALLS = 12;
const MAX_WICKETS = 2;
const BALLS_PER_OVER = 6;
const GRACE_MS = 300;

// Fixed logical drawing space; every frame is drawn here and scaled to fit.
const LOGICAL_W = 420;
const LOGICAL_H = 500;

const GROUND = { cx: 210, cy: 226, rx: 190, ry: 198 };
const RELEASE = { x: 210, y: 106 };
const CONTACT = { x: 210, y: 368 };
const KEEPER = { x: 210, y: 436 };
const STUMPS = { x: 210, y: 380 };
const GAUGE = { x0: 46, x1: 374, y: 456, h: 12 };

const STRIKER = { x: 191, y: 398, hands: { x: 197, y: 384 } };
const FIELDERS = [
  { x: 150, y: 300 },
  { x: 272, y: 300 },
  { x: 210, y: 176 },
  { x: 120, y: 226 },
  { x: 300, y: 226 },
];

const BATTERS = ["A. Tharaka", "J. Pembroke", "M. Dane", "K. Osei"];
const BOWLERS = ["R. Vardhan", "S. Menon"];

type Mode = "casual" | "street" | "pro";
const MODES: {
  id: Mode;
  label: string;
  blurb: string;
  sweetScale: number;
  flightScale: number;
}[] = [
  { id: "casual", label: "Casual", blurb: "Wide window, easy to time", sweetScale: 1.4, flightScale: 1.25 },
  { id: "street", label: "Street", blurb: "The proper test", sweetScale: 1, flightScale: 1 },
  { id: "pro", label: "Pro", blurb: "Razor-thin, no mercy", sweetScale: 0.7, flightScale: 0.82 },
];

function modeScale(mode: Mode) {
  return MODES.find((m) => m.id === mode) ?? MODES[1];
}

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

type Aim = -1 | 0 | 1;
type Phase = "idle" | "ready" | "delivery" | "shot" | "result" | "end";
type Tone = "six" | "four" | "run" | "dot" | "wicket";
type WicketKind = "Bowled" | "LBW" | "Caught";
type Point = { x: number; y: number };
type BallMark = Point & { size: number };

type BatterRow = { name: string; runs: number; balls: number };
type Figures = { runs: number; wkts: number; balls: number };
type LogRow = { id: number; text: string; tone: Tone };
type StripRow = { id: number; label: string; tone: Tone };
type Banner = { id: number; headline: string; text: string; tone: Tone; deltaMs: number | null };

type Innings = {
  phase: Phase;
  score: number;
  wickets: number;
  balls: number;
  streak: number;
  batters: BatterRow[];
  striker: number;
  nonStriker: number;
  bowlerIndex: number;
  figures: Figures[];
  log: LogRow[];
  strip: StripRow[];
  banner: Banner | null;
};

type Delivery = {
  start: number;
  flightMs: number;
  contactAt: number;
  sweetHalf: number;
};

type Outcome = {
  runs: number;
  wicket: WicketKind | null;
  tone: Tone;
  headline: string;
  text: string;
  target: Point;
  loft: number;
  speed: number;
};

type Anim =
  | { kind: "delivery"; start: number; ms: number }
  | { kind: "shot"; start: number; ms: number; from: Point; to: Point; loft: number };

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
  size: number;
  color: string;
};

type Floater = {
  x: number;
  y: number;
  text: string;
  color: string;
  born: number;
  life: number;
  size: number;
};

type Flash = { start: number; ms: number; color: string };

/* ------------------------------------------------------------------ *
 * Maths helpers
 * ------------------------------------------------------------------ */

const toRad = (deg: number) => (deg * Math.PI) / 180;
const rand = (min: number, max: number) => min + Math.random() * (max - min);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Distance from the bat to the glowing rope along a shot angle (0 = straight). */
function ropeDistance(deg: number): number {
  const a = toRad(deg);
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const ex = CONTACT.x - GROUND.cx;
  const ey = CONTACT.y - GROUND.cy;
  const A = (dx * dx) / (GROUND.rx * GROUND.rx) + (dy * dy) / (GROUND.ry * GROUND.ry);
  const B = 2 * ((ex * dx) / (GROUND.rx * GROUND.rx) + (ey * dy) / (GROUND.ry * GROUND.ry));
  const C = (ex * ex) / (GROUND.rx * GROUND.rx) + (ey * ey) / (GROUND.ry * GROUND.ry) - 1;
  const disc = B * B - 4 * A * C;
  if (disc <= 0) return 140;
  const t = (-B + Math.sqrt(disc)) / (2 * A);
  return t > 0 ? t : 140;
}

function shotTarget(deg: number, dist: number): Point {
  const a = toRad(deg);
  return { x: CONTACT.x + Math.sin(a) * dist, y: CONTACT.y - Math.cos(a) * dist };
}

/**
 * Ping-pong needle position in [-1, 1]. Crosses 0 upwards exactly at
 * `elapsed === 0`, which is the moment the ball reaches the bat.
 */
function needleAt(elapsed: number, half: number): number {
  const period = 4 * half;
  let u = elapsed % period;
  if (u < 0) u += period;
  if (u < half) return u / half;
  if (u < 3 * half) return 2 - u / half;
  return u / half - 4;
}

/** Difficulty ramps across the whole innings, then the mode scales the window. */
function difficultyAt(balls: number, mode: Mode) {
  const t = clamp(balls / (TOTAL_BALLS - 1), 0, 1);
  const scale = modeScale(mode);
  return {
    sweetHalf: (0.17 - 0.12 * t) * scale.sweetScale,
    flightMs: (1050 - 300 * t) * scale.flightScale,
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** A small stylised person: head + body capsule + two legs. */
function drawPerson(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  scale = 1
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - 12 * scale, 4.2 * scale, 0, Math.PI * 2);
  ctx.fill();
  roundRect(ctx, x - 3.4 * scale, y - 8 * scale, 6.8 * scale, 13 * scale, 3 * scale);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * scale;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 1.6 * scale, y + 5 * scale);
  ctx.lineTo(x - 3 * scale, y + 12 * scale);
  ctx.moveTo(x + 1.6 * scale, y + 5 * scale);
  ctx.lineTo(x + 3 * scale, y + 12 * scale);
  ctx.stroke();
}

/* ------------------------------------------------------------------ *
 * Outcome resolution
 * ------------------------------------------------------------------ */

function resolve(
  n: number | null,
  h: number,
  aim: Aim,
  striker: string,
  bowler: string
): Outcome {
  const aimText = aim < 0 ? "leg side" : aim > 0 ? "off side" : "straight";
  const baseAngle = aim < 0 ? -34 : aim > 0 ? 34 : 0;

  // No swing inside the window: the ball beats the bat.
  if (n === null) {
    const roll = Math.random();
    if (roll < 0.42) {
      return {
        runs: 0,
        wicket: "Bowled",
        tone: "wicket",
        headline: "BOWLED!",
        text: `${striker} plays all around it and ${bowler} rattles the timber.`,
        target: { x: STUMPS.x - 6, y: STUMPS.y + 8 },
        loft: 0.06,
        speed: 0.9,
      };
    }
    if (roll < 0.72) {
      return {
        runs: 0,
        wicket: "LBW",
        tone: "wicket",
        headline: "LBW!",
        text: `${striker} is beaten by ${bowler} and pinned in front — the finger goes up.`,
        target: { x: CONTACT.x - 12, y: CONTACT.y + 10 },
        loft: 0.05,
        speed: 0.7,
      };
    }
    return {
      runs: 0,
      wicket: null,
      tone: "dot",
      headline: "BEATEN",
      text: `${striker} plays and misses — ${bowler} zips it past the outside edge.`,
      target: KEEPER,
      loft: 0.05,
      speed: 0.8,
    };
  }

  const ad = Math.abs(n);
  const fourHalf = h + 0.055;
  const bigHalf = h + 0.15;
  const touchHalf = h + 0.3;

  if (ad <= h) {
    const angle = clamp(baseAngle + n * 70, -84, 84);
    const rope = ropeDistance(angle);
    return {
      runs: 6,
      wicket: null,
      tone: "six",
      headline: "SIX!",
      text: `Middle of the bat — ${striker} launches it clean over the ${aimText} boundary. Maximum!`,
      target: shotTarget(angle, rope * rand(1.05, 1.16)),
      loft: 1,
      speed: 0.42,
    };
  }

  if (ad <= fourHalf) {
    const angle = clamp(baseAngle + n * 62, -80, 80);
    return {
      runs: 4,
      wicket: null,
      tone: "four",
      headline: "FOUR!",
      text: `${striker} threads the gap on the ${aimText} and the ball beats the rope.`,
      target: shotTarget(angle, ropeDistance(angle) * 0.99),
      loft: 0.14,
      speed: 0.5,
    };
  }

  if (ad <= bigHalf) {
    const angle = clamp(baseAngle + n * 55, -78, 78);
    const rope = ropeDistance(angle);
    const three = Math.random() < 0.45;
    return {
      runs: three ? 3 : 2,
      wicket: null,
      tone: "run",
      headline: three ? "3 RUNS" : "2 RUNS",
      text: `Good contact from ${striker}, worked into the ${aimText} — they scamper back for ${three ? "three" : "two"}.`,
      target: shotTarget(angle, rope * (three ? 0.82 : 0.64)),
      loft: 0.18,
      speed: 0.4,
    };
  }

  if (ad <= touchHalf) {
    const angle = clamp(baseAngle + n * 50, -76, 76);
    if (Math.random() < 0.62) {
      return {
        runs: 1,
        wicket: null,
        tone: "run",
        headline: "1 RUN",
        text: `${striker} pushes into the ${aimText} for a quick single.`,
        target: shotTarget(angle, ropeDistance(angle) * 0.44),
        loft: 0.1,
        speed: 0.34,
      };
    }
    return {
      runs: 0,
      wicket: null,
      tone: "dot",
      headline: "DOT BALL",
      text: `${striker} mistimes it to the fielder on the ${aimText}. No run.`,
      target: shotTarget(angle, ropeDistance(angle) * 0.4),
      loft: 0.08,
      speed: 0.36,
    };
  }

  // Badly mistimed: the further out on the gauge, the worse it gets.
  const roll = Math.random();
  const risk = aim === 0 ? 0.42 : 0.56;
  if (roll < risk * 0.5) {
    return {
      runs: 0,
      wicket: "Caught",
      tone: "wicket",
      headline: "CAUGHT!",
      text: `${striker} skews it off the edge into the ${aimText}, straight down a fielder's throat.`,
      target: shotTarget(clamp(baseAngle + n * 60, -80, 80), ropeDistance(baseAngle) * 0.46),
      loft: 0.5,
      speed: 0.34,
    };
  }
  if (roll < risk) {
    return {
      runs: 0,
      wicket: "Bowled",
      tone: "wicket",
      headline: "BOWLED!",
      text: `${striker} swings across the line and misses — ${bowler} hits the top of off.`,
      target: { x: STUMPS.x + 5, y: STUMPS.y + 9 },
      loft: 0.06,
      speed: 0.9,
    };
  }
  if (roll < 0.82) {
    return {
      runs: 0,
      wicket: null,
      tone: "dot",
      headline: "BEATEN",
      text: `${striker} is a long way off the pace — ${bowler} beats the bat all ends up.`,
      target: KEEPER,
      loft: 0.05,
      speed: 0.8,
    };
  }
  return {
    runs: 1,
    wicket: null,
    tone: "run",
    headline: "1 RUN",
    text: `Thick inside edge, squirts into the ${aimText} for one. Lucky.`,
    target: shotTarget(clamp(baseAngle - n * 40, -70, 70), ropeDistance(baseAngle) * 0.42),
    loft: 0.16,
    speed: 0.3,
  };
}

/* ------------------------------------------------------------------ *
 * Innings state
 * ------------------------------------------------------------------ */

function freshInnings(): Innings {
  return {
    phase: "ready",
    score: 0,
    wickets: 0,
    balls: 0,
    streak: 0,
    batters: [
      { name: BATTERS[0], runs: 0, balls: 0 },
      { name: BATTERS[1], runs: 0, balls: 0 },
    ],
    striker: 0,
    nonStriker: 1,
    bowlerIndex: 0,
    figures: BOWLERS.map(() => ({ runs: 0, wkts: 0, balls: 0 })),
    log: [],
    strip: [],
    banner: null,
  };
}

function initialInnings(): Innings {
  return { ...freshInnings(), phase: "idle" };
}

/* ------------------------------------------------------------------ *
 * Tone styling (HTML chrome)
 * ------------------------------------------------------------------ */

const TONE_HEADLINE: Record<Tone, string> = {
  six: "text-emerald-400 score-flash",
  four: "text-cyan-400 score-flash",
  run: "text-white score-flash",
  dot: "text-slate-500",
  wicket: "text-red-400 wicket-shake",
};

const TONE_CHIP: Record<Tone, string> = {
  six: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300",
  four: "border-cyan-500/50 bg-cyan-500/15 text-cyan-300",
  run: "border-indigo-400/50 bg-indigo-500/15 text-indigo-200",
  dot: "border-slate-700/70 bg-slate-800/50 text-slate-400",
  wicket: "border-red-500/50 bg-red-500/15 text-red-300",
};

const TONE_DOT: Record<Tone, string> = {
  six: "bg-emerald-400",
  four: "bg-cyan-400",
  run: "bg-indigo-400",
  dot: "bg-slate-600",
  wicket: "bg-red-500",
};

const TONE_TRAIL: Record<Tone, string> = {
  six: "#34d399",
  four: "#22d3ee",
  run: "#a5b4fc",
  dot: "#94a3b8",
  wicket: "#f87171",
};

const AIM_OPTIONS: { aim: Aim; label: string; kbd: string }[] = [
  { aim: -1, label: "Left", kbd: "←" },
  { aim: 0, label: "Center", kbd: "↑" },
  { aim: 1, label: "Right", kbd: "→" },
];

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

export default function StreetStrike() {
  const [game, setGame] = useState<Innings>(initialInnings);
  const [aim, setAimState] = useState<Aim>(0);
  const [best, setBest] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [mode, setModeState] = useState<Mode>("street");
  const [paused, setPaused] = useState(false);
  const [muted, setMutedState] = useState(false);

  const stateRef = useRef<Innings>(game);
  const aimRef = useRef<Aim>(0);
  const bestRef = useRef(0);
  const modeRef = useRef<Mode>("street");
  const pausedRef = useRef(false);
  const idRef = useRef(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeRef = useRef({ cssW: 0, cssH: 0, dpr: 1 });
  const tickRef = useRef<(now: number) => void>(() => {});
  const reduceRef = useRef(false);

  const ballRef = useRef<BallMark | null>({ x: RELEASE.x, y: RELEASE.y - 8, size: 3.4 });
  const trailRef = useRef<Point[]>([]);
  const animRef = useRef<Anim | null>(null);
  const deliveryRef = useRef<Delivery | null>(null);
  const pendingRef = useRef<Outcome | null>(null);
  const committedRef = useRef(true);
  const lastNRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const floatersRef = useRef<Floater[]>([]);
  const flashRef = useRef<Flash | null>(null);
  const shakeRef = useRef<{ start: number; mag: number; ms: number } | null>(null);
  const vignetteRef = useRef<{ start: number; ms: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nextId = useCallback(() => {
    idRef.current += 1;
    return idRef.current;
  }, []);

  const patch = useCallback((next: Partial<Innings>) => {
    const merged = { ...stateRef.current, ...next };
    stateRef.current = merged;
    setGame(merged);
    return merged;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const setAim = useCallback((next: Aim) => {
    aimRef.current = next;
    setAimState(next);
  }, []);

  const spawnParticles = useCallback((x: number, y: number, count: number, color: string) => {
    const now = performance.now();
    const next: Particle[] = [];
    for (let i = 0; i < count; i += 1) {
      const ang = Math.random() * Math.PI * 2;
      const speed = 24 + Math.random() * 78;
      next.push({
        x,
        y,
        vx: Math.sin(ang) * speed,
        vy: -Math.abs(Math.cos(ang)) * speed - 12,
        born: now,
        life: 420 + Math.random() * 420,
        size: 1.4 + Math.random() * 2.4,
        color,
      });
    }
    particlesRef.current = [...particlesRef.current.slice(-90), ...next];
  }, []);

  const pushFloater = useCallback((x: number, y: number, text: string, color: string, size = 26) => {
    floatersRef.current = [
      ...floatersRef.current.slice(-6),
      { x, y, text, color, born: performance.now(), life: 900, size },
    ];
  }, []);

  const closeInnings = useCallback((final: Innings) => {
    sfx.gameover();
    const nextBest = Math.max(bestRef.current, final.score);
    bestRef.current = nextBest;
    setBest(nextBest);
    writeLocal(BEST_KEY, String(nextBest));
    if (final.score > 0) {
      const board = [...scores, final.score].sort((a, b) => b - a).slice(0, 5);
      setScores(board);
      writeLocal(SCORES_KEY, JSON.stringify(board));
    }
  }, [scores]);

  /* -------------------------- game actions -------------------------- */

  const swing = useCallback(
    (pressed: boolean) => {
      const st = stateRef.current;
      if (st.phase !== "delivery" || committedRef.current) return;
      committedRef.current = true;

      const d = deliveryRef.current;
      const now = performance.now();
      const h = d ? d.sweetHalf : 0.12;
      const n = pressed && d ? needleAt(now - d.contactAt, d.flightMs) : null;
      lastNRef.current = n;

      const striker = st.batters[st.striker]?.name ?? BATTERS[0];
      const bowler = BOWLERS[st.bowlerIndex] ?? BOWLERS[0];
      const outcome = resolve(n, h, aimRef.current, striker, bowler);

      const from: Point = n === null ? { ...CONTACT } : ballRef.current ? { ...ballRef.current } : { ...CONTACT };
      const dist = Math.hypot(outcome.target.x - from.x, outcome.target.y - from.y);
      const ms = clamp(dist / outcome.speed, 260, 950);

      trailRef.current = [];
      animRef.current = { kind: "shot", start: now, ms, from, to: outcome.target, loft: outcome.loft };
      pendingRef.current = outcome;

      // Sound + juice tied to the contact and the result.
      if (n !== null) sfx.bat();
      if (outcome.tone === "six") {
        sfx.six();
        shakeRef.current = { start: now, mag: 15, ms: 480 };
        flashRef.current = { start: now, ms: 300, color: "52,211,153" };
        spawnParticles(from.x, from.y, 30, "#34d399");
        pushFloater(CONTACT.x, CONTACT.y - 26, "+6", "#6ee7b7", 30);
      } else if (outcome.tone === "four") {
        sfx.four();
        shakeRef.current = { start: now, mag: 8, ms: 320 };
        flashRef.current = { start: now, ms: 220, color: "34,211,238" };
        spawnParticles(from.x, from.y, 18, "#22d3ee");
        pushFloater(CONTACT.x, CONTACT.y - 26, "+4", "#67e8f9", 28);
      } else if (outcome.tone === "wicket") {
        sfx.wicket();
        vignetteRef.current = { start: now, ms: 1100 };
        spawnParticles(from.x, from.y, 18, "#f87171");
      } else if (outcome.tone === "run") {
        sfx.run();
        spawnParticles(from.x, from.y, 8, "#a5b4fc");
      } else {
        sfx.dot();
      }

      patch({ phase: "shot" });
    },
    [patch, spawnParticles, pushFloater]
  );

  const finishShot = useCallback(() => {
    const res = pendingRef.current;
    if (!res) return;
    pendingRef.current = null;
    animRef.current = null;

    const g = stateRef.current;
    const balls = g.balls + 1;

    // Consecutive boundaries build a combo worth bonus "momentum" runs.
    const boundary = res.tone === "four" || res.tone === "six";
    const streak = boundary ? g.streak + 1 : 0;
    const comboBonus = boundary && streak >= 2 ? Math.min(streak - 1, 4) : 0;
    const gained = res.runs + comboBonus;
    const score = g.score + gained;
    const wickets = g.wickets + (res.wicket ? 1 : 0);
    const batters = g.batters.map((b, i) =>
      i === g.striker ? { ...b, runs: b.runs + res.runs, balls: b.balls + 1 } : b
    );

    let striker = g.striker;
    let nonStriker = g.nonStriker;
    const extra: string[] = [];

    if (comboBonus > 0) {
      extra.push(`Momentum! Combo x${streak} adds ${comboBonus} bonus run${comboBonus > 1 ? "s" : ""}.`);
      pushFloater(CONTACT.x, CONTACT.y - 52, `COMBO x${streak}`, "#fbbf24", 22);
    }
    if (res.runs > 0) {
      pushFloater(CONTACT.x + (res.runs >= 4 ? 0 : 0), CONTACT.y - 26, `+${res.runs}`, res.tone === "six" ? "#6ee7b7" : res.tone === "four" ? "#67e8f9" : "#c7d2fe", res.runs >= 4 ? 0 : 20);
    }

    if (res.wicket) {
      if (balls < TOTAL_BALLS && wickets < MAX_WICKETS) {
        const incoming: BatterRow = {
          name: BATTERS[Math.min(batters.length, BATTERS.length - 1)],
          runs: 0,
          balls: 0,
        };
        batters.push(incoming);
        striker = batters.length - 1;
        extra.push(`${incoming.name} strides out at ${score}/${wickets}.`);
      }
    } else if (res.runs % 2 === 1) {
      const swap = striker;
      striker = nonStriker;
      nonStriker = swap;
    }

    const nextBowler = Math.min(BOWLERS.length - 1, Math.floor(balls / BALLS_PER_OVER));
    const overDone = balls % BALLS_PER_OVER === 0 && balls < TOTAL_BALLS;
    if (overDone) {
      const swap = striker;
      striker = nonStriker;
      nonStriker = swap;
      extra.push(`End of over ${balls / BALLS_PER_OVER} — ${BOWLERS[nextBowler]} takes the ball.`);
    }

    const bowledBy = Math.min(BOWLERS.length - 1, Math.floor(g.balls / BALLS_PER_OVER));
    const figures = g.figures.map((f, i) =>
      i === bowledBy
        ? { runs: f.runs + res.runs, wkts: f.wkts + (res.wicket ? 1 : 0), balls: f.balls + 1 }
        : f
    );

    const closed = balls >= TOTAL_BALLS || wickets >= MAX_WICKETS;
    const chip = res.tone === "wicket" ? "W" : res.tone === "dot" ? "•" : String(res.runs);
    const feed: LogRow[] = [res.text, ...extra]
      .reverse()
      .map((text) => ({ id: nextId(), text, tone: res.tone }));

    const d = deliveryRef.current;
    const next: Innings = {
      ...g,
      phase: closed ? "end" : "result",
      score,
      wickets,
      balls,
      streak,
      batters,
      striker,
      nonStriker,
      bowlerIndex: nextBowler,
      figures,
      banner: {
        id: nextId(),
        headline: res.headline,
        text: res.text,
        tone: res.tone,
        deltaMs: lastNRef.current !== null && d ? lastNRef.current * d.flightMs : null,
      },
      log: [...feed, ...g.log].slice(0, 6),
      strip: [...g.strip, { id: nextId(), label: chip, tone: res.tone }],
    };

    patch(next);

    if (closed) {
      closeInnings(next);
    } else {
      clearTimer();
      timerRef.current = setTimeout(
        () => {
          timerRef.current = null;
          patch({ phase: "ready" });
        },
        res.wicket ? 1500 : 1000
      );
    }
  }, [clearTimer, closeInnings, nextId, patch, pushFloater]);

  const bowlNext = useCallback(() => {
    const st = stateRef.current;
    if (pausedRef.current) return;
    if (st.phase !== "ready" && st.phase !== "result") return;
    clearTimer();

    const diff = difficultyAt(st.balls, modeRef.current);
    const flightMs = Math.round(diff.flightMs * rand(0.95, 1.06));
    const start = performance.now();

    deliveryRef.current = {
      start,
      flightMs,
      contactAt: start + flightMs,
      sweetHalf: diff.sweetHalf,
    };
    committedRef.current = false;
    pendingRef.current = null;
    lastNRef.current = null;
    trailRef.current = [];
    ballRef.current = { x: RELEASE.x, y: RELEASE.y, size: 3.2 };
    animRef.current = { kind: "delivery", start, ms: flightMs };
    sfx.release();
    patch({ phase: "delivery", banner: null });
  }, [clearTimer, patch]);

  const startInnings = useCallback(() => {
    unlockAudio();
    sfx.start();
    clearTimer();
    animRef.current = null;
    committedRef.current = true;
    pendingRef.current = null;
    deliveryRef.current = null;
    lastNRef.current = null;
    trailRef.current = [];
    particlesRef.current = [];
    floatersRef.current = [];
    flashRef.current = null;
    shakeRef.current = null;
    vignetteRef.current = null;
    ballRef.current = { x: RELEASE.x, y: RELEASE.y - 8, size: 3.4 };
    pausedRef.current = false;
    setPaused(false);
    patch(freshInnings());
  }, [clearTimer, patch]);

  const toMenu = useCallback(() => {
    sfx.ui();
    clearTimer();
    animRef.current = null;
    committedRef.current = true;
    pendingRef.current = null;
    deliveryRef.current = null;
    particlesRef.current = [];
    floatersRef.current = [];
    flashRef.current = null;
    shakeRef.current = null;
    vignetteRef.current = null;
    ballRef.current = { x: RELEASE.x, y: RELEASE.y - 8, size: 3.4 };
    pausedRef.current = false;
    setPaused(false);
    patch(initialInnings());
  }, [clearTimer, patch]);

  const mainAction = useCallback(() => {
    if (pausedRef.current) return;
    const p = stateRef.current.phase;
    if (p === "idle" || p === "end") startInnings();
    else if (p === "ready" || p === "result") bowlNext();
    else if (p === "delivery") swing(true);
  }, [bowlNext, startInnings, swing]);

  const canPause = game.phase === "ready" || game.phase === "result";

  const togglePause = useCallback(() => {
    const p = stateRef.current.phase;
    if (p !== "ready" && p !== "result") return;
    unlockAudio();
    sfx.ui();
    setPaused((current) => {
      pausedRef.current = !current;
      return !current;
    });
  }, []);

  const toggleMute = useCallback(() => {
    const next = !isMuted();
    setMuted(next);
    setMutedState(next);
    if (!next) sfx.ui();
  }, []);

  const chooseMode = useCallback((next: Mode) => {
    unlockAudio();
    sfx.ui();
    modeRef.current = next;
    setModeState(next);
    writeLocal(MODE_KEY, next);
  }, []);

  const pickAim = useCallback(
    (next: Aim) => {
      sfx.ui();
      setAim(next);
    },
    [setAim]
  );

  /* --------------------------- effects --------------------------- */

  // Persisted prefs: best, leaderboard, mode, mute.
  useEffect(() => {
    const raw = readLocal(BEST_KEY);
    const saved = raw === null ? 0 : Number(raw);
    if (Number.isFinite(saved) && saved > 0) {
      bestRef.current = saved;
      setBest(saved);
    }
    try {
      const board = JSON.parse(readLocal(SCORES_KEY) ?? "[]");
      if (Array.isArray(board)) setScores(board.filter((n) => Number.isFinite(n)).slice(0, 5));
    } catch {
      /* ignore a corrupt leaderboard */
    }
    const savedMode = readLocal(MODE_KEY);
    if (savedMode === "casual" || savedMode === "street" || savedMode === "pro") {
      modeRef.current = savedMode;
      setModeState(savedMode);
    }
    setMutedState(isMuted());
  }, []);

  // Respect reduced-motion for the shake.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      reduceRef.current = mq.matches;
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Responsive backing store: ResizeObserver + devicePixelRatio.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const resize = () => {
      const cssW = wrap.clientWidth;
      if (cssW <= 0) return;
      const cssH = (cssW * LOGICAL_H) / LOGICAL_W;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.height = `${cssH}px`;
      const w = Math.round(cssW * dpr);
      const h = Math.round(cssH * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      sizeRef.current = { cssW, cssH, dpr };
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    window.addEventListener("resize", resize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Resting ball between deliveries.
  useEffect(() => {
    if (game.phase === "ready" || game.phase === "idle") {
      deliveryRef.current = null;
      trailRef.current = [];
      ballRef.current = { x: RELEASE.x, y: RELEASE.y - 8, size: 3.4 };
    }
  }, [game.phase]);

  // Single persistent rAF loop for the whole game.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    ctxRef.current = context;

    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      tickRef.current(now);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ctxRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Pause cleanly if the tab is hidden mid-delivery.
  useEffect(() => {
    const onHide = () => {
      if (!document.hidden) return;
      if (stateRef.current.phase === "delivery" && !committedRef.current) {
        animRef.current = null;
        committedRef.current = true;
        patch({ phase: "ready" });
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [patch]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code === "Space") {
        event.preventDefault();
        mainAction();
        return;
      }
      if (event.code === "ArrowLeft") {
        event.preventDefault();
        setAim(-1);
        return;
      }
      if (event.code === "ArrowRight") {
        event.preventDefault();
        setAim(1);
        return;
      }
      if (event.code === "ArrowUp" || event.code === "ArrowDown") {
        event.preventDefault();
        setAim(0);
        return;
      }
      if (event.code === "KeyP" || event.code === "Escape") {
        event.preventDefault();
        togglePause();
        return;
      }
      if (event.code === "KeyM") {
        event.preventDefault();
        toggleMute();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mainAction, setAim, togglePause, toggleMute]);

  /* --------------------------- simulation --------------------------- */

  const step = (now: number) => {
    if (particlesRef.current.length > 0) {
      particlesRef.current = particlesRef.current.filter((p) => now - p.born < p.life);
    }
    if (floatersRef.current.length > 0) {
      floatersRef.current = floatersRef.current.filter((f) => now - f.born < f.life);
    }

    const anim = animRef.current;
    if (!anim) return;

    if (anim.kind === "delivery") {
      const d = deliveryRef.current;
      if (!d) return;
      const el = now - anim.start;
      if (el <= anim.ms) {
        const f = clamp(el / anim.ms, 0, 1);
        ballRef.current = {
          x: RELEASE.x + (CONTACT.x - RELEASE.x) * f,
          y: RELEASE.y + (CONTACT.y - RELEASE.y) * f,
          size: 3.2 + Math.sin(Math.PI * f) * 1.6,
        };
        return;
      }
      const over = el - anim.ms;
      const g = clamp(over / GRACE_MS, 0, 1);
      ballRef.current = {
        x: CONTACT.x + (KEEPER.x - CONTACT.x) * g,
        y: CONTACT.y + (KEEPER.y - CONTACT.y) * g,
        size: 3.2,
      };
      if (!committedRef.current && over >= GRACE_MS) swing(false);
      return;
    }

    const u = clamp((now - anim.start) / anim.ms, 0, 1);
    const k = Math.pow(u, 0.74);
    ballRef.current = {
      x: anim.from.x + (anim.to.x - anim.from.x) * k,
      y: anim.from.y + (anim.to.y - anim.from.y) * k,
      size: 3 + anim.loft * 3.4 * Math.sin(Math.PI * u),
    };
    const last = trailRef.current[trailRef.current.length - 1];
    if (!last || Math.hypot(last.x - ballRef.current.x, last.y - ballRef.current.y) > 4) {
      trailRef.current = [
        ...trailRef.current.slice(-60),
        { x: ballRef.current.x, y: ballRef.current.y },
      ];
    }
    if (u >= 1) finishShot();
  };

  /* ---------------------------- rendering ---------------------------- */

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = "rgba(34,211,238,0.055)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= LOGICAL_W; x += 21) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, LOGICAL_H);
      ctx.stroke();
    }
    for (let y = 0; y <= LOGICAL_H; y += 21) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(LOGICAL_W, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.025)";
    for (let y = 0; y <= LOGICAL_H; y += 4) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(LOGICAL_W, y + 0.5);
      ctx.stroke();
    }
  };

  const drawGround = (ctx: CanvasRenderingContext2D) => {
    ctx.beginPath();
    ctx.ellipse(GROUND.cx, GROUND.cy, GROUND.rx, GROUND.ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#060d0f";
    ctx.fill();
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 26;
    ctx.strokeStyle = "rgba(34,211,238,0.85)";
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.shadowBlur = 0;

    for (const ring of [0.78, 0.52]) {
      ctx.beginPath();
      ctx.ellipse(
        GROUND.cx,
        GROUND.cy,
        GROUND.rx * ring,
        GROUND.ry * ring,
        0,
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = "rgba(52,211,153,0.16)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  };

  const drawPitch = (ctx: CanvasRenderingContext2D, now: number) => {
    ctx.save();
    ctx.fillStyle = "rgba(9,17,28,0.92)";
    ctx.strokeStyle = "rgba(34,211,238,0.35)";
    ctx.lineWidth = 1.4;
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 12;
    ctx.fillRect(178, 120, 64, 260);
    ctx.strokeRect(178, 120, 64, 260);
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "rgba(52,211,153,0.5)";
    ctx.lineWidth = 1.2;
    for (const y of [136, 364]) {
      ctx.beginPath();
      ctx.moveTo(170, y);
      ctx.lineTo(250, y);
      ctx.stroke();
    }

    ctx.shadowColor = "#a7f3d0";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#e6fff5";
    for (const sx of [202, 210, 218]) {
      ctx.fillRect(sx - 1, 370, 2, 12);
    }
    ctx.shadowBlur = 0;

    const pulse = 0.6 + 0.4 * Math.sin(now / 320);
    ctx.beginPath();
    ctx.arc(RELEASE.x, RELEASE.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(56,189,248,${0.55 + pulse * 0.4})`;
    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  };

  // Bowler, striker with a swinging bat, keeper and a few fielders — so it
  // reads as people playing, not dots on a diagram.
  const drawPlayers = (ctx: CanvasRenderingContext2D, now: number) => {
    const st = stateRef.current;
    const anim = animRef.current;
    ctx.save();

    for (const f of FIELDERS) drawPerson(ctx, f.x, f.y, "rgba(148,163,184,0.5)", 0.8);

    // Bowler runs in during the delivery.
    let bowlerY = RELEASE.y - 18;
    if (anim?.kind === "delivery") {
      const f = clamp((now - anim.start) / anim.ms, 0, 1);
      bowlerY = RELEASE.y - 22 + f * 14;
    }
    drawPerson(ctx, RELEASE.x, bowlerY, "#38bdf8", 0.95);

    drawPerson(ctx, KEEPER.x + 16, KEEPER.y - 6, "rgba(203,213,225,0.7)", 0.85);

    // Striker body + head.
    drawPerson(ctx, STRIKER.x, STRIKER.y, "#e2e8f0", 1.05);

    // Bat pivots at the hands; sweeps from backlift to follow-through on a shot.
    let swingP = 0;
    if (anim?.kind === "shot") swingP = clamp((now - anim.start) / 150, 0, 1);
    else if (st.phase === "result" || st.phase === "end") swingP = 1;
    const angle = (-0.9 + (2.5 - -0.9) * swingP) * Math.PI * 0.42;
    ctx.translate(STRIKER.hands.x, STRIKER.hands.y);
    ctx.rotate(angle);
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -22);
    ctx.stroke();
    ctx.fillStyle = "#d6b48a";
    roundRect(ctx, -3, -40, 6, 20, 2.5);
    ctx.fill();
    ctx.restore();
  };

  const drawAim = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    for (const lane of AIM_OPTIONS) {
      const deg = lane.aim < 0 ? -34 : lane.aim > 0 ? 34 : 0;
      const dist = ropeDistance(deg) * 0.9;
      const end = shotTarget(deg, dist);
      const selected = aimRef.current === lane.aim;
      ctx.beginPath();
      ctx.moveTo(CONTACT.x, CONTACT.y - 4);
      ctx.lineTo(end.x, end.y);
      ctx.setLineDash([7, 9]);
      ctx.lineWidth = selected ? 2.6 : 1.2;
      ctx.strokeStyle = selected ? "rgba(52,211,153,0.95)" : "rgba(148,163,184,0.22)";
      ctx.shadowColor = selected ? "#34d399" : "transparent";
      ctx.shadowBlur = selected ? 14 : 0;
      ctx.stroke();
      ctx.setLineDash([]);

      if (selected) {
        ctx.beginPath();
        ctx.arc(end.x, end.y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(52,211,153,0.9)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  };

  const drawBall = (ctx: CanvasRenderingContext2D) => {
    const tone = pendingRef.current?.tone ?? "dot";
    const trail = trailRef.current;
    if (trail.length > 1) {
      ctx.save();
      ctx.beginPath();
      trail.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.strokeStyle = TONE_TRAIL[tone];
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.shadowColor = TONE_TRAIL[tone];
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.restore();
    }

    const b = ballRef.current;
    if (!b) return;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + b.size * 1.1, b.size * 1.1, b.size * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(2,6,23,0.5)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
    ctx.fillStyle = "#fb7185";
    ctx.shadowColor = "#f43f5e";
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  };

  const drawParticles = (ctx: CanvasRenderingContext2D, now: number) => {
    if (particlesRef.current.length === 0) return;
    ctx.save();
    for (const p of particlesRef.current) {
      const t = (now - p.born) / p.life;
      if (t < 0 || t > 1) continue;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x + p.vx * t, p.y + p.vy * t + 90 * t * t, p.size * (1 - t * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const drawFloaters = (ctx: CanvasRenderingContext2D, now: number) => {
    if (floatersRef.current.length === 0) return;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of floatersRef.current) {
      const t = (now - f.born) / f.life;
      if (t < 0 || t > 1) continue;
      ctx.globalAlpha = 1 - t * t;
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 16;
      ctx.font = `900 ${Math.round(f.size * (1 + (1 - t) * 0.15))}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(f.text, f.x, f.y - 40 * t);
    }
    ctx.restore();
  };

  const drawGauge = (ctx: CanvasRenderingContext2D, now: number) => {
    const { x0, x1, y, h } = GAUGE;
    const midX = (x0 + x1) / 2;
    const halfSpan = (x1 - x0) / 2;

    const d = deliveryRef.current;
    const live = d !== null && stateRef.current.phase === "delivery";
    const sweetHalf = live && d ? d.sweetHalf : difficultyAt(stateRef.current.balls, modeRef.current).sweetHalf;

    ctx.save();
    roundRect(ctx, x0, y, x1 - x0, h, 6);
    ctx.fillStyle = "rgba(2,6,23,0.9)";
    ctx.fill();
    ctx.strokeStyle = "rgba(148,163,184,0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const bands: { half: number; color: string }[] = [
      { half: sweetHalf + 0.3, color: "rgba(239,68,68,0.16)" },
      { half: sweetHalf + 0.15, color: "rgba(251,191,36,0.2)" },
      { half: sweetHalf + 0.055, color: "rgba(34,211,238,0.32)" },
      { half: sweetHalf, color: "rgba(52,211,153,0.95)" },
    ];
    for (const band of bands) {
      const w = Math.min(band.half, 1) * halfSpan;
      ctx.fillStyle = band.color;
      ctx.fillRect(midX - w, y + 1, w * 2, h - 2);
    }

    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.moveTo(midX, y - 4);
    ctx.lineTo(midX, y + h + 4);
    ctx.stroke();

    const n = live && d ? needleAt(now - d.contactAt, d.flightMs) : lastNRef.current ?? 0;
    const nx = midX + clamp(n, -1, 1) * halfSpan;
    ctx.shadowColor = "#e879f9";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(nx - 1.7, y - 7, 3.4, h + 14);
    ctx.restore();
  };

  const drawFlash = (ctx: CanvasRenderingContext2D, now: number) => {
    const f = flashRef.current;
    if (!f) return;
    const t = (now - f.start) / f.ms;
    if (t >= 1) {
      flashRef.current = null;
      return;
    }
    ctx.save();
    ctx.globalAlpha = Math.sin(Math.PI * t) * 0.22;
    ctx.fillStyle = `rgba(${f.color},1)`;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.restore();
  };

  const drawVignette = (ctx: CanvasRenderingContext2D, now: number) => {
    const v = vignetteRef.current;
    if (!v) return;
    const t = (now - v.start) / v.ms;
    if (t >= 1) {
      vignetteRef.current = null;
      return;
    }
    const pulse = Math.sin(Math.PI * t) * (1 - t * 0.35);
    const grad = ctx.createRadialGradient(
      LOGICAL_W / 2,
      LOGICAL_H / 2,
      LOGICAL_H * 0.16,
      LOGICAL_W / 2,
      LOGICAL_H / 2,
      LOGICAL_H * 0.72
    );
    grad.addColorStop(0, "rgba(220,38,38,0)");
    grad.addColorStop(0.62, `rgba(220,38,38,${0.12 * pulse})`);
    grad.addColorStop(1, `rgba(153,27,27,${0.6 * pulse})`);
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.restore();
  };

  const draw = (now: number) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const { dpr, cssW, cssH } = sizeRef.current;
    if (cssW <= 0 || cssH <= 0) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.scale(cssW / LOGICAL_W, cssH / LOGICAL_H);

    ctx.fillStyle = "#05070d";
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    let sx = 0;
    let sy = 0;
    const sh = shakeRef.current;
    if (sh) {
      const t = (now - sh.start) / sh.ms;
      if (t >= 1) shakeRef.current = null;
      else if (!reduceRef.current) {
        const decay = (1 - t) * (1 - t);
        sx = (Math.random() * 2 - 1) * sh.mag * decay;
        sy = (Math.random() * 2 - 1) * sh.mag * decay;
      }
    }

    ctx.save();
    ctx.translate(sx, sy);
    drawGrid(ctx);
    drawGround(ctx);
    drawPitch(ctx, now);
    drawAim(ctx);
    drawPlayers(ctx, now);
    drawBall(ctx);
    drawParticles(ctx, now);
    drawFloaters(ctx, now);
    drawGauge(ctx, now);
    ctx.restore();

    drawFlash(ctx, now);
    drawVignette(ctx, now);
  };

  // Keep the loop pointed at the freshest closures without restarting rAF.
  useEffect(() => {
    tickRef.current = (now: number) => {
      step(now);
      draw(now);
    };
  });

  /* ------------------------------ derived ------------------------------ */

  const striker = game.batters[game.striker] ?? game.batters[0];
  const nonStriker = game.batters[game.nonStriker] ?? game.batters[1];
  const ballsLeft = Math.max(0, TOTAL_BALLS - game.balls);
  const runRate = game.balls > 0 ? (game.score / game.balls) * 6 : 0;
  const bowlerIndex = clamp(game.bowlerIndex, 0, BOWLERS.length - 1);
  const bowlerName = BOWLERS[bowlerIndex] ?? BOWLERS[0];
  const figures = game.figures[bowlerIndex] ?? { runs: 0, wkts: 0, balls: 0 };
  const economy = figures.balls > 0 ? (figures.runs / figures.balls) * 6 : 0;
  const live = game.phase === "delivery" || game.phase === "shot";
  const banner = game.banner;
  const showEnd = game.phase === "end";
  const showMenu = game.phase === "idle";
  const upcoming = difficultyAt(game.balls, mode);
  const liveDelivery = deliveryRef.current;
  const shownSweet = live && liveDelivery ? liveDelivery.sweetHalf : upcoming.sweetHalf;
  const shownFlight = live && liveDelivery ? liveDelivery.flightMs : upcoming.flightMs;
  const maxSweet = 0.17 * modeScale(mode).sweetScale;
  const tightness = clamp((1 - shownSweet / maxSweet) * 100, 0, 100);
  const canPlay = !showMenu && !showEnd;

  const buttonLabel =
    game.phase === "idle" || game.phase === "end"
      ? "Take strike"
      : game.phase === "ready"
        ? "Bowl delivery"
        : game.phase === "delivery"
          ? "Play the shot"
          : game.phase === "shot"
            ? "Ball in play"
            : "Next ball";
  const buttonDisabled = game.phase === "shot";

  const bands = [
    { label: "SIX", half: shownSweet, tone: "six" as Tone },
    { label: "FOUR", half: shownSweet + 0.055, tone: "four" as Tone },
    { label: "2-3 runs", half: shownSweet + 0.15, tone: "run" as Tone },
    { label: "1 or dot", half: shownSweet + 0.3, tone: "run" as Tone },
  ];

  /* ------------------------------- view ------------------------------- */

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
      <div className="glass rounded-3xl p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold">
              {game.phase === "delivery" ? "Delivery incoming" : `Over ${Math.floor(game.balls / BALLS_PER_OVER) + 1} of 2`}
            </div>
            <div className="font-bold text-base sm:text-lg leading-tight">
              {bowlerName} to {striker?.name ?? BATTERS[0]}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {live
                ? "Sweep the needle into the green zone and swing."
                : "Tap the pitch, press Space or use the button."}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canPlay && (
              <>
                <button
                  type="button"
                  onClick={togglePause}
                  disabled={!canPause}
                  aria-label={paused ? "Resume" : "Pause"}
                  className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-white/5 border border-slate-700/60 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={toMenu}
                  aria-label="Back to menu"
                  className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-white/5 border border-slate-700/60 transition-all"
                >
                  <Home className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Unmute" : "Mute"}
              className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-white/5 border border-slate-700/60 transition-all"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div
          ref={wrapRef}
          className="relative rounded-2xl overflow-hidden border border-slate-800/70 bg-[#05070d]"
        >
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="Street Strike: a neon cricket pitch with a timing gauge and aim lanes"
            className="block w-full touch-none select-none"
            onPointerDown={(event) => {
              event.preventDefault();
              unlockAudio();
              mainAction();
            }}
          />

          {showMenu && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/85 backdrop-blur-sm px-5 text-center">
              <div className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
                STREET STRIKE
              </div>
              <ul className="text-[11px] sm:text-xs text-slate-400 space-y-1 max-w-[340px]">
                <li>Time the sweeping needle into the green band, then swing.</li>
                <li>Pick a gap with the arrows (or the aim buttons), Space to play.</li>
                <li>Back-to-back boundaries build a combo for bonus runs.</li>
              </ul>
              <div className="flex gap-2">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => chooseMode(m.id)}
                    className={`rounded-xl px-3 py-2 text-xs font-bold border transition-all ${
                      mode === m.id
                        ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-200"
                        : "border-slate-700/70 bg-slate-900/60 text-slate-400 hover:text-white"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500">{modeScale(mode).blurb}</p>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span>
                  Best <span className="font-mono font-bold text-emerald-300">{best}</span>
                </span>
                {scores.length > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="text-slate-500">Top:</span>
                    <span className="font-mono">{scores.slice(0, 3).join(" · ")}</span>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={startInnings}
                className="mt-1 rounded-xl px-8 py-3 font-black uppercase tracking-widest bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-[1.03] active:scale-[0.97] transition-all shadow-lg shadow-emerald-500/25"
              >
                Take strike
              </button>
            </div>
          )}

          {paused && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/85 backdrop-blur-sm text-center">
              <div className="text-2xl font-black uppercase tracking-widest text-slate-200">
                Paused
              </div>
              <button
                type="button"
                onClick={togglePause}
                className="rounded-xl px-8 py-3 font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={toMenu}
                className="text-xs text-slate-400 hover:text-white underline"
              >
                Quit to menu
              </button>
            </div>
          )}
        </div>

        <div className="h-[80px] sm:h-[86px] flex flex-col items-center justify-center text-center mt-3" aria-live="polite" role="status">
          {banner ? (
            <div key={banner.id} className="animate-slide-up">
              <div className={`text-3xl sm:text-4xl font-black tracking-tight ${TONE_HEADLINE[banner.tone]}`}>
                {banner.headline}
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-1">
                {banner.deltaMs === null
                  ? "no swing offered"
                  : `${banner.deltaMs > 0 ? "+" : ""}${Math.round(banner.deltaMs)}ms ${
                      Math.abs(banner.deltaMs) <= shownFlight * 0.2
                        ? "— in the window"
                        : "— outside the window"
                    }`}
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-xs uppercase tracking-[0.2em] font-bold">
              {game.phase === "delivery"
                ? "watch the release"
                : game.phase === "shot"
                  ? "shot away"
                  : showMenu
                    ? "press take strike"
                    : `Ball ${Math.min(game.balls + 1, TOTAL_BALLS)} of ${TOTAL_BALLS}`}
            </p>
          )}
        </div>

        {game.streak >= 2 && !showMenu && (
          <div className="text-center mb-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-500/15 px-3 py-1 text-xs font-black uppercase tracking-widest text-amber-300">
              Combo x{game.streak}
            </span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mb-4">
          {AIM_OPTIONS.map((option) => {
            const selected = aim === option.aim;
            return (
              <button
                key={option.label}
                type="button"
                onClick={() => pickAim(option.aim)}
                aria-pressed={selected}
                className={`rounded-xl border px-3 py-3 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  selected
                    ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-200 shadow-lg shadow-emerald-500/20"
                    : "border-slate-700/70 bg-slate-900/50 text-slate-400 hover:text-white hover:border-slate-600"
                }`}
              >
                {option.label}
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700 font-mono text-[10px]">
                  {option.kbd}
                </kbd>
              </button>
            );
          })}
        </div>

        {showEnd ? (
          <div className="text-center animate-bounce-in border-t border-slate-700/50 pt-5">
            <div className="text-sm uppercase tracking-widest text-slate-500 font-bold mb-1">
              {game.wickets >= MAX_WICKETS && game.balls < TOTAL_BALLS
                ? "Innings folded for 2"
                : "Innings complete"}
            </div>
            <div className="text-5xl font-black mb-1">
              {game.score}
              <span className="text-2xl text-slate-400 font-bold">/{game.wickets}</span>
            </div>
            <div className="text-sm text-slate-400 mb-1">
              {game.batters.map((b) => `${b.name} ${b.runs}(${b.balls})`).join(" • ")}
            </div>
            <div className="text-xs text-slate-500 mb-4">
              Personal best {best}
              {game.score >= best && game.score > 0 ? " — new record!" : ""}
            </div>
            {scores.length > 0 && (
              <div className="mb-4 text-xs">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold mb-1">
                  Your best five
                </div>
                <div className="flex items-center justify-center gap-2 font-mono text-slate-300">
                  {scores.map((s, i) => (
                    <span
                      key={i}
                      className={s === game.score ? "text-emerald-300 font-bold" : ""}
                    >
                      {s}
                      {i < scores.length - 1 ? " · " : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={startInnings}
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 min-h-[56px] font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-[1.03] active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/25"
              >
                <RotateCcw className="h-4 w-4" />
                Bat again
              </button>
              <button
                type="button"
                onClick={toMenu}
                className="rounded-xl px-5 py-3.5 min-h-[56px] font-bold bg-slate-800/70 border border-slate-700/60 hover:bg-slate-800 transition-all"
              >
                Menu
              </button>
            </div>
            <div className="flex items-center justify-center gap-2 mt-4">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => chooseMode(m.id)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-bold border transition-all ${
                    mode === m.id
                      ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-200"
                      : "border-slate-700/70 bg-slate-900/60 text-slate-400 hover:text-white"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 border-t border-slate-700/50 pt-4">
            <button
              type="button"
              onClick={mainAction}
              disabled={buttonDisabled || paused}
              className={`w-full sm:w-80 rounded-2xl py-5 min-h-[56px] text-lg sm:text-xl font-black uppercase tracking-widest transition-all ${
                buttonDisabled
                  ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                  : game.phase === "delivery"
                    ? "bg-gradient-to-r from-fuchsia-500 to-rose-500 hover:scale-[1.02] active:scale-[0.97] shadow-lg shadow-rose-500/25"
                    : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:scale-[1.02] active:scale-[0.97] shadow-lg shadow-emerald-500/25"
              }`}
            >
              {buttonLabel}
            </button>
            <p className="text-xs text-slate-500 text-center">
              {game.phase === "delivery" ? "Swing now, or press " : "or press "}
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono">
                Space
              </kbd>
              {"  "}
              <span className="text-slate-600">· P pause · M mute</span>
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
                } ${index === BALLS_PER_OVER ? "ml-3" : ""}`}
              >
                {chip ? chip.label : index + 1}
              </div>
            );
          })}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Score" value={`${game.score}/${game.wickets}`} accent="text-emerald-400" />
          <Stat label="Balls left" value={String(ballsLeft)} accent="text-cyan-300" />
          <Stat label="Overs" value={`${oversString(game.balls)} / 2.0`} />
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
              {oversString(figures.balls)}-{figures.runs}-{figures.wkts}
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
            <p className="text-sm text-slate-500">Awaiting the first delivery.</p>
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
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold">
              Timing bands
            </span>
            <span className="text-[10px] font-mono text-slate-500">{mode} · ball {Math.min(game.balls + 1, TOTAL_BALLS)}</span>
          </div>
          <p className="text-[11px] text-slate-500 mb-2">
            Wide at the start, razor thin by the last over. Sweet spot now {Math.round(tightness)}% tighter than ball 1.
          </p>
          <div className="mb-3">
            <div className="h-2 w-full rounded-full bg-slate-800/70 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all"
                style={{ width: `${clamp((shownSweet / maxSweet) * 100, 6, 100)}%` }}
              />
            </div>
          </div>
          <ul className="space-y-1.5">
            {bands.map((band) => (
              <li key={band.label} className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[band.tone]}`} />
                <span className="font-mono text-slate-200 w-16">{band.label}</span>
                <span>±{Math.round(band.half * shownFlight)}ms</span>
              </li>
            ))}
            <li className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-slate-600" />
              <span className="font-mono text-slate-200 w-16">outside</span>
              <span>beaten — bowled, LBW or caught</span>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Small presentational helpers
 * ------------------------------------------------------------------ */

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
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-bold">{label}</div>
      <div className={`text-xl sm:text-2xl font-black font-mono ${accent}`}>{value}</div>
    </div>
  );
}

function BatRow({ row, onStrike = false }: { row: BatterRow; onStrike?: boolean }) {
  const strike = row.balls > 0 ? Math.round((row.runs / row.balls) * 100) : 0;
  return (
    <div className="flex items-center justify-between gap-2 text-sm py-0.5">
      <span className="flex items-center gap-2 min-w-0">
        <span className={onStrike ? "text-emerald-400" : "text-slate-600"}>
          {onStrike ? "●" : "○"}
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
