import test from "node:test";
import assert from "node:assert/strict";
import {
  createProject,
  parseProject,
  makeChord,
  getFingering,
  setFingering,
} from "../web/project.js";

test("JSON round trip retains guitars, parts, labels and custom fingerings", () => {
  const doc = createProject();
  const chord = makeChord();
  chord.label = "<Chorus & bridge>";
  setFingering(chord, doc.guitars[0].strings, [-1, 0, 2, 0, 1, 0]);
  doc.parts[0].chords.push(chord);
  assert.deepEqual(parseProject(JSON.stringify(doc)), doc);
});

test("retuning preserves prior grips, including string-count changes", () => {
  const chord = makeChord();
  const six = [40, 45, 50, 55, 59, 64];
  const eight = [30, 35, ...six];
  setFingering(chord, six, [-1, 0, 2, 0, 1, 0]);
  assert.equal(getFingering(chord, eight), null);
  setFingering(chord, eight, [-1, -1, -1, 0, 2, 0, 1, 0]);
  assert.deepEqual(getFingering(chord, six), [-1, 0, 2, 0, 1, 0]);
  const copy = getFingering(chord, six);
  copy[0] = 24;
  assert.equal(getFingering(chord, six)[0], -1);
});

test("reject invalid versions, references, pitches, counts, IDs, scales and frets", () => {
  const edits = [
    (d) => {
      d.version = 99;
    },
    (d) => {
      d.guitars = [];
    },
    (d) => {
      d.guitars[0].strings = Array(9).fill(40);
    },
    (d) => {
      d.guitars[0].strings[0] = 104;
    },
    (d) => {
      d.guitars[0].strings[0] = 40.5;
    },
    (d) => {
      d.parts[0].guitarId = "missing";
    },
    (d) => {
      d.parts[0].scale = "__proto__";
    },
    (d) => {
      d.parts[0].id = '\"><img src=x onerror=alert(1)>';
    },
    (d) => {
      d.parts.push(structuredClone(d.parts[0]));
    },
    (d) => {
      const c = makeChord();
      c.fingerings["40,45,50,55,59,64"] = [-1, 0];
      d.parts[0].chords.push(c);
    },
    (d) => {
      const c = makeChord();
      c.fingerings["40,45,50,55,59,64"] = [-1, 0, 25, 0, 1, 0];
      d.parts[0].chords.push(c);
    },
    (d) => {
      const c = makeChord();
      c.bass = 1;
      d.parts[0].chords.push(c);
    },
  ];
  for (const edit of edits) {
    const doc = createProject();
    edit(doc);
    assert.throws(() => parseProject(doc));
  }
});

test("parser reconstructs data without retaining foreign fields or references", () => {
  const doc = createProject();
  doc.extra = { malicious: true };
  const parsed = parseProject(doc);
  assert.equal(parsed.extra, undefined);
  doc.guitars[0].strings[0] = 1;
  assert.equal(parsed.guitars[0].strings[0], 40);
});
