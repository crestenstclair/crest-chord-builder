import test from "node:test";
import assert from "node:assert/strict";
import { parseTab, tabPlaybackPlan } from "../web/tablature.js";
import { tabNotation } from "../web/tab-notation.js";

function score(events, overrides = {}) {
  return parseTab({ format: "crest-tab", version: 1, title: "Notation", tuning: [40,45,50,55,59,64],
    meter: [3,4], tempo: 90, startBar: 17, bars: 4, events, ...overrides });
}
function notation(tab) {
  const model = tabNotation(tab, { first: tab.startBar, bars: tab.bars, perRow: 2 });
  for (const measure of model.measures) for (const voice of measure.voices) {
    let beat = measure.start;
    for (const token of voice) {
      assert.ok(Math.abs(token.beat - beat) < 0.000001, "no missing or overlapping time");
      beat += token.length;
    }
    assert.ok(Math.abs(beat - measure.end) < 0.000001, "each voice fills the measure");
  }
  return model;
}
const note = (beat, duration, string = 1, fret = 7) => ({ beat, duration, string, fret });

test("sustains split at barlines with one source attack, and empty bars use measure rests", () => {
  const tab = score([note(0, 6)]), before = structuredClone(tab);
  const model = notation(tab);
  assert.equal(model.measures[0].number, 17);
  const a = model.measures[0].voices[0][0], b = model.measures[1].voices[0][0];
  assert.equal(a.duration, "2");
  assert.equal(a.dots, 1);
  assert.equal(a.group, b.group);
  assert.equal(a.group.sourceDuration, 6);
  assert.equal(model.measures[2].voices[0][0].wholeRest, true);
  assert.deepEqual(tab, before);
  assert.equal(tabPlaybackPlan(tab, { first: 17, bars: 4 }).events.length, 1);
});

test("syncopation uses a double-dotted quarter, sixteenth and tied quarter", () => {
  const model = notation(score([note(0, 1.75, 1, 10), note(1.75, 1.25)]));
  assert.deepEqual(model.measures[0].voices[0].map(({ duration, dots, length }) => [duration, dots, length]),
    [["4", 2, 1.75], ["16", 0, .25], ["4", 0, 1]]);
});

test("triplets, rests and compound or odd meters retain complete bar durations", () => {
  for (const meter of [[3,4], [6,8], [5,8], [7,16]]) {
    const model = notation(score([note(0, 1/3), note(1/3, 1/3), note(2/3, 1/3)], { meter }));
    const triplet = model.measures[0].voices[0].filter((token) => token.triplet !== null);
    assert.equal(triplet.length, 3);
    assert.ok(triplet.every((token) => token.duration === "8" && token.triplet === 0));
    assert.equal(model.rounded, false);
  }
});

test("simultaneous equal durations form chords; overlapping durations use independent voices", () => {
  const model = notation(score([note(0, 3), note(0, 3, 2), note(.5, 1, 3), note(1.5, 2, 3)]));
  assert.equal(model.measures[0].voices.length, 2);
  assert.equal(model.measures[0].voices[0][0].group.positions.length, 2);
  assert.equal(model.measures[0].voices[1][0].group, null);
});

test("fine timing rounding is explicit and never changes playback data", () => {
  const tab = score([note(.01, .98)]), original = structuredClone(tab);
  assert.equal(notation(tab).rounded, true);
  assert.deepEqual(tab, original);
  assert.deepEqual(tabPlaybackPlan(tab, { first: 17, bars: 4 }).events, [{ beat: .01, duration: .98, midi: 71 }]);
  assert.throws(() => notation(score([note(0, .0001)])), /too short/);
});
