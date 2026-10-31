import test from "node:test";
import assert from "node:assert/strict";
import { PRESETS, presetsForCount, resizeTuning } from "../web/tunings.js";

test("6/7/8-string presets filter by count and preserve upper strings on resize", () => {
  for (const count of [6, 7, 8]) {
    const presets = presetsForCount(count);
    assert.ok(presets.length >= 6);
    assert.ok(presets.every(([, p]) => p.strings.length === count));
  }
  const custom = [38, 45, 50, 55, 59, 64];
  assert.deepEqual(resizeTuning(custom, 8), [28, 33, ...custom]);
  assert.deepEqual(resizeTuning(resizeTuning(custom, 8), 6), custom);
  assert.throws(() => resizeTuning(custom, 9));
  assert.equal(
    new Set(Object.values(PRESETS).map((p) => p.strings.join())).size,
    Object.keys(PRESETS).length,
  );
});
