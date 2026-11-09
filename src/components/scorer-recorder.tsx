"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, Pause, Play, Square } from "lucide-react";
import {
  SEGMENT_MS,
  type ChunkSink,
  type RecorderPhase,
  createFileSink,
  createSegmentSink,
  formatBytes,
  formatClock,
  pickMimeType,
  segmentDue,
  segmentName,
  supportsFileStreaming,
} from "@/lib/record";

/** Chunks land every 5s, so a crash or a closed tab loses at most that much. */
const TIMESLICE_MS = 5_000;

function baseName(): string {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return `pundit-arena-${stamp}.webm`;
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  // Revoking too soon truncates the file in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function ScorerRecorder({ disabled }: { disabled?: boolean }) {
  const streaming = supportsFileStreaming();
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [written, setWritten] = useState(0);
  const [files, setFiles] = useState(0);
  const [audio, setAudio] = useState(true);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const sinkRef = useRef<ChunkSink | null>(null);
  const baseRef = useRef("");
  const segmentsRef = useRef(0);
  const legStartRef = useRef(0);
  const segmentStartRef = useRef(0);
  const accumulatedRef = useRef(0);
  const restartRef = useRef(false);
  const audioRef = useRef(audio);
  audioRef.current = audio;

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const fail = useCallback((message: string) => {
    setError(message);
    setPhase("error");
  }, []);

  /**
   * Starts one recorder on the live stream. In memory mode a fresh sink per
   * segment is what keeps the tab from holding hours of video; in file mode
   * the single open sink is reused, which is how one recording spans a day.
   */
  const openSegment = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

    const mimeType =
      typeof MediaRecorder.isTypeSupported === "function"
        ? pickMimeType((type) => MediaRecorder.isTypeSupported(type))
        : "";
    const recorder = new MediaRecorder(
      stream,
      mimeType
        ? { mimeType, videoBitsPerSecond: 250_000, audioBitsPerSecond: 64_000 }
        : {}
    );

    if (!sinkRef.current?.continuous) {
      sinkRef.current = createSegmentSink((blob, index) => {
        download(blob, segmentName(baseRef.current, index));
        segmentsRef.current = index + 1;
        setFiles(segmentsRef.current);
      });
    }
    const sink = sinkRef.current;

    recorder.ondataavailable = (event) => {
      const chunk = event.data;
      if (!chunk || chunk.size === 0) return;
      sink
        .write(chunk)
        .then(() => setWritten((total) => total + chunk.size))
        .catch(() => fail("Could not write to the recording."));
    };
    recorder.onerror = () => fail("The recording stopped on its own.");
    recorder.onstop = () => {
      void sink.close().catch(() => fail("The recording file could not be closed."));
      if (restartRef.current) {
        restartRef.current = false;
        openSegment();
      }
    };

    recorder.start(TIMESLICE_MS);
    recorderRef.current = recorder;
    segmentStartRef.current = Date.now();
  }, [fail]);

  const start = useCallback(async () => {
    setError("");
    setWritten(0);
    setFiles(0);
    setElapsed(0);
    segmentsRef.current = 0;
    accumulatedRef.current = 0;
    baseRef.current = baseName();
    setPhase("requesting");

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser will not share the camera. Open the app over https.");
      setPhase("error");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: audioRef.current,
      });
    } catch {
      setError("Camera permission was refused.");
      setPhase("idle");
      return;
    }
    streamRef.current = stream;

    if (streaming) {
      try {
        sinkRef.current = await createFileSink(baseRef.current);
      } catch (cause) {
        stopTracks();
        const name = (cause as { name?: string })?.name;
        setError(
          name === "AbortError"
            ? "No destination file was chosen."
            : "Could not open the recording file."
        );
        setPhase("idle");
        return;
      }
    }

    openSegment();
    legStartRef.current = Date.now();
    setPhase("recording");
  }, [openSegment, stopTracks, streaming]);

  const stopAll = useCallback(() => {
    restartRef.current = false;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    recorderRef.current = null;
    sinkRef.current = null;
    stopTracks();
    setPhase("stopped");
  }, [stopTracks]);

  const togglePause = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === "recording") {
      recorder.pause();
      accumulatedRef.current += Date.now() - legStartRef.current;
      setPhase("paused");
    } else if (recorder.state === "paused") {
      legStartRef.current = Date.now();
      recorder.resume();
      setPhase("recording");
    }
  }, []);

  const live = phase === "recording" || phase === "paused";

  // Elapsed time and, in memory mode, the segment rotation. A throttled
  // background tab fires this late, which only delays the next save — the
  // recorder itself is not throttled.
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      if (phase !== "recording") return;
      const now = Date.now();
      setElapsed(accumulatedRef.current + (now - legStartRef.current));
      if (!sinkRef.current?.continuous && segmentDue(now - segmentStartRef.current)) {
        const recorder = recorderRef.current;
        if (recorder?.state === "recording") {
          restartRef.current = true;
          recorder.stop();
        }
      }
    }, 1_000);
    return () => clearInterval(timer);
  }, [live, phase]);

  // A recording tab closed by mistake loses an afternoon of the match.
  useEffect(() => {
    if (!live) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [live]);

  useEffect(() => () => stopTracks(), [stopTracks]);

  return (
    <section className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 mr-auto">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              phase === "recording"
                ? "bg-red-500 animate-pulse"
                : phase === "paused"
                ? "bg-amber-400"
                : "bg-slate-600"
            }`}
          />
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
            Camera
          </h2>
          {live ? (
            <span className="text-xs font-mono text-slate-300">
              {formatClock(elapsed)} · {formatBytes(written)}
              {streaming ? "" : ` · ${files + 1} segment${files ? "s" : ""}`}
            </span>
          ) : null}
          {phase === "stopped" ? (
            <span className="text-xs font-mono text-slate-400">
              {streaming
                ? `saved ${formatBytes(written)}`
                : `${files} segment${files === 1 ? "" : "s"} · ${formatBytes(written)}`}
            </span>
          ) : null}
        </div>

        {phase === "requesting" ? (
          <span className="text-xs text-slate-400">Asking for the camera…</span>
        ) : !live ? (
          <button
            onClick={start}
            disabled={disabled}
            className="rounded-xl px-4 py-2 text-sm font-bold bg-gradient-to-r from-red-500 to-rose-500 hover:scale-[1.02] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Circle className="w-3.5 h-3.5 fill-current" aria-hidden />
            {phase === "stopped" ? "Record again" : "Record"}
          </button>
        ) : (
          <>
            <button
              onClick={togglePause}
              className="rounded-xl px-3 py-2 text-sm font-semibold bg-slate-800/70 border border-slate-700/60 hover:bg-slate-800 transition-all flex items-center gap-1.5"
            >
              {phase === "recording" ? (
                <>
                  <Pause className="w-3.5 h-3.5" aria-hidden /> Pause
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" aria-hidden /> Resume
                </>
              )}
            </button>
            <button
              onClick={stopAll}
              className="rounded-xl px-4 py-2 text-sm font-bold bg-slate-800/70 border border-slate-700/60 hover:bg-slate-800 transition-all flex items-center gap-1.5"
            >
              <Square className="w-3.5 h-3.5 fill-current" aria-hidden /> Stop
            </button>
          </>
        )}
      </div>

      <label className="flex items-start gap-2 mt-3 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={audio}
          onChange={(event) => setAudio(event.target.checked)}
          disabled={live}
          className="accent-red-500 mt-0.5"
        />
        <span>
          Record the microphone too.{" "}
          <span className="text-slate-600">
            Nothing is uploaded — the film stays on this device.
          </span>
        </span>
      </label>

      <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
        {streaming ? (
          <>
            Chunks are written straight to a file you choose, so one recording
            can cover a whole day. Keep this tab open: closing it ends the
            recording and the last five seconds may not be flushed. Press{" "}
            <span className="text-slate-300">Stop</span> to close the file
            properly.
          </>
        ) : (
          <>
            This browser cannot write to a chosen file, so the film saves in{" "}
            {Math.round(SEGMENT_MS / 60_000)}-minute segments that download as
            they finish — allow multiple downloads when asked, or everything
            after the first segment is blocked. Recording continues in a
            background tab, but the next segment may not save until you look at
            it again.
          </>
        )}
      </p>

      {error ? (
        <p className="text-xs text-red-300 mt-2" role="status">
          {error}
        </p>
      ) : null}
    </section>
  );
}
