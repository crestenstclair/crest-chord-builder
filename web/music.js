import {
  chordFormula,
  FORMULA_TONES,
  withSoundingIntervals,
} from "./chord-formula.js";
export const NOTES = [
  "C",
  "D♭",
  "D",
  "E♭",
  "E",
  "F",
  "F♯",
  "G",
  "A♭",
  "A",
  "B♭",
  "B",
];
export const INTERVALS = [
  "1",
  "♭2",
  "2",
  "♭3",
  "3",
  "4",
  "♭5",
  "5",
  "♭6",
  "6",
  "♭7",
  "7",
];
export const SCALES = {
  minor: { name: "Natural minor", intervals: [0, 2, 3, 5, 7, 8, 10] },
  major: { name: "Major", intervals: [0, 2, 4, 5, 7, 9, 11] },
  dorian: { name: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
  phrygian: { name: "Phrygian", intervals: [0, 1, 3, 5, 7, 8, 10] },
  lydian: { name: "Lydian", intervals: [0, 2, 4, 6, 7, 9, 11] },
  mixolydian: { name: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10] },
  locrian: { name: "Locrian", intervals: [0, 1, 3, 5, 6, 8, 10] },
  harmonic: { name: "Harmonic minor", intervals: [0, 2, 3, 5, 7, 8, 11] },
  melodic: { name: "Melodic minor", intervals: [0, 2, 3, 5, 7, 9, 11] },
  majorPentatonic: { name: "Major pentatonic", intervals: [0, 2, 4, 7, 9] },
  minorPentatonic: { name: "Minor pentatonic", intervals: [0, 3, 5, 7, 10] },
  minorBlues: { name: "Minor blues", intervals: [0, 3, 5, 6, 7, 10] },
  majorBlues: { name: "Major blues", intervals: [0, 2, 3, 4, 7, 9] },
  harmonicMajor: { name: "Harmonic major", intervals: [0, 2, 4, 5, 7, 8, 11] },
  phrygianDominant: {
    name: "Phrygian dominant",
    intervals: [0, 1, 4, 5, 7, 8, 10],
  },
  lydianDominant: {
    name: "Lydian dominant",
    intervals: [0, 2, 4, 6, 7, 9, 10],
  },
  altered: { name: "Altered dominant", intervals: [0, 1, 3, 4, 6, 8, 10] },
  doubleHarmonic: {
    name: "Double harmonic major",
    intervals: [0, 1, 4, 5, 7, 8, 11],
  },
  hungarianMinor: {
    name: "Hungarian minor",
    intervals: [0, 2, 3, 6, 7, 8, 11],
  },
  wholeTone: { name: "Whole tone", intervals: [0, 2, 4, 6, 8, 10] },
  diminishedWH: {
    name: "Diminished (whole–half)",
    intervals: [0, 2, 3, 5, 6, 8, 9, 11],
  },
  diminishedHW: {
    name: "Diminished (half–whole)",
    intervals: [0, 1, 3, 4, 6, 7, 9, 10],
  },
  chromatic: {
    name: "Chromatic",
    intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
};
export const QUALITIES = {
  maj: { name: "Major", suffix: "", intervals: [0, 4, 7] },
  min: { name: "Minor", suffix: "m", intervals: [0, 3, 7] },
  min7: { name: "Minor 7th", suffix: "m7", intervals: [0, 3, 7, 10] },
  maj7: { name: "Major 7th", suffix: "maj7", intervals: [0, 4, 7, 11] },
  dom7: { name: "Dominant 7th", suffix: "7", intervals: [0, 4, 7, 10] },
  dim: { name: "Diminished", suffix: "dim", intervals: [0, 3, 6] },
  halfdim: {
    name: "Half-diminished 7th",
    suffix: "m7♭5",
    intervals: [0, 3, 6, 10],
  },
  dim7: { name: "Diminished 7th", suffix: "dim7", intervals: [0, 3, 6, 9] },
  aug: { name: "Augmented", suffix: "aug", intervals: [0, 4, 8] },
  sus2: { name: "Suspended 2", suffix: "sus2", intervals: [0, 2, 7] },
  sus4: { name: "Suspended 4", suffix: "sus4", intervals: [0, 5, 7] },
  six: { name: "Major 6", suffix: "6", intervals: [0, 4, 7, 9] },
  min6: { name: "Minor 6", suffix: "m6", intervals: [0, 3, 7, 9] },
  add9: { name: "Add 9", suffix: "add9", intervals: [0, 2, 4, 7] },
  min9: { name: "Minor 9th", suffix: "m9", intervals: [0, 2, 3, 7, 10] },
  maj9: { name: "Major 9th", suffix: "maj9", intervals: [0, 2, 4, 7, 11] },
  dom9: { name: "Dominant 9th", suffix: "9", intervals: [0, 2, 4, 7, 10] },
  min11: { name: "Minor 11th", suffix: "m11", intervals: [0, 2, 3, 5, 7, 10] },
  maj11: {
    name: "Major 11th",
    suffix: "maj11",
    intervals: [0, 2, 4, 5, 7, 11],
  },
  dom11: {
    name: "Dominant 11th",
    suffix: "11",
    intervals: [0, 2, 4, 5, 7, 10],
  },
  min13: { name: "Minor 13th", suffix: "m13", intervals: [0, 2, 3, 7, 9, 10] },
  maj13: {
    name: "Major 13th",
    suffix: "maj13",
    intervals: [0, 2, 4, 7, 9, 11],
  },
  dom13: {
    name: "Dominant 13th",
    suffix: "13",
    intervals: [0, 2, 4, 7, 9, 10],
  },
  minmaj7: {
    name: "Minor major 7",
    suffix: "m(maj7)",
    intervals: [0, 3, 7, 11],
  },
  augmaj7: {
    name: "Augmented major 7",
    suffix: "maj7♯5",
    intervals: [0, 4, 8, 11],
  },
  minflat9: {
    name: "Minor 7, flat 9",
    suffix: "m7(♭9)",
    intervals: [0, 1, 3, 7, 10],
  },
  halfdimflat9: {
    name: "Half-diminished, flat 9",
    suffix: "m7♭5(♭9)",
    intervals: [0, 1, 3, 6, 10],
  },
  halfdim9: {
    name: "Half-diminished 9",
    suffix: "m9♭5",
    intervals: [0, 2, 3, 6, 10],
  },
  minmaj9: {
    name: "Minor major 9",
    suffix: "m(maj9)",
    intervals: [0, 2, 3, 7, 11],
  },
  augmaj9: {
    name: "Augmented major 9",
    suffix: "maj9♯5",
    intervals: [0, 2, 4, 8, 11],
  },
  domflat9: {
    name: "Dominant flat 9",
    suffix: "7(♭9)",
    intervals: [0, 1, 4, 7, 10],
  },
  power: { name: "Power chord", suffix: "5", intervals: [0, 7] },
};
export { PRESETS } from "./tunings.js";
export const mod12 = (n) => ((n % 12) + 12) % 12;
export const pitchName = (midi) =>
  `${NOTES[mod12(midi)]}${Math.floor(midi / 12) - 1}`;
export const toneSet = (chord) =>
  chord.intervals.map((n) => mod12(chord.root + n));
export const soundingNotes = (tuning, frets) =>
  tuning.flatMap((n, i) => (frets[i] >= 0 ? [n + frets[i]] : []));
export const unique = (values) => [...new Set(values)].sort((a, b) => a - b);
const same = (a, b) => a.join(",") === b.join(",");

export function tuningInterval(from, to) {
  const distance = Math.abs(to - from);
  const names = [
    "P1",
    "m2",
    "M2",
    "m3",
    "M3",
    "P4",
    "tritone",
    "P5",
    "m6",
    "M6",
    "m7",
    "M7",
  ];
  const octaves = Math.floor(distance / 12);
  const remainder = distance % 12;
  let label =
    octaves && !remainder
      ? `${octaves === 1 ? "P8" : `${octaves} octaves`}`
      : names[remainder];
  if (octaves && remainder) label = `${octaves} oct + ${label}`;
  return `${to < from ? "↓ " : ""}${label} · ${distance} st`;
}

export function partScale(part) {
  return part.scale === "custom"
    ? { ...part.customScale, custom: true }
    : SCALES[part.scale];
}

export function scaleNotes(root, scale) {
  const definition = typeof scale === "string" ? SCALES[scale] : scale;
  const intervals = definition.intervals;
  // Non-diatonic scales use pitch-class spellings; do not invent a seven-letter
  // spelling for pentatonic, chromatic, or user-defined collections.
  const diatonic =
    intervals.length === 7 &&
    !definition.custom &&
    definition !== SCALES.altered;
  return intervals.map((interval, index) => ({
    pc: mod12(root + interval),
    name: diatonic
      ? diatonicName(root, interval, index)
      : NOTES[mod12(root + interval)],
    interval: diatonic
      ? diatonicInterval(interval, index)
      : INTERVALS[interval],
  }));
}

function diatonicInterval(interval, degree) {
  const difference = interval - [0, 2, 4, 5, 7, 9, 11][degree];
  const accidental =
    difference < 0 ? "♭".repeat(-difference) : "♯".repeat(difference);
  return accidental + (degree + 1);
}

function diatonicName(root, interval, degree) {
  const letters = ["C", "D", "E", "F", "G", "A", "B"];
  const natural = [0, 2, 4, 5, 7, 9, 11];
  const index = (letters.indexOf(NOTES[root][0]) + degree) % 7;
  let delta = mod12(root + interval - natural[index]);
  if (delta > 6) delta -= 12;
  return letters[index] + (delta < 0 ? "♭".repeat(-delta) : "♯".repeat(delta));
}

function omittedQuality(intervals) {
  return Object.values(QUALITIES).find((q) => {
    const fifth = q.intervals.includes(6) ? 6 : q.intervals.includes(8) ? 8 : 7;
    return same(
      q.intervals.filter(
        (n) =>
          (n !== 0 || intervals.includes(0)) &&
          (n !== fifth || intervals.includes(fifth)),
      ),
      intervals,
    );
  });
}

function matchesFormula(chord, quality) {
  if (!chord.formula) return true;
  const expected = chordFormula(quality).filter((label) =>
    chord.intervals.includes(FORMULA_TONES[label].pitch),
  );
  return [...expected].sort().join() === [...chord.formula].sort().join();
}

function customFormulaQuality(chord) {
  const formula = chordFormula(chord);
  const has = (label) => formula.includes(label);
  const third = ["3", "♭3", "2", "4"].find(has);
  const fifth = ["5", "♭5", "♯5"].find(has);
  const seventh = ["7", "♭7", "♭♭7"].find(has);
  const columns = formula.map((label) => FORMULA_TONES[label].column);
  if (!third || new Set(columns).size !== columns.length)
    return {
      name: "Custom chord",
      suffix: ` [${formula.join("·")}]`,
      omissions: [],
    };
  const minor = third === "♭3";
  let suffix = minor
    ? "m"
    : third === "2"
      ? "sus2"
      : third === "4"
        ? "sus4"
        : "";
  let name = minor
    ? "Minor"
    : third === "2"
      ? "Suspended 2nd"
      : third === "4"
        ? "Suspended 4th"
        : "Major";
  const extension = has("9") ? ["13", "11", "9"].find(has) : null;
  const modifications = [];
  if (seventh) {
    const number = extension ?? "7";
    if (seventh === "♭♭7") {
      suffix = minor && fifth === "♭5" ? "dim7" : suffix + "6";
      name = minor && fifth === "♭5" ? "Diminished 7th" : name;
      for (const label of ["9", "11", "13"])
        if (has(label)) modifications.push("add" + label);
    } else if (seventh === "7")
      suffix = minor
        ? `m(maj${number})`
        : third === "2" || third === "4"
          ? `maj${number}${suffix}`
          : `maj${number}`;
    else
      suffix =
        third === "2" || third === "4" ? number + suffix : suffix + number;
    if (seventh === "♭7" && third === "3") name = "Dominant";
    if (seventh !== "♭♭7") name += ` ${number}th`;
    if (seventh !== "♭♭7" && !extension)
      for (const label of ["11", "13"])
        if (has(label)) modifications.push("add" + label);
  } else {
    for (const label of ["9", "11", "13"])
      if (has(label)) modifications.push("add" + label);
  }
  if (fifth && fifth !== "5" && !(seventh === "♭♭7" && fifth === "♭5" && minor))
    modifications.push(fifth);
  for (const label of ["♭9", "♯9", "♯11", "♭13"])
    if (has(label)) modifications.push(label);
  const omissions = [];
  if (!has("1")) omissions.push("1");
  if (!fifth) omissions.push("5");
  for (const n of omissions) modifications.push("no" + n);
  if (modifications.length) suffix += `(${modifications.join(",")})`;
  return { name, suffix, omissions };
}

export function chordQuality(chord) {
  const exact = Object.values(QUALITIES).find(
    (q) => same(q.intervals, chord.intervals) && matchesFormula(chord, q),
  );
  if (exact) return { ...exact, omissions: [] };
  const omitted = omittedQuality(chord.intervals);
  if (!omitted || !matchesFormula(chord, omitted))
    return customFormulaQuality(chord);
  const fifth = omitted.intervals.includes(6)
    ? 6
    : omitted.intervals.includes(8)
      ? 8
      : 7;
  const omissions = [];
  if (!chord.intervals.includes(0)) omissions.push("1");
  if (omitted.intervals.includes(fifth) && !chord.intervals.includes(fifth))
    omissions.push("5");
  return {
    ...omitted,
    suffix: omitted.suffix + `(no${omissions.join(",")})`,
    omissions,
  };
}

export function chordName(chord, bass = chord.bass ?? -1, spelling = NOTES) {
  return (
    spelling[chord.root] +
    chordQuality(chord).suffix +
    (bass >= 0 && bass !== chord.root ? `/${spelling[bass]}` : "")
  );
}

export function chordInterval(chord, pc) {
  const interval = mod12(pc - chord.root);
  const spelled = chord.formula?.find(
    (label) => FORMULA_TONES[label].pitch === interval,
  );
  if (spelled) return spelled;
  if (interval === 3 && chord.intervals.includes(4)) return "♯9";
  const seventh = chord.intervals.includes(10) || chord.intervals.includes(11);
  if (interval === 8 && chord.intervals.includes(4)) return "♯5";
  if (interval === 2 && seventh) return "9";
  if (
    interval === 5 &&
    seventh &&
    (chord.intervals.includes(3) || chord.intervals.includes(4))
  )
    return "11";
  if (interval === 9 && seventh) return "13";
  if (
    interval === 9 &&
    chord.intervals.includes(3) &&
    chord.intervals.includes(6)
  )
    return "♭♭7";
  return INTERVALS[interval];
}

function chordAtDegree(notes, degree, count, inverted, spellings) {
  const root = notes[degree].pc;
  const tones = Array.from(
    { length: count },
    (_, i) => notes[(degree + i * 2) % notes.length].pc,
  );
  const intervals = unique(tones.map((pc) => mod12(pc - root)));
  const chord = { root, intervals, bass: inverted ? tones[1] : -1 };
  let roman =
    ["I", "II", "III", "IV", "V", "VI", "VII"][degree] ?? String(degree + 1);
  if (intervals.includes(3)) roman = roman.toLowerCase();
  if (intervals.includes(6)) roman += count === 3 ? "°" : "ø";
  if (count > 3) roman += count === 4 ? "7" : "9";
  return { ...chord, name: chordName(chord, chord.bass, spellings), roman };
}

function triadInCollection(root, allowed) {
  const quality = ["maj", "min", "dim", "aug", "sus2", "sus4"]
    .map((key) => QUALITIES[key])
    .find((q) => q.intervals.every((n) => allowed.includes(mod12(root + n))));
  return quality
    ? {
        root,
        intervals: [...quality.intervals],
        bass: -1,
        name: chordName({ root, intervals: quality.intervals }),
        roman: "",
      }
    : null;
}

export function scaleChords(root, scale, count, inverted = false) {
  const notes = scaleNotes(root, scale);
  const spellings = [...NOTES];
  notes.forEach((n) => {
    spellings[n.pc] = n.name;
  });
  if ((notes.length !== 7 || scale.custom) && count === 3) {
    const allowed = notes.map((n) => n.pc);
    return notes.map((n) => triadInCollection(n.pc, allowed)).filter(Boolean);
  }
  return notes.map((_, degree) =>
    chordAtDegree(notes, degree, count, inverted, spellings),
  );
}

// Keep the user-selected harmonic root, including when its note is omitted.
// The actual pitches still determine quality, omissions, and slash bass.
export function describeFingering(tuning, frets, preferredRoot) {
  const midis = soundingNotes(tuning, frets);
  if (!midis.length)
    return {
      name: "Muted",
      root: preferredRoot,
      intervals: [],
      bass: -1,
      midis,
    };
  const intervals = unique(midis.map((n) => mod12(n - preferredRoot)));
  const bass = mod12(Math.min(...midis));
  const chord = { root: preferredRoot, intervals, bass };
  return { ...chord, midis, name: chordName(chord) };
}

// A tuning snapshot can predate an edit in another tuning. Describe that
// snapshot honestly, while retaining the generator's optional perfect fifth.
export function voicedChord(chord, actual) {
  if (!actual?.midis.length) return chord;
  const missing = chord.intervals.filter((n) => !actual.intervals.includes(n));
  const fits = actual.intervals.every((n) => chord.intervals.includes(n));
  const optionalFifth =
    chord.intervals.length >= 5 && missing.length === 1 && missing[0] === 7;
  if (fits && (missing.length === 0 || optionalFifth)) return chord;
  return {
    ...withSoundingIntervals(chord, actual.intervals),
    bass: actual.bass,
  };
}

export const FAMILIES = {
  maj: { name: "Major", intervals: [0, 4, 7], third: 4, fifth: 7, seventh: 11 },
  min: { name: "Minor", intervals: [0, 3, 7], third: 3, fifth: 7, seventh: 10 },
  dominant: {
    name: "Dominant",
    intervals: [0, 4, 7, 10],
    third: 4,
    fifth: 7,
    seventh: 10,
  },
  dim: {
    name: "Diminished",
    intervals: [0, 3, 6],
    third: 3,
    fifth: 6,
    seventh: 9,
  },
  aug: {
    name: "Augmented",
    intervals: [0, 4, 8],
    third: 4,
    fifth: 8,
    seventh: 11,
  },
  sus2: {
    name: "Suspended 2nd",
    intervals: [0, 2, 7],
    third: 2,
    fifth: 7,
    seventh: 10,
  },
  sus4: {
    name: "Suspended 4th",
    intervals: [0, 5, 7],
    third: 5,
    fifth: 7,
    seventh: 10,
  },
};

export function chordFamily(chord) {
  const has = (n) => chord.intervals.includes(n);
  const formula = chordFormula(chord);
  if (formula.includes("3"))
    return formula.includes("♯5") ? "aug" : has(10) ? "dominant" : "maj";
  if (formula.includes("♭3")) return formula.includes("♭5") ? "dim" : "min";
  if (has(5)) return "sus4";
  if (has(2)) return "sus2";
  return "maj";
}

// A triad's first seventh follows the part scale when one is available.
// Existing extensions and explicit menu choices always take precedence.
export function seventhForChord(chord, keyTones = []) {
  const family = chordFamily(chord);
  const candidates = [
    ...new Set([
      FAMILIES[family].seventh,
      10,
      11,
      ...(family === "dim" ? [9] : []),
    ]),
  ];
  return (
    candidates.find((n) => chord.intervals.includes(n)) ??
    candidates.find((n) => keyTones.includes(mod12(chord.root + n))) ??
    FAMILIES[family].seventh
  );
}

export function intervalControls(family, seventh = FAMILIES[family].seventh) {
  const f = { ...FAMILIES[family], seventh };
  const entries = [
    [0, "1"],
    [f.third, INTERVALS[f.third]],
    [f.fifth, f.fifth === 8 ? "♯5" : INTERVALS[f.fifth]],
    [f.seventh, f.seventh === 9 ? "♭♭7" : INTERVALS[f.seventh]],
    [2, "9"],
    [5, "11"],
    [9, "13"],
  ];
  return entries.filter(
    ([value], i) => entries.findIndex(([n]) => n === value) === i,
  );
}

export function toggleChordInterval(chord, interval) {
  const intervals = chord.intervals.includes(interval)
    ? chord.intervals.filter((n) => n !== interval)
    : unique([...chord.intervals, interval]);
  if (!intervals.length)
    throw new Error("Keep at least one chord interval selected.");
  return withIntervals(chord, intervals);
}

function withIntervals(chord, intervals) {
  const bassInterval = mod12(chord.bass - chord.root);
  const bass =
    chord.bass < 0 || intervals.includes(bassInterval)
      ? chord.bass
      : intervals.includes(0)
        ? chord.root
        : -1;
  return chord.formula
    ? { ...withSoundingIntervals(chord, intervals), bass }
    : { ...chord, intervals, bass };
}

export function extendChord(
  chord,
  extension,
  { family = chordFamily(chord), seventh = FAMILIES[family].seventh } = {},
) {
  if (extension === "dominant7")
    return withIntervals(
      chord,
      unique([
        ...chord.intervals.filter(
          (n) => n !== 11 && (family !== "dim" || n !== 9),
        ),
        10,
      ]),
    );
  if (extension === "major7")
    return withIntervals(
      chord,
      unique([
        ...chord.intervals.filter(
          (n) => n !== 10 && (family !== "dim" || n !== 9),
        ),
        11,
      ]),
    );
  const additions =
    extension === "9"
      ? [seventh, 2]
      : extension === "13"
        ? [seventh, 2, 9]
        : [seventh];
  return withIntervals(chord, unique([...chord.intervals, ...additions]));
}

export function previewPitches(chord) {
  const pitches = chordFormula(chord).map(
    (label) =>
      48 +
      chord.root +
      FORMULA_TONES[label].pitch +
      (FORMULA_TONES[label].column >= 4 ? 12 : 0),
  );
  if (chord.bass >= 0) pitches.push(36 + chord.bass);
  return unique(pitches);
}

export function fretMatches(tuning, selectedMidi, from = 0, to = 24) {
  return tuning.flatMap((open, string) =>
    Array.from({ length: to - from + 1 }, (_, i) => ({
      string,
      fret: from + i,
      midi: open + from + i,
    })).filter((n) => mod12(n.midi) === mod12(selectedMidi)),
  );
}

// Relocate one voice. Occupied destinations require an explicit replacement.
export function moveVoice(frets, fromString, toString, toFret) {
  if (fromString !== toString && frets[toString] >= 0)
    throw new Error(
      "That string already has a note. Mute it first, or choose another string.",
    );
  const next = [...frets];
  next[fromString] = -1;
  next[toString] = toFret;
  return next;
}
