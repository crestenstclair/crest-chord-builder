import test from "node:test";
import assert from "node:assert/strict";
import { groupVoicings } from "../web/voicings.js";

test("inversion groups use sounding bass and preserve ranking within each group", () => {
  // Re-entrant bass-side E4 is above the inner A2 string.
  const tuning = [64, 45, 50, 55, 59, 64];
  const voicings = [
    { frets: [0, 3, 2, 0, 1, 0] }, // C3 bass
    { frets: [0, 0, 2, 0, 1, 0] }, // A2 bass
    { frets: [0, 3, 2, 0, 1, -1] }, // C3 bass
    { frets: [0, -1, 2, 0, 1, 0] }, // E3 bass
  ];
  assert.deepEqual(groupVoicings(tuning, 9, voicings), [
    { bass: 9, indices: [1] },
    { bass: 0, indices: [0, 2] },
    { bass: 4, indices: [3] },
  ]);
  assert.deepEqual(groupVoicings(tuning, 9, []), []);
});
