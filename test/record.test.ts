import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createSegmentSink,
  segmentName,
  segmentDue,
  SEGMENT_MS,
} from "../src/lib/record.ts";

const BASE = "pundit-arena-2026-11-12-10-00-00.webm";

/**
 * The recorder rotates by stopping the MediaRecorder and flushing the sink, then
 * reusing that same sink for the next leg. Each flush must carry the next index
 * and only its own chunks — recreating the sink per rotation once made every
 * segment download under the first segment's name.
 */
test("a reused segment sink numbers each rotation distinctly and in isolation", async () => {
  const flushed: { index: number; blob: Blob }[] = [];
  const sink = createSegmentSink((blob, index) => flushed.push({ index, blob }));

  for (let i = 0; i < 3; i += 1) {
    await sink.write(new Blob([`chunk-${i}`], { type: "video/webm" }));
    await sink.close();
  }

  assert.deepEqual(flushed.map((f) => f.index), [0, 1, 2]);
  const names = flushed.map((f) => segmentName(BASE, f.index));
  assert.equal(new Set(names).size, 3, "every segment downloads under a distinct name");
  assert.deepEqual(names, [BASE, `${BASE.replace(".webm", "")}-1.webm`, `${BASE.replace(".webm", "")}-2.webm`]);

  const contents = await Promise.all(flushed.map((f) => f.blob.text()));
  assert.deepEqual(contents, ["chunk-0", "chunk-1", "chunk-2"], "a flush holds only its own leg");
});

test("closing an empty sink emits nothing", async () => {
  let calls = 0;
  const sink = createSegmentSink(() => {
    calls += 1;
  });
  await sink.close();
  assert.equal(calls, 0);
});

test("segmentName leaves the first segment unsuffixed", () => {
  assert.equal(segmentName("film.webm", 0), "film.webm");
  assert.equal(segmentName("film.webm", 1), "film-1.webm");
  assert.equal(segmentName("film.mp4", 12), "film-12.mp4");
});

test("segmentDue fires only once the segment window elapses", () => {
  assert.equal(segmentDue(SEGMENT_MS - 1), false);
  assert.equal(segmentDue(SEGMENT_MS), true);
  assert.equal(segmentDue(0, 1000), false);
  assert.equal(segmentDue(1000, 1000), true);
});