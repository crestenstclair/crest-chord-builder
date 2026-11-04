import {
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
  simpleInterval,
  simpleFormula,
} from "./chord-formula.js";
import { esc, options, button } from "./ui.js";
import { fretboard, chordBox } from "./diagrams.js";

export const VOICINGS_PER_PAGE = 6;

function voiceRow(open, string, session) {
  const fret = session.frets?.[string] ?? -1;
  const midi = fret >= 0 ? open + fret : null;
  const number = session.tuning.length - string;
  return `<div class="voice-row"><span class="voice-string">${number}<small>${esc(pitchName(open))}</small></span><strong>${midi === null ? "×" : chordInterval(session.chord, mod12(midi))}<small>${midi === null ? "Muted" : `Fret ${fret} · ${esc(pitchName(midi))}`}</small></strong><div>${button("octave", "−8ve", "", "octave-button", `data-string="${string}" data-delta="-12" data-focus="down-${string}" ${fret < 12 ? "disabled" : ""} aria-label="String ${number} down one octave"`)}${button("octave", "+8ve", "", "octave-button", `data-string="${string}" data-delta="12" data-focus="up-${string}" ${fret < 0 || fret > 12 ? "disabled" : ""} aria-label="String ${number} up one octave"`)}${button("mute", "×", "", "icon-button", `data-string="${string}" data-focus="mute-${string}" aria-label="Mute string ${number}" ${fret < 0 ? "disabled" : ""}`)}</div></div>`;
}

function intervalAlias(label) {
  return simpleInterval(label) !== label ? ` (${label}th)` : "";
}

function intervalCell(label, session) {
  if (!label)
    return '<td class="interval-unavailable" aria-label="Not applicable">—</td>';
  const primary = simpleInterval(label);
  // A saved sus2/sus4 occupies the same visible cell as 2/4. Clicking that
  // active cell removes its original tone instead of silently respelling it.
  const active = chordFormula(session.chord).find((tone) => simpleInterval(tone) === primary);
  const selected = Boolean(active);
  const inKey = session.keyTones.includes(
    mod12(session.chord.root + FORMULA_TONES[label].pitch),
  );
  const keyStatus = inKey ? "In key" : "Out of key";
  const extension = intervalAlias(label);
  return `<td>${button("interval", `<span>${esc(primary)}${extension ? `<span class="interval-alias">${esc(extension)}</span>` : ""}</span><small id="tone-key-${primary}">${keyStatus}</small>`, "", `interval-choice ${inKey ? "in-key" : "out-of-key"}`, `data-tone="${active ?? label}" data-focus="tone-${primary}" aria-label="Chord interval ${primary}" aria-describedby="tone-key-${primary}" aria-pressed="${selected}" title="${primary}${extension} · ${keyStatus.toLowerCase()} · ${selected ? "click to remove" : "click to select"}"`)}</td>`;
}

function intervalMatrix(session) {
  const rows = ["Raised", "Natural", "Lowered", "Alternate"];
  return `<section class="interval-section" aria-labelledby="interval-heading"><div class="interval-heading"><h3 id="interval-heading">Intervals</h3><p>Select a variant. Click it again to remove it.</p></div><div class="interval-scroll"><table class="interval-matrix"><thead><tr><th scope="col">Degree</th>${DEGREE_COLUMNS.map((c) => `<th scope="col">${c.name}${intervalAlias(c.choices[1])}</th>`).join("")}</tr></thead><tbody>${rows.map((name, index) => `<tr><th scope="row">${name}</th>${DEGREE_COLUMNS.map((c) => intervalCell(c.choices[index], session)).join("")}</tr>`).join("")}</tbody></table></div></section>`;
}

function chordControls(session) {
  const { chord } = session;
  const family = chordFamily(chord);
  const roots = session.spelling.map((name, n) =>
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
  return `<div class="workshop-row"><h3>Root</h3><div class="root-choices" role="group" aria-label="Chord root">${roots}</div></div><div class="workshop-row"><h3>Quality</h3><div class="quality-choices" role="group" aria-label="Chord quality">${qualities}</div></div>`;
}

function inversionControls(session, actual) {
  const { chord } = session;
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
      const interval = simpleInterval(label);
      return button(
        "bass",
        interval === "1" ? "Root · 1" : `${interval} in bass`,
        "",
        "choice-button",
        `data-value="${pc}" data-focus="bass-${pc}" aria-label="${interval} in bass" aria-pressed="${session.bassFilter === pc}"`,
      );
    }),
  ].join("");
  const detected = !actual?.midis.length
    ? "No notes selected"
    : actual.bass === chord.root
      ? "Root position · 1 in bass"
      : `${chordInterval(chord, actual.bass)} in bass`;
  return `<section class="workshop-row inversion-row"><h3>Inversion<span>Grip filter</span></h3><div class="bass-choices" role="group" aria-label="Inversion filter">${basses}<output class="inversion-readout" aria-label="Detected inversion">Current: ${esc(detected)}</output></div></section>`;
}

function neckControls(session) {
  return `<div class="neck-toolbar"><label class="inline-label">Hand position<select data-editor="position" data-focus="position">${options(
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
  )}</select></label></div>`;
}

function neckPanel(session) {
  const { chord, tuning, frets } = session;
  return `<section class="editor-neck">${neckControls(session)}<div class="legend workshop-legend"><span><i class="root-key"></i>Root</span><span><i></i>Chord tone</span><span><i class="scale-key"></i>In scale</span><span><i class="outside-key"></i>Outside scale</span><span>Ring = sounding note${session.anchors.length ? " · Square = required note" : ""}</span></div>${fretboard(tuning, toneSet(chord), chord.root, { start: session.start, frets, anchors: session.anchors, editing: true, labels: "intervals", keyTones: session.keyTones, spelling: session.spelling, chord })}<p class="editor-hint">Click any fret to add a note. Click it again to remove it; another fret replaces that string’s note.</p></section>`;
}

function editorPanels(session, actual) {
  const tabs = [["fretboard", "Fretboard"], ["scale", "Scale"]].map(([value, label]) =>
    `<button role="tab" id="editor-tab-${value}" data-action="view" data-value="${value}" data-focus="view-${value}" aria-selected="${session.view === value}" aria-controls="editor-panel-${value}" tabindex="${session.view === value ? 0 : -1}">${label}</button>`,
  ).join("");
  return `<div class="editor-views"><div class="segmented" role="tablist" aria-label="Chord editing view">${tabs}</div><span class="editor-scale-context">${esc(session.scaleName)} · intervals from ${esc(session.spelling[session.chord.root])}</span>${button("clear", "Clear", "", "quiet", `data-focus="clear" aria-label="Clear grip"`)}</div>${inversionControls(session, actual)}<div role="tabpanel" id="editor-panel-fretboard" aria-labelledby="editor-tab-fretboard" ${session.view === "fretboard" ? "" : "hidden"}>${neckPanel(session)}</div><div role="tabpanel" id="editor-panel-scale" aria-labelledby="editor-tab-scale" ${session.view === "scale" ? "" : "hidden"}>${chordControls(session)}${intervalMatrix(session)}<p class="editor-hint">The same chord as the fretboard. Add or remove intervals; in-key notes follow ${esc(session.scaleName)}.</p></div>`;
}

function editorStatus(session) {
  if (session.message) return session.message;
  if (session.nameFromNotes && !session.busy) return session.namedRoot === null
    ? "Place notes, then choose a chord name below." : "Name selected. Add to part to save this exact fingering.";
  if (session.busy) return session.anchors.length
    ? "Selected notes are ready to save. Finding nearby voicings…"
    : "Finding fingerings…";
  if (session.searchOpen)
    return session.voicingIndex < 0
      ? "Selected notes are ready to save. Keep adding notes or choose a suggestion below."
      : "Selected voicing ready. Save to use this fingering in the part.";
  return "Four-fret hand span. Open strings remain available; extended grips may omit the fifth.";
}

function voicingChoice(voicing, index, session) {
  const { chord, tuning } = session;
  const actual = describeFingering(tuning, voicing.frets, chord.root);
  const name = chordName(chord, actual.bass, session.spelling);
  const selected = session.voicingIndex === index;
  return `<button class="voicing-choice" data-action="choose-voicing" data-index="${index}" data-focus="voicing-${index}" data-frets="${voicing.frets.join(",")}" aria-label="Choose voicing ${index + 1}: ${esc(name)}" aria-pressed="${selected}"><strong>${esc(name)}</strong>${chordBox(tuning, voicing.frets, chord.root, name, false, "intervals", chord)}<span>${voicing.frets.map((f) => f < 0 ? "×" : f).join(" ")}</span></button>`;
}

function requiredNote(position, session) {
  const { chord, tuning } = session;
  const label = chordInterval(chord, mod12(tuning[position.string] + position.fret));
  const string = tuning.length - position.string;
  return button("remove-anchor", `${esc(label)} · S${string} F${position.fret} <span aria-hidden="true">×</span>`, "", "required-note", `data-string="${position.string}" data-position="${position.fret}" data-focus="required-${position.string}" aria-label="Remove required note: string ${string}, fret ${position.fret}"`);
}

function inversionGroup(group, index, session) {
  const label = group.bass === session.chord.root
    ? "Root · 1"
    : `${chordInterval(session.chord, group.bass)} in bass`;
  return button("voicing-group", `${esc(label)} <span>${group.indices.length}</span>`, "", "choice-button", `data-index="${index}" data-bass="${group.bass}" data-focus="group-${group.bass}" aria-label="${esc(label)}: ${group.indices.length} voicings" aria-pressed="${session.voicingGroup === index}"`);
}

function emptyVoicings(session) {
  if (session.busy) return '<p class="voicing-empty">Finding nearby voicings…</p>';
  if (session.searchError)
    return `<div class="voicing-empty"><p>Voicing search unavailable. Your selected notes are kept.</p>${button("retry-search", "Retry search", "", "outlined", 'data-focus="retry-search"')}</div>`;
  return '<p class="voicing-empty">No matching voicings. Remove a required note or change the filters.</p>';
}

function voicingGrid(session) {
  if (!session.searchOpen) return "";
  const { anchors, voicings, busy, voicingPage, voicingGroups, voicingGroup } = session;
  const indices = voicingGroups[voicingGroup]?.indices ?? [];
  const first = voicingPage * VOICINGS_PER_PAGE;
  const end = Math.min(first + VOICINGS_PER_PAGE, indices.length);
  const cards = indices.slice(first, end)
    .map((index) => voicingChoice(voicings[index], index, session)).join("");
  const groups = voicingGroups.map((group, index) => inversionGroup(group, index, session)).join("");
  const notes = anchors.map((position) => requiredNote(position, session)).join("");
  return `<section class="voicing-results" aria-labelledby="voicing-results-title" aria-busy="${busy}"><div class="voicing-results-heading"><h3 id="voicing-results-title">Nearby voicings</h3><div class="voicing-search-actions">${button("close-search", "", "close", "icon-button", 'data-focus="close-search" aria-label="Close voicing search" title="Close search and return to chord editing"')}</div></div>${anchors.length ? `<div class="required-notes" role="group" aria-label="Required notes"><span>Include</span>${notes}</div>` : ""}<div class="voicing-browse"><div class="voicing-groups" role="group" aria-label="Voicings by inversion">${groups}</div><div class="voicing-pagination">${button("voicing-page", "", "left", "icon-button", `data-direction="-1" data-focus="voicing-page-back" aria-label="Previous voicings" ${busy || first === 0 ? "disabled" : ""}`)}<span>${indices.length ? `${first + 1}–${end} / ${indices.length}` : ""}</span>${button("voicing-page", "", "right", "icon-button", `data-direction="1" data-focus="voicing-page-next" aria-label="Next voicings" ${busy || end >= indices.length ? "disabled" : ""}`)}</div></div>${cards ? `<div class="voicing-grid">${cards}</div>` : emptyVoicings(session)}</section>`;
}

function gripPanel(session, name, actual) {
  const { chord, tuning, frets, busy } = session;
  const alternatives = session.searchOpen
    ? session.voicingGroups[session.voicingGroup]?.indices ?? []
    : session.voicings.map((_, index) => index);
  const selected = alternatives.indexOf(session.voicingIndex);
  const sounding = actual?.intervals
    .map((n) => chordInterval(chord, mod12(chord.root + n)))
    .join(" · ");
  return `<aside class="grip-panel"><div class="grip-heading"><h3>Fingering</h3>${button("audition", "Preview", "play", "outlined", 'data-focus="preview"')}</div><div class="editor-preview">${!frets && !busy ? '<div class="diagram-placeholder">Choose a voicing below.</div>' : chordBox(tuning, frets, chord.root, name, false, "intervals", chord)}<p>${sounding ? `Sounding: ${sounding}` : session.anchors.length ? "Choose a voicing from the grid." : "Place notes on the fretboard."}</p></div><div class="grip-controls">${button("alternative", "", "left", "icon-button", `data-direction="-1" data-focus="previous-grip" aria-label="Previous grip" ${busy || alternatives.length < 2 ? "disabled" : ""}`)}<span>${alternatives.length ? (selected < 0 ? "Selected notes" : `Grip ${selected + 1} / ${alternatives.length}`) : "Manual grip"}</span>${button("alternative", "", "right", "icon-button", `data-direction="1" data-focus="next-grip" aria-label="Next grip" ${busy || alternatives.length < 2 ? "disabled" : ""}`)}${button("suggest", "Find a grip", "", "quiet", `data-focus="suggest" ${busy || !chord.intervals.length ? "disabled" : ""}`)}</div><div class="voice-list"><div class="eyebrow">STRINGS · TREBLE TO BASS</div>${tuning
    .map((open, string) => voiceRow(open, string, session))
    .reverse()
    .join(
      "",
    )}</div><label class="chord-label-input">Label (optional)<input data-editor="label" data-focus="label" value="${esc(chord.label)}" maxlength="120" placeholder="Chord label"></label></aside>`;
}

function chordNameChoice(choice, session) {
  const name = chordName(choice, choice.bass, session.spelling);
  const implied = choice.impliedTones.length
    ? `Implied: ${choice.impliedTones.map((tone) => esc(session.spelling[tone])).join(" · ")}` : "All tones played";
  return button("choose-name", `<strong>${esc(name)}</strong><span class="name-key ${choice.inKey ? "in-key" : "out-of-key"}">${choice.inKey ? "In key" : "Out of key"}</span><small>${simpleFormula(choice).join(" · ")}</small><small>${implied}</small>`, "", "chord-name-choice", `data-root="${choice.root}" data-focus="name-${choice.root}" aria-label="Use ${esc(name)}" aria-pressed="${session.namedRoot === choice.root}"`);
}

function chordNames(session) {
  const choices = session.nameChoices.map((choice) => chordNameChoice(choice, session)).join("");
  return `<section class="chord-names" aria-labelledby="chord-names-heading"><div class="voicing-results-heading"><h3 id="chord-names-heading">Chord names</h3><span>Key checks include implied notes.</span></div><p>Choose a name; your frets stay the same.</p>${choices ? `<div class="chord-name-grid">${choices}</div>` : '<p class="name-empty">Select at least two different notes to compare chord names.</p>'}</section>`;
}

export function editorView(session) {
  const { chord, tuning, frets } = session;
  const actual = frets ? describeFingering(tuning, frets, chord.root) : null;
  const name = session.nameFromNotes && session.namedRoot === null && chord.intervals.length
    ? "Choose a chord name" : chord.intervals.length ? chordName(
    chord,
    actual?.midis.length ? actual.bass : chord.bass,
    session.spelling,
  ) : "No notes selected";
  return `<header class="editor-header"><div><div class="eyebrow">CHORD WORKSHOP · ${esc(session.partName)} · ${tuning.length} STRINGS</div><div class="workshop-title"><h2 id="editor-title">${esc(name)}</h2><span>${chord.intervals.length && (!session.nameFromNotes || session.namedRoot !== null) ? esc(chordQuality(chord).name) : ""}</span><strong class="workshop-formula">${simpleFormula(chord).join(" · ")}</strong></div></div><div>${button("theme", document.documentElement.dataset.theme === "light" ? "Dark theme" : "Light theme", "", "outlined", 'data-focus="theme"')}${button("close", "", "close", "icon-button", 'aria-label="Close chord editor"')}</div></header><div class="workshop-layout"><div class="workshop-main">${editorPanels(session, actual)}<div class="editor-status" role="status">${esc(editorStatus(session))}</div>${session.nameFromNotes ? chordNames(session) : voicingGrid(session)}</div>${gripPanel(session, name, actual)}</div><footer class="editor-footer"><span>Changes apply when saved.</span><div>${button("close", "Cancel", "", "quiet")}${button("save", session.isNew ? "Add to part" : "Save chord", "plus", "primary", !actual?.midis.length || (session.nameFromNotes && session.namedRoot === null) ? "disabled" : "")}</div></footer>`;
}
