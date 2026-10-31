import test from "node:test";
import assert from "node:assert/strict";
import {
  scaleChords,
  scaleNotes,
  pitchName,
  tuningInterval,
  describeFingering,
  fretMatches,
  moveVoice,
  soundingNotes,
  SCALES,
} from "../web/music.js";

const standard = [40, 45, 50, 55, 59, 64];

test("scale spelling and harmony match the C minor reference", () => {
  assert.deepEqual(
    scaleNotes(0, "minor").map((n) => n.name),
    ["C", "D", "E♭", "F", "G", "A♭", "B♭"],
  );
  assert.deepEqual(
    scaleChords(0, "minor", 3).map((c) => c.name),
    ["Cm", "Ddim", "E♭", "Fm", "Gm", "A♭", "B♭"],
  );
  assert.deepEqual(
    scaleChords(0, "minor", 4).map((c) => c.name),
    ["Cm7", "Dm7♭5", "E♭maj7", "Fm7", "Gm7", "A♭maj7", "B♭7"],
  );
  assert.deepEqual(
    scaleNotes(2, "major").map((n) => n.name),
    ["D", "E", "F♯", "G", "A", "B", "C♯"],
  );
  assert.equal(scaleChords(9, "minor", 3, true)[0].name, "Am/C");
});

test("every generated scale chord stays inside its selected scale", () => {
  for (const scale of Object.keys(SCALES)) {
    for (let root = 0; root < 12; root++) {
      const allowed = scaleNotes(root, scale).map((n) => n.pc);
      for (const chord of scaleChords(root, scale, 5)) {
        assert.equal(chord.intervals.length, 5);
        assert.ok(
          chord.intervals.every((n) => allowed.includes((chord.root + n) % 12)),
        );
      }
    }
  }
});

test("pitch labels and tuning intervals preserve octave and direction", () => {
  assert.equal(pitchName(40), "E2");
  assert.equal(pitchName(64), "E4");
  assert.equal(tuningInterval(40, 64), "2 octaves · 24 st");
  assert.equal(tuningInterval(55, 59), "M3 · 4 st");
  assert.equal(tuningInterval(64, 52), "↓ P8 · 12 st");
});

test("octave shifts preserve quality and update the actual bass", () => {
  const original = [-1, 0, 2, 0, 1, 0];
  assert.equal(describeFingering(standard, original, 9).name, "Am7");
  assert.equal(
    describeFingering(standard, [-1, 12, 2, 0, 1, 0], 9).name,
    "Am7/E",
  );
  assert.equal(
    describeFingering([64, 45, 50, 55, 59, 40], [0, 0, 2, 0, 1, -1], 9).name,
    "Am7",
  );
  assert.equal(
    describeFingering(
      standard,
      original.map(() => -1),
      9,
    ).name,
    "Muted",
  );
});

test("changed notes rename the chord and ambiguous harmony prefers its root", () => {
  assert.equal(describeFingering(standard, [-1, 0, 2, 2, 2, 0], 9).name, "A");
  assert.equal(
    describeFingering(standard, [-1, 0, 2, 0, 1, 0], 0).name,
    "C6/A",
  );
});

test("matching positions use current tuning and distinguish octaves", () => {
  const matches = fretMatches(standard, 55, 0, 12);
  assert.ok(
    matches.some((n) => n.string === 2 && n.fret === 5 && n.midi === 55),
  );
  assert.ok(
    matches.some((n) => n.string === 5 && n.fret === 3 && n.midi === 67),
  );
  assert.ok(
    !fretMatches([38, 45, 50, 55, 59, 64], 55, 0, 12).some(
      (n) => n.string === 0 && n.fret === 3,
    ),
  );
});

test("moving a voice preserves its pitch and never overwrites another voice", () => {
  const frets = [-1, 0, -1, 0, 1, 0];
  const moved = moveVoice(frets, 3, 2, 5);
  assert.deepEqual(moved, [-1, 0, 5, -1, 1, 0]);
  assert.deepEqual(
    soundingNotes(standard, moved).sort(),
    soundingNotes(standard, frets).sort(),
  );
  assert.throws(() => moveVoice(frets, 3, 1, 10), /already has a note/);
  assert.deepEqual(frets, [-1, 0, -1, 0, 1, 0]);
});
