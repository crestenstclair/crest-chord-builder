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

test("v1 migration preserves all musical data and leaves its input unchanged", () => {
  const legacy = createProject();
  legacy.version = 1;
  const chord = makeChord(9, "min7");
  setFingering(chord, legacy.guitars[0].strings, [-1, 0, 2, 0, 1, 0]);
  legacy.parts[0].chords.push(chord);
  const before = structuredClone(legacy);
  const migrated = parseProject(legacy);
  assert.deepEqual(legacy, before);
  assert.deepEqual(migrated, { ...before, version: 2 });
  assert.deepEqual(parseProject(JSON.stringify(migrated)), migrated);
});

test("custom scales and rootless chords round trip with boundary validation", () => {
  const doc = createProject();
  Object.assign(doc.parts[0], {
    scale: "custom",
    customScale: { name: "Five tones", intervals: [0, 2, 4, 7, 9] },
  });
  doc.parts[0].chords.push({
    ...makeChord(0, "dom7"),
    intervals: [4, 7, 10],
    bass: 4,
  });
  assert.deepEqual(parseProject(JSON.stringify(doc)), doc);
  for (const intervals of [[], [2, 4, 7], [0, 0, 4], [0, 12], [0, 1.5]]) {
    const invalid = structuredClone(doc);
    invalid.parts[0].customScale.intervals = intervals;
    assert.throws(() => parseProject(invalid));
  }
});
