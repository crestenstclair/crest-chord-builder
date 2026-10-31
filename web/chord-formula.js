// Degree spelling belongs to the chord, not its fingering. Enharmonic choices
// such as ♭5 and ♯11 share a pitch but occupy different places in the editor.
export const DEGREE_COLUMNS = [
  { name: "Root", choices: [null, "1", null, null] },
  { name: "3rd / sus", choices: ["4", "3", "♭3", "2"] },
  { name: "5th", choices: ["♯5", "5", "♭5", null] },
  { name: "7th", choices: [null, "7", "♭7", "♭♭7"] },
  { name: "9th", choices: ["♯9", "9", "♭9", null] },
  { name: "11th", choices: ["♯11", "11", null, null] },
  { name: "13th / 6th", choices: [null, "13", "♭13", null] },
];
const pitches = {
  1: 0,
  2: 2,
  "♭3": 3,
  3: 4,
  4: 5,
  "♭5": 6,
  5: 7,
  "♯5": 8,
  "♭♭7": 9,
  "♭7": 10,
  7: 11,
  "♭9": 1,
  9: 2,
  "♯9": 3,
  11: 5,
  "♯11": 6,
  "♭13": 8,
  13: 9,
};
export const FORMULA_TONES = Object.fromEntries(
  DEGREE_COLUMNS.flatMap((column, index) =>
    column.choices
      .filter(Boolean)
      .map((label) => [label, { pitch: pitches[label], column: index }]),
  ),
);
const sorted = (values) => [...new Set(values)].sort((a, b) => a - b);
export const formulaIntervals = (formula) =>
  sorted(formula.map((label) => FORMULA_TONES[label].pitch));
const sortFormula = (formula) =>
  [...formula].sort(
    (a, b) =>
      FORMULA_TONES[a].column - FORMULA_TONES[b].column ||
      FORMULA_TONES[a].pitch - FORMULA_TONES[b].pitch,
  );

export function chordFormula(chord) {
  if (chord.formula) return [...chord.formula];
  const has = (n) => chord.intervals.includes(n);
  const third = has(3) || has(4);
  const names = [
    "1",
    "♭9",
    third || has(10) || has(11) ? "9" : "2",
    has(4) ? "♯9" : "♭3",
    "3",
    third ? "11" : "4",
    has(7) ? "♯11" : "♭5",
    "5",
    has(4) && !has(7) ? "♯5" : "♭13",
    has(3) && has(6) && !has(10) && !has(11) ? "♭♭7" : "13",
    "♭7",
    "7",
  ];
  return sortFormula(chord.intervals.map((n) => names[n]));
}

export function parseFormula(value, intervals) {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > 12 ||
    value.some(
      (label) =>
        typeof label !== "string" || !Object.hasOwn(FORMULA_TONES, label),
    )
  )
    throw new Error("Chord formula must contain valid interval labels.");
  const pitches = formulaIntervals(value);
  if (pitches.length !== value.length || pitches.join() !== intervals.join())
    throw new Error(
      "Chord formula must match its pitches without duplicate tones.",
    );
  return sortFormula(value);
}

// A click changes exactly one degree. Selecting another variant replaces that
// degree; clicking the selected variant removes it. No extensions are implied.
export function selectChordTone(chord, label) {
  const tone = FORMULA_TONES[label];
  if (!tone) throw new Error("Unknown chord interval.");
  const current = chordFormula(chord);
  const formula = current.includes(label)
    ? current.filter((n) => n !== label)
    : [
        ...current.filter(
          (n) =>
            FORMULA_TONES[n].column !== tone.column &&
            FORMULA_TONES[n].pitch !== tone.pitch,
        ),
        label,
      ];
  if (!formula.length)
    throw new Error("Keep at least one chord interval selected.");
  return withFormula(chord, sortFormula(formula));
}

function withFormula(chord, formula) {
  const intervals = formulaIntervals(formula);
  const bassInterval = (((chord.bass - chord.root) % 12) + 12) % 12;
  const bass =
    chord.bass < 0 || intervals.includes(bassInterval)
      ? chord.bass
      : intervals.includes(0)
        ? chord.root
        : -1;
  return { ...chord, intervals, formula, bass };
}

// Preserve a user's spelling while manual placement adds/removes actual tones.
export function withSoundingIntervals(chord, intervals) {
  const inferred = chordFormula({ intervals });
  const old = chordFormula(chord);
  const formula = intervals.map(
    (n) =>
      old.find((label) => FORMULA_TONES[label].pitch === n) ??
      inferred.find((label) => FORMULA_TONES[label].pitch === n),
  );
  return withFormula(chord, sortFormula(formula));
}
