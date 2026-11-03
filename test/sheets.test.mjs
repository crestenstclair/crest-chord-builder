import test from "node:test";
import assert from "node:assert/strict";
import { createProject, parseProject } from "../web/project.js";
import { makeSheet, parseSheet } from "../web/sheet-data.js";
import { parseTab, renderTab } from "../web/tablature.js";

const tab = () => ({ format: "crest-tab", version: 1, title: "Test phrase", tuning: [40,45,50,55,59,64], tempo: 90, meter: [3,4], startBar: 17, bars: 8, events: [
  { beat: 0, duration: 6, string: 1, fret: 7, midi: 71 },
  { beat: 12, duration: 1.75, string: 1, fret: 10, midi: 74 },
  { beat: 13.75, duration: 1.25, string: 1, fret: 7, midi: 71 },
] });

test("v1 and v2 migrate without mutation; sheets and files survive a v3 JSON round trip", () => {
  for (const version of [1,2]) {
    const old = { ...createProject(), version };
    const before = structuredClone(old);
    assert.deepEqual(parseProject(old), { ...before, version: 3 });
    assert.deepEqual(old, before);
  }
  const doc = createProject();
  doc.parts[0].sheet = { ...makeSheet(), source: '<style>h1{color:red}</style>\n# Tabs', files: [{ name: "phrase.json", mime: "application/json", encoding: "utf8", content: JSON.stringify(tab()) }] };
  assert.deepEqual(parseProject(JSON.stringify(doc)), doc);
  const parsed = parseProject(doc);
  doc.parts[0].sheet.files[0].content = "changed";
  assert.notEqual(parsed.parts[0].sheet.files[0].content, "changed");
});

test("sheet boundaries reject malformed files, paths, sizes and duplicate names", () => {
  const file = { name: "notes.md", mime: "text/markdown", encoding: "utf8", content: "# Notes" };
  for (const edit of [
    (s) => { s.format = "mdx"; },
    (s) => { s.source = {}; },
    (s) => { s.source = "x".repeat(200001); },
    (s) => { s.files[0].name = "../notes.md"; },
    (s) => { s.files[0].mime = "text/unknown"; },
    (s) => { s.files[0].encoding = "base64"; },
    (s) => { s.files[0].content = "x".repeat(524289); },
    (s) => { s.files.push(file); },
  ]) {
    const sheet = { ...makeSheet(), files: [structuredClone(file)] };
    edit(sheet);
    assert.throws(() => parseSheet(sheet));
  }
});

test("tablature retains exact durations and absolute bars without hiding notes", () => {
  const parsed = parseTab(tab());
  assert.equal(parsed.events[2].beat, 13.75);
  assert.equal(parsed.events[2].duration, 1.25);
  const markup = renderTab(tab(), { "bars-per-row": "4", strings: "1,2,3" });
  assert.match(markup, /bars 17–24/);
  assert.match(markup, /data-notation=/);
  assert.match(markup, /sourceBeat&quot;:13.75/);
  assert.equal(renderTab(tab(), { strings: "2,3" }), renderTab(tab()));
  assert.match(renderTab(tab(), {}, [28,33,40,45,50,55,59,64]), /different tuning/);
});

test("invalid tabs cannot silently change pitches, overlap a string or omit out-of-range events", () => {
  for (const edit of [
    (t) => { t.events[0].midi = 70; },
    (t) => { t.events[0].string = 7; },
    (t) => { t.events[0].fret = 25; },
    (t) => { t.events[0].duration = -1; },
    (t) => { t.events[0].beat = 30; },
    (t) => { t.events[0].duration = 25; },
    (t) => { t.events[1].beat = 5; },
    (t) => { t.meter = [0,4]; },
  ]) {
    const value = tab(); edit(value); assert.throws(() => parseTab(value));
  }
});
