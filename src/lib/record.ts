/**
 * Camera recording for the scorer, built for hours rather than clips.
 *
 * The naive version — collect every chunk in an array and download it at the
 * end — holds the whole film in memory and dies somewhere around a two-hour
 * innings. So chunks go to a file as they arrive, through the File System
 * Access API where the browser has it, and the recording is rotated into
 * numbered downloads where it does not.
 */

export type RecorderPhase =
  | "idle"
  | "requesting"
  | "recording"
  | "paused"
  | "stopped"
  | "error";

/**
 * How long an in-memory segment runs before it is flushed to a download.
 * Ten minutes at a typical 250 kbps is roughly 75 MB, which is well inside
 * what a tab will tolerate; longer and the browser starts dropping frames.
 */
export const SEGMENT_MS = 10 * 60_000;

export function pickMimeType(
  isSupported: (type: string) => boolean
): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  // Safari records mp4 and nothing else; Firefox takes vp8 webm. Asking for a
  // container the browser will not write produces a silent empty file.
  return candidates.find((type) => isSupported(type)) ?? "";
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const shown = index === 0 ? Math.round(value) : value;
  return `${shown >= 10 || index === 0 ? Math.round(shown) : shown.toFixed(1)} ${units[index]}`;
}

export function formatClock(elapsedMs: number): string {
  const total = Math.max(0, Math.floor(elapsedMs / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

export function segmentDue(elapsedInSegmentMs: number, segmentMs = SEGMENT_MS): boolean {
  return elapsedInSegmentMs >= segmentMs;
}

interface FileHandle {
  name: string;
  createWritable(): Promise<FileWritable>;
}

interface FileWritable {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

type SaveFilePicker = (options: {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<FileHandle>;

function picker(): SaveFilePicker | null {
  const candidate = (globalThis as { showSaveFilePicker?: unknown })
    .showSaveFilePicker;
  return typeof candidate === "function" ? (candidate as SaveFilePicker) : null;
}

/** True when chunks can stream to a file, so one recording can run all day. */
export function supportsFileStreaming(): boolean {
  return picker() !== null;
}

export interface ChunkSink {
  readonly label: string;
  readonly continuous: boolean;
  write(chunk: Blob): Promise<void>;
  close(): Promise<void>;
}

/** Opens the destination file while the click is still a user gesture. */
export async function createFileSink(suggestedName: string): Promise<ChunkSink> {
  const choose = picker();
  if (!choose) throw new Error("This browser cannot save to a chosen file.");
  const handle = await choose({
    suggestedName,
    types: [
      {
        description: "Video",
        accept: { "video/webm": [".webm"], "video/mp4": [".mp4"] },
      },
    ],
  });
  const writable = await handle.createWritable();
  let queue = Promise.resolve();
  return {
    label: handle.name,
    continuous: true,
    // Writes are chained, not raced: two chunks landing out of order would
    // corrupt the container, and MediaRecorder gives no ordering guarantee
    // across the event loop.
    write: (chunk) => {
      queue = queue.then(() => writable.write(chunk));
      return queue;
    },
    close: async () => {
      await queue;
      await writable.close();
    },
  };
}

/** The caller decides what "download" means, keeping this browser-agnostic. */
export function createSegmentSink(
  onSegment: (blob: Blob, index: number) => void
): ChunkSink {
  let parts: Blob[] = [];
  let index = 0;
  return {
    label: "browser memory",
    continuous: false,
    async write(chunk) {
      parts.push(chunk);
    },
    async close() {
      if (!parts.length) return;
      onSegment(new Blob(parts, { type: parts[0].type || "video/webm" }), index);
      parts = [];
      index += 1;
    },
  };
}

export function segmentName(base: string, index: number): string {
  return index === 0 ? base : base.replace(/(\.\w{3,4})$/, `-${index}$1`);
}
