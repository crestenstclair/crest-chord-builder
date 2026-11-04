import test from "node:test";
import assert from "node:assert/strict";
import { groupVoicings, selectedNoteFrets } from "../web/voicings.js";

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


test("complete selected notes form an exact grip without the search engine", () => {
  const tuning = [40,45,50,55,59,64];
  const chord = { root: 9, intervals: [0,3,7,8] };
  const anchors = [{string:2,fret:3}, {string:3,fret:2}, {string:4,fret:1}, {string:5,fret:0}];
  const before = structuredClone(anchors);
  assert.deepEqual(selectedNoteFrets(tuning, chord, anchors), [-1,-1,3,2,1,0]);
  assert.deepEqual(anchors, before);
  assert.equal(selectedNoteFrets(tuning, chord, anchors.slice(1)), null);
  assert.equal(selectedNoteFrets(tuning, chord, []), null);
  for (const extra of [{string:5,fret:0}, {string:6,fret:0}, {string:0,fret:25}, {string:0,fret:2}, {string:0.5,fret:0}])
    assert.equal(selectedNoteFrets(tuning, chord, [...anchors, extra]), null);
  // Physical string order need not follow pitch order.
  assert.deepEqual(selectedNoteFrets([64,59,55,50,45,40], chord,
    [{string:0,fret:0}, {string:1,fret:1}, {string:2,fret:2}, {string:3,fret:3}]), [0,1,2,3,-1,-1]);
});
