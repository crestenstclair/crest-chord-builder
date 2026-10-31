import { PRESETS, SCALES, QUALITIES, mod12, toneSet } from "./music.js";

export const STORAGE_KEY = "crest-chord-builder.project.v1";
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const id = () => crypto.randomUUID();
export const tuningKey = (strings) => strings.join(",");
export const makeChord = (root = 9, quality = "min7") => ({
  id: id(),
  root,
  intervals: [...QUALITIES[quality].intervals],
  bass: -1,
  label: "",
  fingerings: {},
});
export const makePart = (guitarId, number = 1) => ({
  id: id(),
  name: `Part ${number}`,
  guitarId,
  root: 9,
  scale: "minor",
  chords: [],
});

export function createProject() {
  const guitar = {
    id: id(),
    name: PRESETS.standard.name,
    strings: [...PRESETS.standard.strings],
  };
  const part = { ...makePart(guitar.id), name: "First idea" };
  return {
    format: "crest-chord-builder",
    version: 1,
    title: "Untitled session",
    guitars: [guitar],
    parts: [part],
  };
}

const fail = (message) => {
  throw new Error(message);
};
const record = (v, name) =>
  v && typeof v === "object" && !Array.isArray(v)
    ? v
    : fail(`${name} must be an object.`);
const text = (v, name, max = 120) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max
    ? v
    : fail(`${name} must contain 1–${max} characters.`);
const integer = (v, low, high, name) =>
  Number.isInteger(v) && v >= low && v <= high
    ? v
    : fail(`${name} must be ${low}–${high}.`);
const list = (v, low, high, name) =>
  Array.isArray(v) && v.length >= low && v.length <= high
    ? v
    : fail(`${name} must contain ${low}–${high} items.`);
const identifier = (value) =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value)
    ? value
    : fail("IDs must contain 1–80 letters, numbers, hyphens, or underscores.");

function parseTuning(value) {
  return list(value, 1, 8, "Strings").map((n) =>
    integer(n, 0, 103, "Open MIDI pitch"),
  );
}

function parseGuitar(value) {
  record(value, "Guitar");
  return {
    id: identifier(value.id),
    name: text(value.name, "Guitar name"),
    strings: parseTuning(value.strings),
  };
}

function parseFingering([key, frets]) {
  const tuning = key.split(",").map(Number);
  parseTuning(tuning);
  if (tuningKey(tuning) !== key) fail("Invalid fingering tuning key.");
  return [
    key,
    list(frets, tuning.length, tuning.length, "Fingering").map((f) =>
      integer(f, -1, 24, "Fret"),
    ),
  ];
}

function parseChord(value) {
  record(value, "Chord");
  const intervals = list(value.intervals, 1, 12, "Chord intervals").map((n) =>
    integer(n, 0, 11, "Interval"),
  );
  if (!intervals.includes(0) || new Set(intervals).size !== intervals.length)
    fail("Chord intervals need a root and no duplicates.");
  const fingerings = Object.entries(record(value.fingerings, "Fingerings"));
  if (fingerings.length > 32)
    fail("Too many saved tunings for one chord (maximum 32).");
  if (typeof value.label !== "string" || value.label.length > 120)
    fail("Chord label must be at most 120 characters.");
  const chord = {
    id: identifier(value.id),
    root: integer(value.root, 0, 11, "Chord root"),
    intervals: intervals.sort((a, b) => a - b),
    bass: integer(value.bass, -1, 11, "Bass"),
    label: value.label,
    fingerings: Object.fromEntries(fingerings.map(parseFingering)),
  };
  if (chord.bass >= 0 && !toneSet(chord).includes(chord.bass))
    fail("Chord bass must be one of its tones.");
  return chord;
}

function parsePart(value, guitarIds) {
  record(value, "Part");
  if (!guitarIds.has(value.guitarId)) fail("Part refers to a missing guitar.");
  if (!Object.hasOwn(SCALES, value.scale)) fail("Unknown scale.");
  const chords = list(value.chords, 0, 64, "Part chords").map(parseChord);
  uniqueIds(chords, "Chord");
  return {
    id: identifier(value.id),
    name: text(value.name, "Part name"),
    guitarId: value.guitarId,
    root: integer(value.root, 0, 11, "Scale root"),
    scale: value.scale,
    chords,
  };
}

function uniqueIds(values, name) {
  if (new Set(values.map((v) => v.id)).size !== values.length)
    fail(`${name} IDs must be unique.`);
}

// Reconstruct only schema fields. Never trust imported or localStorage objects.
export function parseProject(input) {
  if (
    typeof input === "string" &&
    new TextEncoder().encode(input).length > MAX_FILE_BYTES
  )
    fail("Project files must be smaller than 2 MB.");
  const value = typeof input === "string" ? JSON.parse(input) : input;
  record(value, "Project");
  if (value.format !== "crest-chord-builder" || value.version !== 1)
    fail("Expected a Crest Chord Builder version 1 JSON project.");
  const guitars = list(value.guitars, 1, 16, "Guitars").map(parseGuitar);
  uniqueIds(guitars, "Guitar");
  const guitarIds = new Set(guitars.map((g) => g.id));
  const parts = list(value.parts, 1, 100, "Parts").map((p) =>
    parsePart(p, guitarIds),
  );
  uniqueIds(parts, "Part");
  const project = {
    format: value.format,
    version: 1,
    title: text(value.title, "Project title"),
    guitars,
    parts,
  };
  if (
    new TextEncoder().encode(JSON.stringify(project, null, 2) + "\n").length >
    MAX_FILE_BYTES
  )
    fail(
      "This project has reached the 2 MB limit. Save it and continue in another project.",
    );
  return project;
}

// Fingerings are snapshots indexed by their exact physical tuning. Retuning
// selects another snapshot; returning to an earlier tuning restores its grip.
export function getFingering(chord, tuning) {
  const frets = chord.fingerings[tuningKey(tuning)];
  return frets ? [...frets] : null;
}

export function setFingering(chord, tuning, frets) {
  chord.fingerings[tuningKey(tuning)] = [...frets];
}

export function fingeringTones(tuning, frets) {
  return [
    ...new Set(
      tuning.flatMap((n, i) => (frets[i] >= 0 ? [mod12(n + frets[i])] : [])),
    ),
  ];
}
