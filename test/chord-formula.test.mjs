import test from "node:test";
import assert from "node:assert/strict";
import {
  selectChordTone,
  chordFormula,
  withSoundingIntervals,
  DEGREE_COLUMNS,
  FORMULA_TONES,
  simpleFormula,
  simpleInterval,
} from "../web/chord-formula.js";
import { chordName, chordInterval, chordFamily } from "../web/music.js";
import { createProject, makeChord, parseProject } from "../web/project.js";

const minor = () => makeChord(9, "min");
test("grid variants replace their degree in both directions and toggle off", () => {
  let chord = selectChordTone(minor(), "3");
  assert.deepEqual(chord.intervals, [0, 4, 7]);
  chord = selectChordTone(chord, "♭3");
  assert.deepEqual(chord.intervals, [0, 3, 7]);
  chord = selectChordTone(chord, "9");
  assert.deepEqual(chord.intervals, [0, 2, 3, 7]);
  assert.equal(chordName(chord), "Am(add9)");
  chord = selectChordTone(chord, "♭9");
  assert.deepEqual(chord.intervals, [0, 1, 3, 7]);
  chord = selectChordTone(chord, "♭9");
  assert.deepEqual(chord.intervals, [0, 3, 7]);
  for (const label of ["♯5", "♭5", "5"]) chord = selectChordTone(chord, label);
  assert.deepEqual(chord.intervals, [0, 3, 7]);
  assert.throws(
    () => selectChordTone({ root: 0, intervals: [0], bass: 0 }, "1"),
    /at least one/,
  );
});

test("enharmonic choices retain spelling and correct altered chord names", () => {
  let chord = selectChordTone(makeChord(0, "dom7"), "♯9");
  assert.equal(chordName(chord), "C7(♯9)");
  assert.equal(chordInterval(chord, 3), "♯2");
  assert.equal(chordFamily(chord), "dominant");
  chord = selectChordTone(chord, "♯11");
  assert.equal(chordName(chord), "C7(♯9,♯11)");
  chord = selectChordTone(chord, "♭5");
  assert.ok(!chord.formula.includes("♯11"));
  assert.ok(!chord.formula.includes("5"));
  assert.ok(chord.formula.includes("♭5"));
  const rootless = selectChordTone(chord, "1");
  assert.equal(rootless.bass, -1);
  assert.equal(rootless.root, 0);
});

test("names retain isolated extensions and manually placed interval clusters", () => {
  const dominant = makeChord(0, "dom7");
  assert.equal(chordName(selectChordTone(dominant, "11")), "C7(add11)");
  assert.equal(chordName(selectChordTone(dominant, "13")), "C7(add13)");
  assert.equal(
    chordName(selectChordTone(makeChord(0, "dim7"), "9")),
    "Cdim7(add9)",
  );
  const cluster = withSoundingIntervals(
    selectChordTone(minor(), "9"),
    [0, 2, 3, 4, 7],
  );
  assert.equal(chordName(cluster), "A [1·♭3·3·5·9]");
});

test("manual voicing edits preserve explicit spelling for unchanged tones", () => {
  const chord = selectChordTone(minor(), "♯11");
  const edited = withSoundingIntervals(chord, [0, 3, 6]);
  assert.deepEqual(chordFormula(edited), ["1", "♭3", "♯11"]);
  assert.equal(chordName(edited), "Am(♯11,no5)");
});

test("optional formulas round trip and malformed spelling cannot corrupt pitches", () => {
  const project = createProject();
  project.parts[0].chords.push(selectChordTone(makeChord(0, "dom7"), "♯11"));
  assert.deepEqual(parseProject(JSON.stringify(project)), project);
  for (const formula of [
    [],
    ["1", "3"],
    ["1", "3", "5", "♭7", "♯11", "♭5"],
    ["__proto__"],
    [1, "3", "5", "♭7", "♯11"],
  ]) {
    const invalid = structuredClone(project);
    invalid.parts[0].chords[0].formula = formula;
    assert.throws(() => parseProject(invalid), /formula/);
  }
});

test("interval grid follows 1–7, covers every pitch, and keeps compound labels secondary", () => {
  assert.deepEqual(DEGREE_COLUMNS.map(({ name }) => name), ["1", "2", "3", "4", "5", "6", "7"]);
  const tones = DEGREE_COLUMNS.flatMap(({ choices }) => choices.filter(Boolean));
  assert.deepEqual([...new Set(tones.map((label) => FORMULA_TONES[label].pitch))].sort((a, b) => a - b),
    Array.from({ length: 12 }, (_, i) => i));
  assert.deepEqual(["9", "11", "13", "♭9", "♯11", "♭13"].map(simpleInterval), ["2", "4", "6", "♭2", "♯4", "♭6"]);
});

test("adding second, fourth and sixth keeps the third and existing JSON spellings", () => {
  let chord = minor();
  for (const tone of ["9", "11", "13"]) chord = selectChordTone(chord, tone);
  const before = structuredClone(chord);
  assert.deepEqual(simpleFormula(chord), ["1", "2", "♭3", "4", "5", "6"]);
  assert.deepEqual(chord.intervals, [0, 2, 3, 5, 7, 9]);
  assert.deepEqual(chord, before, "display order must not mutate the saved chord");
  assert.equal(chordName(selectChordTone(minor(), "13")), "Am6");
  assert.equal(chordName(selectChordTone(makeChord(0, "maj"), "13")), "C6");
  const project = createProject();
  project.parts[0].chords.push(chord, makeChord(0, "sus2"), makeChord(0, "sus4"));
  assert.deepEqual(parseProject(JSON.stringify(project)), project);
  assert.deepEqual(simpleFormula(project.parts[0].chords[1]), ["1", "2", "5"]);
  assert.deepEqual(simpleFormula(project.parts[0].chords[2]), ["1", "4", "5"]);
});
