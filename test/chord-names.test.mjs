import test from "node:test";
import assert from "node:assert/strict";
import { chordNameOptions } from "../web/chord-names.js";
import { chordName, scaleNotes, toneSet } from "../web/music.js";

const tuning = [40,45,50,55,59,64];
const key = scaleNotes(9, "minor").map((note) => note.pc);

test("naming offers alternate roots without changing the selected notes", () => {
  const frets = [-1,-1,3,2,1,0];
  const before = [...frets];
  const options = chordNameOptions(tuning, frets, key, 9);
  assert.equal(chordName(options[0]), "Fmaj7");
  assert.ok(options.some((option) => chordName(option) === "Am(♭13)/F"));
  assert.ok(options[0].inKey);
  assert.deepEqual(frets, before);
  for (const option of options) {
    assert.deepEqual(toneSet(option).sort((a,b) => a-b), [0,4,5,9]);
    assert.equal(option.bass, 5);
  }
  assert.equal(new Set(options.map((option) => option.root)).size, options.length);
});

test("names never recommend an unplayed root", () => {
  const options = chordNameOptions(tuning, [0,-1,-1,0,0,-1], key, 9); // E G B
  assert.equal(chordName(options[0]), "Em");
  for (const option of options) {
    assert.ok([4,7,11].includes(option.root));
    assert.ok(option.intervals.includes(0));
    assert.ok(!chordName(option).includes("no1"));
  }
});

test("D C F E suggests Dm9(no5), with key membership including its omitted fifth", () => {
  const frets = [-1,-1,0,5,6,0];
  const options = chordNameOptions(tuning, frets, key, 9);
  assert.equal(chordName(options[0]), "Dm9(no5)");
  assert.deepEqual(options[0].impliedTones, [9]);
  assert.ok(options[0].inKey);
  assert.ok(options.every((option) => option.intervals.includes(0)));
  assert.ok(!options.some((option) => option.root === 9));
  const withoutFifth = chordNameOptions(tuning, frets, [0,2,4,5], 9);
  assert.equal(withoutFifth.find((option) => option.root === 2).inKey, false);
});

test("an unnamed cluster falls back to a played root instead of the absent preferred root", () => {
  const frets = [-1,3,-1,-1,2,-1]; // C D♭, with C in the bass.
  const options = chordNameOptions(tuning, frets, key, 9);
  assert.equal(options.length, 1);
  assert.equal(options[0].root, 0);
  assert.ok(options[0].intervals.includes(0));
  assert.ok(!chordName(options[0]).includes("no1"));
  const preferredPlayed = chordNameOptions(tuning, frets, key, 1);
  assert.equal(preferredPlayed[0].root, 1);
});

test("empty, single-note, custom-scale and re-entrant inputs remain honest", () => {
  assert.deepEqual(chordNameOptions(tuning, tuning.map(() => -1), key, 9), []);
  const one = chordNameOptions(tuning, [0,-1,-1,-1,-1,0], [4], 9);
  assert.deepEqual(one, []);
  const options = chordNameOptions([64,45,50,55,59,64], [0,3,2,0,-1,-1], [0,4,7], 0);
  assert.equal(chordName(options[0]), "C");
  assert.equal(options[0].bass, 0);
  assert.equal(options[0].inKey, true);
});
