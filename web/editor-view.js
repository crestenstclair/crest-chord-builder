import {
  NOTES,
  FAMILIES,
  pitchName,
  mod12,
  toneSet,
  chordName,
  chordQuality,
  chordInterval,
  chordFamily,
  describeFingering,
} from "./music.js";
import {
  DEGREE_COLUMNS,
  FORMULA_TONES,
  chordFormula,
} from "./chord-formula.js";
import { esc, options, button } from "./ui.js";
import { fretboard, chordBox } from "./diagrams.js";

function voiceRow(open, string, session) {
  const fret = session.frets?.[string] ?? -1;
  const midi = fret >= 0 ? open + fret : null;
  const number = session.tuning.length - string;
  return `<div class="voice-row"><span class="voice-string">${number}<small>${esc(pitchName(open))}</small></span><strong>${midi === null ? "×" : chordInterval(session.chord, mod12(midi))}<small>${midi === null ? "Muted" : `Fret ${fret} · ${esc(pitchName(midi))}`}</small></strong><div>${button("octave", "−8ve", "", "octave-button", `data-string="${string}" data-delta="-12" data-focus="down-${string}" ${session.busy || fret < 12 ? "disabled" : ""} aria-label="String ${number} down one octave"`)}${button("octave", "+8ve", "", "octave-button", `data-string="${string}" data-delta="12" data-focus="up-${string}" ${session.busy || fret < 0 || fret > 12 ? "disabled" : ""} aria-label="String ${number} up one octave"`)}${button("mute", "×", "", "icon-button", `data-string="${string}" data-focus="mute-${string}" aria-label="Mute string ${number}" ${session.busy || fret < 0 ? "disabled" : ""}`)}</div></div>`;
}

function intervalCell(label, session) {
  if (!label)
    return '<td class="interval-unavailable" aria-label="Not applicable">—</td>';
  const selected = chordFormula(session.chord).includes(label);
  const inKey = session.keyTones.includes(
    mod12(session.chord.root + FORMULA_TONES[label].pitch),
  );
  const keyStatus = inKey ? "In key" : "Out of key";
  return `<td>${button("interval", `<span>${esc(label)}</span><small id="tone-key-${label}">${keyStatus}</small>`, "", `interval-choice ${inKey ? "in-key" : "out-of-key"}`, `data-tone="${label}" data-focus="tone-${label}" aria-label="Chord interval ${label}" aria-describedby="tone-key-${label}" aria-pressed="${selected}" title="${label} · ${keyStatus.toLowerCase()} · ${selected ? "click to remove" : "click to select"}"`)}</td>`;
}

function intervalMatrix(session) {
  const rows = ["Raised", "Natural", "Lowered", "Alternate"];
  return `<section class="interval-section" aria-labelledby="interval-heading"><div class="interval-heading"><h3 id="interval-heading">Intervals</h3><p>Select a variant. Click it again to remove it.</p></div><div class="interval-scroll"><table class="interval-matrix"><thead><tr><th scope="col">Degree</th>${DEGREE_COLUMNS.map((c) => `<th scope="col">${c.name}</th>`).join("")}</tr></thead><tbody>${rows.map((name, index) => `<tr><th scope="row">${name}</th>${DEGREE_COLUMNS.map((c) => intervalCell(c.choices[index], session)).join("")}</tr>`).join("")}</tbody></table></div></section>`;
}

function chordControls(session, actual) {
  const { chord } = session;
  const family = chordFamily(chord);
  const roots = NOTES.map((name, n) =>
    button(
      "root",
      name,
      "",
      "choice-button",
      `data-value="${n}" data-focus="root-${n}" aria-label="Root ${name}" aria-pressed="${chord.root === n}"`,
    ),
  ).join("");
  const qualities = Object.entries(FAMILIES)
    .map(([key, f]) =>
      button(
        "family",
        f.name,
        "",
        "choice-button",
        `data-value="${key}" data-focus="family-${key}" aria-label="Quality ${f.name}" aria-pressed="${family === key}"`,
      ),
    )
    .join("");
  const basses = [
    button(
      "bass",
      "Any",
      "",
      "choice-button",
      `data-value="-1" data-focus="bass-any" aria-label="Any inversion" aria-pressed="${session.bassFilter === -1}"`,
    ),
    ...chordFormula(chord).map((label) => {
      const pc = mod12(chord.root + FORMULA_TONES[label].pitch);
      return button(
        "bass",
        label === "1" ? "Root · 1" : `${label} in bass`,
        "",
        "choice-button",
        `data-value="${pc}" data-focus="bass-${pc}" aria-label="${label} in bass" aria-pressed="${session.bassFilter === pc}"`,
      );
    }),
  ].join("");
  const detected = !actual?.midis.length
    ? "No notes selected"
    : actual.bass === chord.root
      ? "Root position · 1 in bass"
      : `${chordInterval(chord, actual.bass)} in bass`;
  return `<div class="workshop-row"><h3>Root</h3><div class="root-choices" role="group" aria-label="Chord root">${roots}</div></div><div class="workshop-row"><h3>Quality</h3><div class="quality-choices" role="group" aria-label="Chord quality">${qualities}</div></div>${intervalMatrix(session)}<section class="workshop-row inversion-row"><h3>Inversion<span>Grip filter</span></h3><div class="bass-choices" role="group" aria-label="Inversion filter">${basses}<output class="inversion-readout" aria-label="Detected inversion">Current: ${esc(detected)}</output></div></section>`;
}

function neckControls(session) {
  return `<div class="neck-toolbar"><div class="segmented"><button data-action="mode" data-value="select" data-focus="select-mode" aria-pressed="${session.mode === "select"}">Select voicing</button><button data-action="mode" data-value="draw" data-focus="draw-mode" aria-pressed="${session.mode === "draw"}">Draw / remove</button></div><label class="inline-label">Hand position<select data-editor="position" data-focus="position">${options(
    [
      ["any", "Any"],
      [0, "0–4"],
      [5, "5–8"],
      [9, "9–12"],
      [13, "13–16"],
      [17, "17–20"],
      [21, "21–24"],
    ],
    session.position,
  )}</select></label><label class="inline-label">Frets<select data-editor="start" data-focus="start">${options(
    Array.from({ length: 13 }, (_, i) => [i, `${i}–${i + 12}`]),
    session.start,
  )}</select></label>${button("clear", "Clear", "", "quiet", `data-focus="clear" aria-label="Clear grip" ${session.busy ? "disabled" : ""}`)}</div>`;
}

function neckPanel(session) {
  const { chord, tuning, frets, busy } = session;
  const hint = session.mode === "draw"
    ? "Click a fret to place a note; click again to remove it. The formula follows the sounding notes."
    : session.selectingVoicing
      ? "Select chord tones to build the voicing. One fret per string; click a selected note to remove it."
      : "Click any chord tone to start a new voicing, then select the remaining notes. The first click replaces this grip.";
  return `<section class="editor-neck">${neckControls(session)}<div class="legend workshop-legend"><span><i class="root-key"></i>Root</span><span><i></i>Chord tone</span><span><i class="scale-key"></i>In scale</span><span><i class="outside-key"></i>Outside scale</span><span>Outer ring = selected</span></div>${fretboard(tuning, toneSet(chord), chord.root, { start: session.start, frets, editing: !busy, chordTonesOnly: session.mode === "select", labels: "intervals", keyTones: session.keyTones, chord })}<p class="editor-hint">${esc(hint)}</p></section>`;
}

function editorStatus(session, actual) {
  if (session.message) return session.message;
  if (session.busy) return "Finding fingerings…";
  if (session.selectingVoicing) {
    const remaining = chordFormula(session.chord).filter(
      (label) => !actual?.intervals.includes(FORMULA_TONES[label].pitch),
    );
    return remaining.length
      ? `Not yet voiced: ${remaining.join(" · ")}. The chord formula stays unchanged.`
      : "All chord tones voiced. Save to use this fingering in the part.";
  }
  return "Four-fret hand span. Open strings remain available; extended grips may omit the fifth.";
}

function gripPanel(session, name, actual) {
  const { chord, tuning, frets, busy } = session;
  const sounding = actual?.intervals
    .map((n) => chordInterval(chord, mod12(chord.root + n)))
    .join(" · ");
  return `<aside class="grip-panel"><div class="grip-heading"><h3>Fingering</h3>${button("audition", "Preview", "play", "outlined", 'data-focus="preview"')}</div><div class="editor-preview">${chordBox(tuning, frets, chord.root, name, false, "intervals", chord)}<p>${sounding ? `Sounding: ${sounding}` : "Place notes on the fretboard."}</p></div><div class="grip-controls">${button("alternative", "", "left", "icon-button", `data-direction="-1" data-focus="previous-grip" aria-label="Previous grip" ${busy || session.voicings.length < 2 ? "disabled" : ""}`)}<span>${session.voicings.length ? `Grip ${session.voicingIndex + 1} / ${session.voicings.length}` : "Manual grip"}</span>${button("alternative", "", "right", "icon-button", `data-direction="1" data-focus="next-grip" aria-label="Next grip" ${busy || session.voicings.length < 2 ? "disabled" : ""}`)}${button("suggest", "Find a grip", "", "quiet", `data-focus="suggest" ${busy ? "disabled" : ""}`)}</div><div class="voice-list"><div class="eyebrow">STRINGS · TREBLE TO BASS</div>${tuning
    .map((open, string) => voiceRow(open, string, session))
    .reverse()
    .join(
      "",
    )}</div><label class="chord-label-input">Label (optional)<input data-editor="label" data-focus="label" value="${esc(chord.label)}" maxlength="120" placeholder="Chord label"></label></aside>`;
}

export function editorView(session) {
  const { chord, tuning, frets, busy } = session;
  const actual = frets ? describeFingering(tuning, frets, chord.root) : null;
  const name = chordName(
    chord,
    actual?.midis.length ? actual.bass : chord.bass,
  );
  return `<header class="editor-header"><div><div class="eyebrow">CHORD WORKSHOP · ${esc(session.partName)} · ${tuning.length} STRINGS</div><div class="workshop-title"><h2 id="editor-title">${esc(name)}</h2><span>${esc(chordQuality(chord).name)}</span><strong class="workshop-formula">${chordFormula(chord).join(" · ")}</strong></div></div><div>${button("theme", document.documentElement.dataset.theme === "light" ? "Dark theme" : "Light theme", "", "outlined", 'data-focus="theme"')}${button("close", "", "close", "icon-button", 'aria-label="Close chord editor"')}</div></header><div class="workshop-layout"><div class="workshop-main">${chordControls(session, actual)}${neckPanel(session)}<div class="editor-status" role="status">${esc(editorStatus(session, actual))}</div></div>${gripPanel(session, name, actual)}</div><footer class="editor-footer"><span>Changes apply when saved.</span><div>${button("close", "Cancel", "", "quiet")}${button("save", session.isNew ? "Add to part" : "Save chord", "plus", "primary", busy || !actual?.midis.length ? "disabled" : "")}</div></footer>`;
}
