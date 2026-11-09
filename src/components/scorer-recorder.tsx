"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, Pause, Play, Square, Video, VideoOff } from "lucide-react";
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
  // Seconds, not minutes: stopping and starting again inside one minute must
  // not overwrite the film that was just saved.
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
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

export default function ScorerRecorder() {
  // Resolved after mount: the server has no File System Access API, and
  // deciding during render would hydrate the wrong explanation.
  const [streaming, setStreaming] = useState(false);
  const [phase, setPhase] = useState<RecorderPhase>("idle");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [written, setWritten] = useState(0);
  const [files, setFiles] = useState(0);
  const [audio, setAudio] = useState(true);
  const [preview, setPreview] = useState(true);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const sinkRef = useRef<ChunkSink | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const baseRef = useRef("");
  const segmentsRef = useRef(0);
  const legStartRef = useRef(0);
  const segmentStartRef = useRef(0);
  const accumulatedRef = useRef(0);
  const restartRef = useRef(false);
  const audioRef = useRef(audio);
  audioRef.current = audio;

  useEffect(() => setStreaming(supportsFileStreaming()), []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
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
    } catch (cause) {
      const name = (cause as { name?: string })?.name;
      setError(
        name === "NotFoundError" || name === "OverconstrainedError"
          ? "No camera was found on this device."
          : name === "NotReadableError" || name === "AbortError"
          ? "The camera is busy in another app. Close it, then press Record again."
          : "Camera permission was refused. Allow it in the address bar, then press Record again."
      );
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

  // The preview shares the stream the recorder writes, so what you frame is
  // what lands in the file.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const stream = streamRef.current;
    if (live && preview && stream) {
      if (video.srcObject !== stream) video.srcObject = stream;
      // Autoplay can still be refused; the recording is unaffected either way.
      void video.play().catch(() => undefined);
    } else {
      video.srcObject = null;
    }
  }, [live, preview, phase]);

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

  const status = live
    ? `${formatClock(elapsed)} · ${formatBytes(written)}${
        streaming ? "" : ` · ${files + 1} segment${files ? "s" : ""}`
      }`
    : phase === "stopped"
    ? streaming
      ? `saved ${formatBytes(written)}`
      : `${files} segment${files === 1 ? "" : "s"} · ${formatBytes(written)}`
    : phase === "requesting"
    ? "asking for the camera…"
    : "ready · nothing is uploaded";

  return (
    <section
      className={`glass rounded-2xl overflow-hidden transition-colors ${
        phase === "recording" ? "border-red-500/40" : ""
      }`}
      aria-label="Match camera"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 sm:p-4">
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            phase === "recording"
              ? "bg-red-500 animate-pulse"
              : phase === "paused"
              ? "bg-amber-400"
              : "bg-slate-600"
          }`}
        />
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300 flex items-center gap-1.5">
          {live ? (
            <Video className="w-4 h-4 text-red-400" aria-hidden />
          ) : (
            <VideoOff className="w-4 h-4 text-slate-500" aria-hidden />
          )}
          Camera
        </h2>
        <span
          className={`text-xs font-mono truncate ${
            phase === "recording" ? "text-red-200" : "text-slate-400"
          }`}
        >
          {status}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {live ? (
            <>
              <button
                onClick={() => setPreview((value) => !value)}
                className="rounded-xl px-3 py-2 text-xs font-semibold bg-slate-800/70 border border-slate-700/60 hover:bg-slate-800 transition-all"
              >
                {preview ? "Hide preview" : "Show preview"}
              </button>
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
          ) : (
            <button
              onClick={start}
              disabled={phase === "requesting"}
              className="rounded-xl px-5 py-2.5 text-sm font-bold bg-gradient-to-r from-red-500 to-rose-500 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-red-500/20"
            >
              <Circle className="w-3.5 h-3.5 fill-current" aria-hidden />
              {phase === "stopped" ? "Record again" : "Record"}
            </button>
          )}
        </div>
      </div>

      {live && preview ? (
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className="w-full h-28 sm:h-40 object-cover bg-black border-y border-slate-800/70"
        />
      ) : null}

      <div className="px-3 sm:px-4 py-2.5 border-t border-slate-800/60 flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={audio}
            onChange={(event) => setAudio(event.target.checked)}
            disabled={live}
            className="accent-red-500"
          />
          Microphone
        </label>
        <p className="text-[11px] text-slate-500 flex-1 min-w-[12rem] leading-relaxed">
          {streaming ? (
            <>
              Streams to a file you choose — one recording can cover a whole day.
              Keep this tab open and press{" "}
              <span className="text-slate-300">Stop</span> to close the file.
            </>
          ) : (
            <>
              Saves in {Math.round(SEGMENT_MS / 60_000)}-minute downloads —{" "}
              <span className="text-amber-300/90">allow multiple downloads</span>{" "}
              when the browser asks, or only the first segment is kept.
            </>
          )}{" "}
          The film never leaves this device.
        </p>
      </div>

      {error ? (
        <p className="text-xs text-red-300 px-3 sm:px-4 pb-3" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
