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

test("key membership checks implied roots and fifths, not just played tones", () => {
  const options = chordNameOptions(tuning, [0,-1,-1,0,0,-1], key, 9); // E G B
  assert.equal(chordName(options[0]), "Em");
  const cMajor = options.find((option) => option.root === 0);
  assert.equal(chordName(cMajor), "Cmaj7(no1)/E");
  assert.deepEqual(cMajor.impliedTones, [0]);
  assert.ok(cMajor.inKey);
  const alteredRoot = options.find((option) => option.root === 1);
  assert.equal(alteredRoot.inKey, false);
  assert.deepEqual(alteredRoot.impliedTones, [1]);
  const modified = options.find((option) => option.root === 6);
  assert.ok(modified.impliedTones.includes(6));
  assert.equal(modified.inKey, false);
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
