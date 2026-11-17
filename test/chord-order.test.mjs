import test from "node:test";
import assert from "node:assert/strict";
import { reorderChords, chordDropIndex } from "../web/chord-order.js";

test("moving a chord preserves every other chord's relative order and musical data", () => {
  const chords = ["a", "b", "c", "d"].map((id) => ({ id, fingerings: { tuning: [0, 2, 1] } }));
  const next = reorderChords(chords, "a", 2);
  assert.deepEqual(next.map((chord) => chord.id), ["b", "c", "a", "d"]);
  assert.deepEqual(chords.map((chord) => chord.id), ["a", "b", "c", "d"]);
  assert.equal(next[2], chords[0]);
  assert.deepEqual(reorderChords(next, "a", 0), chords);
  assert.deepEqual(reorderChords(chords, "d", 0).map((chord) => chord.id), ["d", "a", "b", "c"]);
});

test("no-op, missing and invalid moves keep array identity, avoiding empty Undo entries", () => {
  const chords = [{ id: "a" }, { id: "b" }];
  for (const destination of [-1, 0, 2, 1.5, NaN, "1"])
    assert.equal(reorderChords(chords, "a", destination), chords);
  assert.equal(reorderChords(chords, "missing", 1), chords);
  const empty = [];
  assert.equal(reorderChords(empty, "a", 0), empty);
});

test("drop edges compensate for removing the source in either direction", () => {
  assert.equal(chordDropIndex(0, 2, true), 2);
  assert.equal(chordDropIndex(0, 2, false), 1);
  assert.equal(chordDropIndex(3, 0, false), 0);
  assert.equal(chordDropIndex(3, 0, true), 1);
  assert.equal(chordDropIndex(2, 2, false), 2);
  assert.equal(chordDropIndex(2, 2, true), 2);
});
