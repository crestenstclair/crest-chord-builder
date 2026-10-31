import { NOTES, mod12, pitchName, chordInterval } from "./music.js";
import { esc } from "./ui.js";

export function chordBox(
  tuning,
  frets,
  root,
  name,
  large = false,
  labels = "intervals",
  chord = { root, intervals: [] },
) {
  if (!frets)
    return '<div class="diagram-placeholder"><span class="loading-dot"></span> Finding a fingering…</div>';
  const active = frets.filter((f) => f > 0);
  const base =
    active.length && Math.max(...active) > 5 ? Math.min(...active) : 1;
  const rows = Math.max(
    5,
    (active.length ? Math.max(...active) : 0) - base + 1,
  );
  const gap = 26;
  const width = Math.max(160, (tuning.length - 1) * gap + 60);
  const left = (width - (tuning.length - 1) * gap) / 2;
  const height = rows * 27 + 88;
  const line = (x1, y1, x2, y2, cls = "") =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}"/>`;
  const strings = tuning
    .map((_, i) => line(left + i * gap, 40, left + i * gap, 40 + rows * 27))
    .join("");
  const fretsGrid = Array.from({ length: rows + 1 }, (_, i) =>
    line(
      left,
      40 + i * 27,
      width - left,
      40 + i * 27,
      i === 0 && base === 1 ? "nut" : "",
    ),
  ).join("");
  const dots = frets
    .map((f, i) => {
      const x = left + i * gap;
      const rootClass =
        f >= 0 && mod12(tuning[i] + f) === root ? "root-dot" : "";
      const note =
        f < 0
          ? ""
          : labels === "intervals"
            ? chordInterval(chord, mod12(tuning[i] + f))
            : NOTES[mod12(tuning[i] + f)];
      const mark =
        f <= 0
          ? `<text x="${x}" y="29" class="open-label ${rootClass}">${f < 0 ? "×" : "○"}</text>`
          : `<circle cx="${x}" cy="${40 + (f - base + 0.5) * 27}" r="9" class="chord-dot ${rootClass}"/>`;
      return `${mark}<text x="${x}" y="${height - 20}" class="string-note">${esc(note)}</text>`;
    })
    .join("");
  return `<svg class="chord-box ${large ? "large" : ""}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(name)}, frets ${frets.map((f) => (f < 0 ? "muted" : f)).join(", ")}. Bass-side string on left."><g class="diagram-lines">${strings}${fretsGrid}</g>${base > 1 ? `<text x="10" y="59" class="fret-base">${base}</text>` : ""}${dots}</svg>`;
}

function fretCell({
  open,
  string,
  fret,
  tones,
  root,
  labels,
  spelling,
  frets,
  active,
  editing,
  keyTones,
  chord,
  count,
  intervalLabels,
}) {
  const midi = open + fret;
  const pc = mod12(midi);
  const relevant = tones.includes(pc);
  const selected = frets?.[string] === fret;
  const match = active && mod12(active.midi) === pc;
  const exact = match && midi === active.midi;
  const label =
    labels === "intervals"
      ? (intervalLabels?.[pc] ?? chordInterval(chord, pc))
      : spelling[pc];
  const cls = [
    "fret",
    keyTones ? (keyTones.includes(pc) ? "in-key" : "outside-key") : "",
    fret === 0 ? "open-fret" : "",
    relevant ? "in-scale" : "",
    pc === root ? "is-root" : "",
    selected ? "chosen" : "",
    match ? "matching" : "",
    exact ? "exact" : "",
  ].join(" ");
  const title = `String ${count - string}, fret ${fret}: ${pitchName(midi)}, ${intervalLabels?.[pc] ?? chordInterval(chord, pc)}${keyTones ? (keyTones.includes(pc) ? ", in scale" : ", outside scale") : ""}${selected ? ", selected" : ""}${exact ? ", same pitch" : match ? ", same note in another octave" : ""}`;
  const content = `<span>${relevant || editing || selected ? esc(label) : ""}</span>`;
  return editing
    ? `<button type="button" class="${cls}" data-fret="${fret}" data-string="${string}" aria-label="${esc(title)}" aria-pressed="${selected}" title="${esc(title)}">${content}</button>`
    : `<div class="${cls}" title="${esc(title)}">${content}</div>`;
}

function fretRow(open, string, config) {
  const cells = Array.from({ length: 13 }, (_, i) =>
    fretCell({ ...config, open, string, fret: config.start + i }),
  ).join("");
  return `<div class="fret-row"><span class="tuning-label" title="String ${config.count - string}">${esc(pitchName(open))}</span>${cells}</div>`;
}

export function fretboard(
  tuning,
  tones,
  root,
  {
    start = 0,
    labels = "intervals",
    spelling = NOTES,
    frets = null,
    active = null,
    editing = false,
    keyTones = null,
    intervalLabels = null,
    chord = { root, intervals: [] },
  } = {},
) {
  const config = {
    start,
    keyTones,
    intervalLabels,
    chord,
    count: tuning.length,
    tones,
    root,
    labels,
    spelling,
    frets,
    active,
    editing,
  };
  const rows = tuning
    .map((open, string) => fretRow(open, string, config))
    .reverse()
    .join("");
  const numbers = Array.from(
    { length: 13 },
    (_, i) =>
      `<span class="fret-number ${[3, 5, 7, 9, 12, 15, 17, 19, 21, 24].includes(start + i) ? "marker" : ""}">${start + i === 0 ? "open" : start + i}</span>`,
  ).join("");
  return `<div class="neck-scroll"><div class="fretboard" aria-label="Guitar fretboard; treble-side string at top">${rows}<div class="fret-row fret-numbers"><span></span>${numbers}</div></div></div>`;
}
