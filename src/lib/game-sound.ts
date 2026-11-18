// Tiny WebAudio synth for Street Strike. Every sound is oscillator/noise
// envelopes, so there are no asset files to ship and nothing to 404. Each
// helper is a no-op when audio is unavailable or muted, so it can never break
// the game.

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  return ctx;
}

let muted = false;
if (typeof window !== "undefined") {
  try {
    muted = window.localStorage.getItem("pundit-arena:muted") === "1";
  } catch {
    /* private mode etc. */
  }
}

const muteListeners = new Set<(m: boolean) => void>();

/** Subscribe to master-mute changes so every control stays in sync. */
export function onMuteChange(cb: (m: boolean) => void): () => void {
  muteListeners.add(cb);
  return () => muteListeners.delete(cb);
}

// Every scheduled source and pending timer is tracked so a single call can
// silence the whole synth instantly (e.g. when leaving a game screen).
const liveNodes = new Set<AudioScheduledSourceNode>();
const liveTimers = new Set<ReturnType<typeof setTimeout>>();

function track(node: AudioScheduledSourceNode): void {
  liveNodes.add(node);
  node.addEventListener("ended", () => liveNodes.delete(node));
}

/** setTimeout that stopAllSounds() can cancel. */
export function later(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
  const id = setTimeout(() => {
    liveTimers.delete(id);
    fn();
  }, ms);
  liveTimers.add(id);
  return id;
}

/** Hard silence: cancel pending timers, stop all ringing nodes, suspend the context. */
export function stopAllSounds(): void {
  for (const id of liveTimers) clearTimeout(id);
  liveTimers.clear();
  for (const node of liveNodes) {
    try { node.stop(); } catch { /* already stopped */ }
    try { node.disconnect(); } catch { /* already gone */ }
  }
  liveNodes.clear();
  if (ctx && ctx.state === "running") void ctx.suspend().catch(() => undefined);
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    window.localStorage.setItem("pundit-arena:muted", value ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (value) {
    // Master kill: silence anything already ringing, instantly, mid-event.
    stopAllSounds();
  } else {
    unlockAudio();
  }
  for (const cb of muteListeners) cb(muted);
}

export function isMuted(): boolean {
  return muted;
}

/** Browsers keep the context suspended until a gesture; call from a click/keypress. */
export function unlockAudio(): void {
  const c = audio();
  if (c && c.state === "suspended") void c.resume().catch(() => undefined);
}

interface Blip {
  type?: OscillatorType;
  dur?: number;
  gain?: number;
  /** Semantically a target offset; clamped to a floor. */
  slide?: number;
  delay?: number;
}

function blip(freq: number, { type = "sine", dur = 0.12, gain = 0.16, slide = 0, delay = 0 }: Blip = {}): void {
  const c = audio();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  }
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
  track(osc);
}

function noise(dur = 0.1, gain = 0.15, highpass = 800): void {
  const c = audio();
  if (!c || muted) return;
  const t0 = c.currentTime;
  const frames = Math.max(1, Math.ceil(c.sampleRate * dur));
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = highpass;
  const env = c.createGain();
  env.gain.setValueAtTime(gain, t0);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(env).connect(c.destination);
  src.start(t0);
  track(src);
}

export const sfx = {
  ui: () => blip(440, { type: "triangle", dur: 0.05, gain: 0.07 }),
  release: () => blip(300, { type: "sine", dur: 0.07, gain: 0.05, slide: 200 }),
  bat: () => {
    noise(0.05, 0.14, 1400);
    blip(230, { type: "square", dur: 0.03, gain: 0.05 });
  },
  run: () => blip(520, { type: "triangle", dur: 0.08, gain: 0.1 }),
  dot: () => blip(150, { type: "sine", dur: 0.09, gain: 0.05 }),
  four: () => {
    blip(523, { type: "triangle", dur: 0.1, gain: 0.13 });
    blip(659, { type: "triangle", dur: 0.1, gain: 0.13, delay: 0.06 });
  },
  six: () => {
    [523, 659, 784, 1047].forEach((f, i) =>
      blip(f, { type: "triangle", dur: 0.14, gain: 0.15, delay: i * 0.06 })
    );
  },
  wicket: () => {
    noise(0.2, 0.2, 320);
    blip(180, { type: "sawtooth", dur: 0.26, gain: 0.13, slide: -120 });
  },
  start: () => {
    blip(392, { type: "triangle", dur: 0.1, gain: 0.11 });
    blip(587, { type: "triangle", dur: 0.12, gain: 0.11, delay: 0.08 });
  },
  gameover: () => {
    [587, 494, 392, 294].forEach((f, i) =>
      blip(f, { type: "triangle", dur: 0.16, gain: 0.13, delay: i * 0.12 })
    );
  },
  bid: () => blip(620, { type: "triangle", dur: 0.06, gain: 0.08, slide: 120 }),
  userBid: () => {
    blip(740, { type: "triangle", dur: 0.07, gain: 0.11 });
    blip(988, { type: "triangle", dur: 0.08, gain: 0.1, delay: 0.05 });
  },
  hammer: () => {
    noise(0.09, 0.24, 400);
    blip(130, { type: "square", dur: 0.12, gain: 0.13 });
  },
  sold: () => {
    [523, 659, 784].forEach((f, i) =>
      blip(f, { type: "triangle", dur: 0.12, gain: 0.14, delay: 0.08 + i * 0.07 })
    );
  },
  unsold: () => blip(240, { type: "sine", dur: 0.24, gain: 0.09, slide: -110 }),
  tick: () => blip(1050, { type: "square", dur: 0.035, gain: 0.055 }),
  fanfare: () => {
    [392, 523, 659, 784, 1047].forEach((f, i) =>
      blip(f, { type: "triangle", dur: 0.18, gain: 0.14, delay: i * 0.1 })
    );
  },
};
