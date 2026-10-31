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
  chordName,
  chordInterval,
  toggleChordInterval,
  extendChord,
  intervalControls,
  partScale,
  toneSet,
  seventhForChord,
  voicedChord,
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
  for (const scale of Object.keys(SCALES).filter(
    (key) => SCALES[key].intervals.length === 7,
  )) {
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

test("preset and custom scale triads contain only collection pitches", () => {
  const collections = [
    ...Object.values(SCALES),
    { name: "Custom", custom: true, intervals: [0, 2, 4, 7, 9] },
  ];
  for (const scale of collections) {
    for (let root = 0; root < 12; root++) {
      const allowed = scaleNotes(root, scale).map((n) => n.pc);
      for (const chord of scaleChords(root, scale, 3)) {
        assert.equal(chord.intervals.length, 3);
        assert.ok(toneSet(chord).every((n) => allowed.includes(n)));
      }
    }
  }
  assert.equal(
    partScale({
      scale: "custom",
      customScale: { name: "Mine", intervals: [0, 4, 7] },
    }).name,
    "Mine",
  );
});

test("extensions, omissions and inversions keep the harmonic root", () => {
  const triad = { root: 9, intervals: [0, 3, 7], bass: 9 };
  const seventh = extendChord(triad, "7");
  assert.equal(chordName(seventh), "Am7");
  assert.equal(chordName(extendChord(seventh, "9")), "Am9");
  assert.equal(chordName(extendChord(seventh, "13")), "Am13");
  assert.equal(chordInterval(extendChord(seventh, "13"), 6), "13");
  assert.equal(chordName(toggleChordInterval(seventh, 7)), "Am7(no5)");
  const rootless = toggleChordInterval(seventh, 0);
  assert.equal(rootless.root, 9);
  assert.equal(rootless.bass, -1);
  assert.equal(chordName(rootless), "Am7(no1)");
  assert.equal(chordName({ ...seventh, bass: 0 }), "Am7/C");
  assert.equal(
    chordName(
      extendChord({ root: 0, intervals: [0, 4, 7], bass: 0 }, "dominant7"),
    ),
    "C7",
  );
  assert.ok(intervalControls("min", 11).some(([n]) => n === 11));
  assert.throws(
    () => toggleChordInterval({ root: 0, intervals: [0], bass: 0 }, 0),
    /at least one/,
  );
});

test("default sevenths follow the part scale and explicit seventh choices persist", () => {
  const tones = scaleNotes(9, "minor").map((n) => n.pc);
  assert.equal(seventhForChord({ root: 7, intervals: [0, 4, 7] }, tones), 10);
  assert.equal(seventhForChord({ root: 5, intervals: [0, 4, 7] }, tones), 11);
  assert.equal(seventhForChord({ root: 11, intervals: [0, 3, 6] }, tones), 10);
  assert.equal(
    seventhForChord({ root: 7, intervals: [0, 4, 7, 11] }, tones),
    11,
  );
  assert.equal(chordInterval({ root: 0, intervals: [0, 4, 8] }, 8), "♯5");
  assert.equal(
    chordName(extendChord({ root: 0, intervals: [0, 3, 6, 9] }, "dominant7")),
    "Cm7♭5",
  );
});

test("restored tuning snapshots describe actual harmony but preserve an optional fifth", () => {
  const major = { root: 9, intervals: [0, 4, 7], bass: 9 };
  const minorGrip = describeFingering(standard, [-1, 0, 2, 2, 1, 0], 9);
  assert.equal(chordName(voicedChord(major, minorGrip)), "Am");
  const ninth = { root: 9, intervals: [0, 2, 3, 7, 10], bass: 9 };
  const noFifth = describeFingering(standard, [-1, 0, -1, 0, 1, 7], 9);
  assert.equal(chordName(voicedChord(ninth, noFifth)), "Am9");
  assert.equal(scaleNotes(0, "lydian")[3].interval, "♯4");
  assert.equal(scaleNotes(0, "hungarianMinor")[3].interval, "♯4");
});
