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
};
export const QUALITIES = {
  maj: { name: "Major", suffix: "", intervals: [0, 4, 7] },
  min: { name: "Minor", suffix: "m", intervals: [0, 3, 7] },
  min7: { name: "Minor 7", suffix: "m7", intervals: [0, 3, 7, 10] },
  maj7: { name: "Major 7", suffix: "maj7", intervals: [0, 4, 7, 11] },
  dom7: { name: "Dominant 7", suffix: "7", intervals: [0, 4, 7, 10] },
  dim: { name: "Diminished", suffix: "dim", intervals: [0, 3, 6] },
  halfdim: {
    name: "Half-diminished 7",
    suffix: "m7♭5",
    intervals: [0, 3, 6, 10],
  },
  dim7: { name: "Diminished 7", suffix: "dim7", intervals: [0, 3, 6, 9] },
  aug: { name: "Augmented", suffix: "aug", intervals: [0, 4, 8] },
  sus2: { name: "Suspended 2", suffix: "sus2", intervals: [0, 2, 7] },
  sus4: { name: "Suspended 4", suffix: "sus4", intervals: [0, 5, 7] },
  six: { name: "Major 6", suffix: "6", intervals: [0, 4, 7, 9] },
  min6: { name: "Minor 6", suffix: "m6", intervals: [0, 3, 7, 9] },
  add9: { name: "Add 9", suffix: "add9", intervals: [0, 2, 4, 7] },
  min9: { name: "Minor 9", suffix: "m9", intervals: [0, 2, 3, 7, 10] },
  maj9: { name: "Major 9", suffix: "maj9", intervals: [0, 2, 4, 7, 11] },
  dom9: { name: "Dominant 9", suffix: "9", intervals: [0, 2, 4, 7, 10] },
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
export const PRESETS = {
  standard: { name: "Standard six", strings: [40, 45, 50, 55, 59, 64] },
  dropd: { name: "Drop D", strings: [38, 45, 50, 55, 59, 64] },
  dadgad: { name: "DADGAD", strings: [38, 45, 50, 55, 57, 62] },
  seven: {
    name: "Seven-string standard",
    strings: [35, 40, 45, 50, 55, 59, 64],
  },
  eight: {
    name: "Eight-string standard",
    strings: [30, 35, 40, 45, 50, 55, 59, 64],
  },
  bass: { name: "Four-string bass", strings: [28, 33, 38, 43] },
};
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

// Use consecutive letter names for diatonic scales, preserving C minor's E♭
// and D major's F♯ rather than choosing one enharmonic spelling globally.
export function scaleNotes(root, scale) {
  const letters = ["C", "D", "E", "F", "G", "A", "B"];
  const natural = [0, 2, 4, 5, 7, 9, 11];
  const first = letters.indexOf(NOTES[root][0]);
  return SCALES[scale].intervals.map((interval, i) => {
    const index = (first + i) % 7;
    let delta = mod12(root + interval - natural[index]);
    if (delta > 6) delta -= 12;
    return {
      pc: mod12(root + interval),
      name:
        letters[index] + (delta < 0 ? "♭".repeat(-delta) : "♯".repeat(delta)),
      interval: INTERVALS[interval],
    };
  });
}

function qualityFor(intervals) {
  return Object.values(QUALITIES).find((q) => same(q.intervals, intervals));
}

export function chordName(chord, bass = chord.bass ?? -1, spelling = NOTES) {
  const quality = qualityFor(chord.intervals);
  const omittedFifth =
    !quality &&
    Object.values(QUALITIES).find(
      (q) =>
        q.intervals.includes(7) &&
        same(
          q.intervals.filter((n) => n !== 7),
          chord.intervals,
        ),
    );
  const suffix =
    quality?.suffix ??
    (omittedFifth
      ? `${omittedFifth.suffix}(no5)`
      : ` [${chord.intervals.map((n) => INTERVALS[n]).join("·")}]`);
  return (
    spelling[chord.root] +
    suffix +
    (bass >= 0 && bass !== chord.root ? `/${spelling[bass]}` : "")
  );
}

export function scaleChords(root, scale, count, inverted = false) {
  const notes = scaleNotes(root, scale);
  const spellings = [...NOTES];
  notes.forEach((n) => {
    spellings[n.pc] = n.name;
  });
  return notes.map((note, degree) => {
    const tones = Array.from(
      { length: count },
      (_, i) => notes[(degree + i * 2) % 7].pc,
    );
    const intervals = unique(tones.map((pc) => mod12(pc - note.pc)));
    const chord = { root: note.pc, intervals, bass: inverted ? tones[1] : -1 };
    let roman = ["I", "II", "III", "IV", "V", "VI", "VII"][degree];
    if (intervals.includes(3)) roman = roman.toLowerCase();
    if (intervals.includes(6)) roman += count === 3 ? "°" : "ø";
    if (count > 3) roman += count === 4 ? "7" : "9";
    return { ...chord, name: chordName(chord, chord.bass, spellings), roman };
  });
}

// A voicing's bass is the lowest sounding MIDI pitch, even in re-entrant tuning.
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
  const pcs = unique(midis.map(mod12));
  const bass = mod12(Math.min(...midis));
  const candidates = unique([preferredRoot, ...pcs]);
  candidates.sort(
    (a, b) => Number(b === preferredRoot) - Number(a === preferredRoot),
  );
  const matches = candidates.map((root) => ({
    root,
    intervals: unique(pcs.map((pc) => mod12(pc - root))),
  }));
  const selected =
    matches.find((c) => qualityFor(c.intervals)) ??
    matches.find(
      (c) => c.root === preferredRoot && pcs.includes(preferredRoot),
    ) ??
    matches.find((c) => c.root === bass);
  return { ...selected, bass, midis, name: chordName(selected, bass) };
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
