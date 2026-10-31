import {
  NOTES,
  INTERVALS,
  SCALES,
  PRESETS,
  pitchName,
  tuningInterval,
  scaleNotes,
  scaleChords,
  chordName,
  describeFingering,
  mod12,
} from "./music.js";
import { getFingering } from "./project.js";
import { esc, icon, options, button } from "./ui.js";
import { chordBox, fretboard } from "./diagrams.js";

const noteOptions = (selected) =>
  options(
    NOTES.map((n, i) => [i, n]),
    selected,
  );
const partGuitar = (project, part) =>
  project.guitars.find((g) => g.id === part.guitarId);
const scaleName = (part) =>
  `${NOTES[part.root]} ${SCALES[part.scale].name.toLowerCase()}`;

export function shell(project, state, content) {
  const part =
    project.parts.find((p) => p.id === state.partId) ?? project.parts[0];
  const nav = [
    ["guitars", "tune", "01", "Your guitars"],
    ["parts", "grid", "02", "Build parts"],
    ["display", "display", "03", "Play & print"],
  ]
    .map(
      ([view, symbol, number, label]) =>
        `<button data-action="view" data-view="${view}" class="nav-item ${view === state.view ? "active" : ""}" ${view === state.view ? 'aria-current="page"' : ""}>${icon(symbol)}<span>${label}</span><small>${number}</small></button>`,
    )
    .join("");
  const parts = project.parts
    .map(
      (p, i) =>
        `<button data-action="select-part" data-id="${p.id}" class="part-nav ${p.id === part.id ? "active" : ""}"><span class="part-number">${String(i + 1).padStart(2, "0")}</span><span>${esc(p.name)}<small>${esc(scaleName(p))}</small></span><span class="part-count">${p.chords.length}</span></button>`,
    )
    .join("");
  return `<header class="topbar"><a href="./" class="brand" aria-label="Crest Chord Builder"><img src="./favicon.svg" alt="" width="30" height="30"><strong>crest<span> / chord builder</span></strong></a><div class="project-title"><span class="project-dot"></span><input aria-label="Project title" data-field="project-title" value="${esc(project.title)}" maxlength="120"><span class="save-state ${state.storageError ? "error" : ""}">${state.storageError ? "Not saved locally" : "Saved on this device"}</span></div><div class="top-actions">${button("undo", "", "undo", "icon-button", `aria-label="Undo last change" title="Undo last change" ${state.canUndo ? "" : "disabled"}`)}${button("import", "Open JSON", "upload", "quiet")}${button("export", "Save JSON", "download", "outlined")}</div></header>
  <div class="workspace"><aside class="sidebar"><div class="sidebar-label">WORKSPACE</div><nav aria-label="Workflow">${nav}</nav><div class="sidebar-section"><div class="sidebar-label">YOUR PARTS <button class="icon-button" data-action="add-part" aria-label="Add Part" title="Add Part">${icon("plus", 16)}</button></div><nav aria-label="Parts">${parts}</nav>${button("add-part", "Add Part", "plus", "add-part")}</div><div class="sidebar-foot"><span class="local-dot"></span> Made for your instrument.<br><span>Private by design. Browser only.</span><a href="https://github.com/crestenstclair/crest-chord-builder" target="_blank" rel="noreferrer">Source & documentation ↗</a></div></aside><main id="main" tabindex="-1">${content}</main></div><footer class="print-footer">${esc(project.title)} · Crest Chord Builder · ${esc(partGuitar(project, part).strings.map(pitchName).join(" – "))}</footer>`;
}

function guitarString(open, index, guitar, part) {
  const interval = index
    ? tuningInterval(guitar.strings[index - 1], open)
    : "Reference string";
  return `<div class="string-editor"><div class="string-index">${String(index + 1).padStart(2, "0")}<small>${index === 0 ? "bass side" : index === guitar.strings.length - 1 ? "treble side" : "string"}</small></div><label>Note<select data-field="string-note" data-index="${index}" aria-label="String ${index + 1} note">${noteOptions(mod12(open))}</select></label><label>Octave<select data-field="string-octave" data-index="${index}" aria-label="String ${index + 1} octave">${options(
    Array.from({ length: 10 }, (_, i) => [i - 1, i - 1]),
    Math.floor(open / 12) - 1,
  )}</select></label><div class="tuning-pitch">${esc(pitchName(open))}<small>${INTERVALS[mod12(open - part.root)]} in ${esc(NOTES[part.root])}</small></div><div class="string-interval"><span>${esc(interval)}</span><small>${index ? "from previous string" : "intervals include octaves"}</small></div><button data-action="remove-string" data-index="${index}" class="icon-button" aria-label="Remove string ${index + 1}" ${guitar.strings.length <= 1 ? "disabled" : ""}>${icon("close", 16)}</button></div>`;
}

export function guitarsView(project, state) {
  const guitar =
    project.guitars.find((g) => g.id === state.guitarId) ?? project.guitars[0];
  const part =
    project.parts.find((p) => p.id === state.partId) ?? project.parts[0];
  const rows = guitar.strings
    .map((n, i) => guitarString(n, i, guitar, part))
    .join("");
  return `<div class="page-heading"><div><div class="eyebrow">01 / THE INSTRUMENT</div><h1>Your tuning. Your rules.</h1><p>Start with a guitar. Every note and fingering follows its tuning.</p></div>${button("new-guitar", "Add guitar", "plus", "primary", project.guitars.length >= 16 ? "disabled" : "")}</div><div class="guitar-layout"><section class="panel tuning-panel"><div class="panel-heading"><div><span class="eyebrow">GUITAR SETUP</span><h2>Make it yours</h2></div><span class="tag">${guitar.strings.length} / 8 strings</span></div><div class="setup-controls"><label>Guitar<select data-field="active-guitar">${options(
    project.guitars.map((g) => [g.id, g.name]),
    guitar.id,
  )}</select></label><label>Name<input data-field="guitar-name" value="${esc(guitar.name)}" maxlength="120"></label><label>Tuning preset<select data-field="preset"><option value="">Custom / choose preset</option>${options(
    Object.entries(PRESETS).map(([k, v]) => [k, v.name]),
    "",
  )}</select></label></div><div class="string-list">${rows}</div><div class="panel-bottom">${button("add-string", "Add string", "plus", "outlined", guitar.strings.length >= 8 ? "disabled" : "")}<span>Physical order: bass side to treble side</span></div></section><aside class="tuning-aside"><div class="tuning-illustration" aria-hidden="true"><div class="headstock">${guitar.strings.map((n, i) => `<div class="peg peg-${i % 2}"><span>${esc(pitchName(n))}</span></div>`).join("")}</div></div><span class="eyebrow">OPEN STRINGS</span><h2>${esc(guitar.strings.map((n) => NOTES[mod12(n)]).join(" · "))}</h2><p>Note + octave defines the pitch. Intervals show the distance between neighboring strings, including octave jumps.</p><p class="subtle">Saved fingerings are kept for each tuning. Switch back to recover a previous grip.</p>${button("view", "Start building parts", "right", "primary", 'data-view="parts"')}</aside></div>`;
}

function harmonyRow(part, label, caption, count, inverted = false) {
  const chords = scaleChords(part.root, part.scale, count, inverted);
  const cells = chords
    .map(
      (chord, i) =>
        `<button class="harmony-chord" data-action="add-harmony" data-count="${count}" data-inverted="${inverted}" data-degree="${i}" title="Add ${esc(chord.name)} to this part" aria-label="Add ${esc(chord.name)} (${label})"><strong>${esc(chord.name)}</strong><span>${esc(chord.roman)}<span class="cell-plus">+</span></span></button>`,
    )
    .join("");
  return `<div class="harmony-row"><div class="row-label"><strong>${label}</strong><small>${caption}</small></div>${cells}</div>`;
}

function chordCard(
  chord,
  index,
  part,
  guitar,
  display = false,
  selected = false,
  error = "",
) {
  const frets = getFingering(chord, guitar.strings);
  const described = frets?.some((f) => f >= 0)
    ? describeFingering(guitar.strings, frets, chord.root)
    : null;
  const name = described?.name ?? chordName(chord);
  const label = chord.label || name;
  return `<article class="chord-card ${selected ? "selected-card" : ""}" data-chord="${chord.id}"><header><span class="chord-order">${String(index + 1).padStart(2, "0")}</span><div><h3>${esc(label)}</h3><small>${chord.label ? esc(name) : chord.intervals.map((n) => INTERVALS[n]).join(" · ")}</small></div>${button("play-chord", "", "play", "icon-button no-print", `data-id="${chord.id}" aria-label="Play ${esc(label)}" ${frets ? "" : "disabled"}`)}</header>${error && !frets ? '<div class="diagram-placeholder">Search unavailable.<br>Use Edit to draw a grip.</div>' : frets && !described ? '<div class="diagram-placeholder">No automatic grip.<br>Use Edit to draw a fingering.</div>' : chordBox(guitar.strings, frets, described?.root ?? chord.root, name, display)}<div class="fret-values">${frets ? frets.map((f) => (f < 0 ? "×" : f)).join(" ") : "Searching your tuning"}</div><div class="chord-card-actions no-print">${button("cycle-voicing", "", "left", "icon-button", `data-id="${chord.id}" data-direction="-1" aria-label="Previous fingering for ${esc(label)}"`)}${button("edit-chord", "Edit", "edit", "quiet", `data-id="${chord.id}" aria-label="Edit ${esc(label)}"`)}${button("cycle-voicing", "", "right", "icon-button", `data-id="${chord.id}" data-direction="1" aria-label="Next fingering for ${esc(label)}"`)}</div>${display ? "" : `<div class="reorder-actions">${button("move-chord", "←", "", "icon-button", `data-id="${chord.id}" data-direction="-1" aria-label="Move ${esc(label)} earlier" ${index === 0 ? "disabled" : ""}`)}${button("remove-chord", "", "trash", "icon-button", `data-id="${chord.id}" aria-label="Remove ${esc(label)}"`)}${button("move-chord", "→", "", "icon-button", `data-id="${chord.id}" data-direction="1" aria-label="Move ${esc(label)} later" ${index === part.chords.length - 1 ? "disabled" : ""}`)}</div>`}</article>`;
}

export function partsView(project, state) {
  const part =
    project.parts.find((p) => p.id === state.partId) ?? project.parts[0];
  const guitar = partGuitar(project, part);
  return `<div class="page-heading"><div><div class="eyebrow">02 / THE HARMONY</div><h1>Make room for an idea.</h1><p>Pick a scale. Find a chord. Shape it into something yours.</p></div>${button("view", "Play & print", "right", "outlined", 'data-view="display"')}</div><section class="panel scale-panel"><div class="mobile-parts"><label>Current part<select data-field="active-part">${options(
    project.parts.map((p) => [p.id, p.name]),
    part.id,
  )}</select></label>${button("add-part", "Add Part", "plus", "outlined")}</div><div class="part-config"><label class="part-name">Part name<input data-field="part-name" value="${esc(part.name)}" maxlength="120"></label><label>Guitar<select data-field="part-guitar">${options(
    project.guitars.map((g) => [g.id, g.name]),
    part.guitarId,
  )}</select></label><div class="scale-select"><label>Root<select data-field="part-root">${noteOptions(part.root)}</select></label><label>Scale<select data-field="part-scale">${options(
    Object.entries(SCALES).map(([key, s]) => [key, s.name]),
    part.scale,
  )}</select></label></div>${button("remove-part", "", "trash", "icon-button", `aria-label="Delete this part" title="Delete this part" ${project.parts.length <= 1 ? "disabled" : ""}`)}</div><div class="scale-summary"><span class="scale-pill">${esc(scaleName(part))}</span><div class="scale-tones">${scaleNotes(
    part.root,
    part.scale,
  )
    .map(
      (n) =>
        `<span><b>${esc(n.name)}</b><small>${esc(n.interval)}</small></span>`,
    )
    .join(
      "",
    )}</div><span class="scale-hint">7 notes. Endless directions.</span></div><div class="harmony-scroll"><div class="harmony-grid">${harmonyRow(part, "Triads", "The foundation", 3)}${harmonyRow(part, "Sevenths", "A little more color", 4)}${harmonyRow(part, "Ninths", "Room to breathe", 5)}${harmonyRow(part, "Inversions", "Third in the bass", 3, true)}</div></div><div class="grid-foot"><span>Click a chord to add it to your part.</span><span>Inversions & fingerings follow your tuning.</span></div></section><section class="progression"><div class="section-heading"><div><div class="eyebrow">YOUR PROGRESSION</div><h2>${esc(part.name)} <span class="count-badge">${part.chords.length}</span></h2></div>${button("custom-chord", "Build a chord", "plus", "outlined")}</div>${part.chords.length ? `<div class="chord-cards">${part.chords.map((c, i) => chordCard(c, i, part, guitar, false, c.id === state.lastChordId, state.errors[c.id])).join("")}</div>` : `<div class="empty-progression"><span class="empty-chord">${icon("plus", 24)}</span><div><h3>Your next progression starts here.</h3><p>Add chords from the grid, or build a voicing from scratch.</p></div><span class="empty-shortcut">Try Am7 in the Sevenths row ↗</span></div>`}</section>`;
}

export function displayView(project, state) {
  const part =
    project.parts.find((p) => p.id === state.partId) ?? project.parts[0];
  const guitar = partGuitar(project, part);
  const notes = scaleNotes(part.root, part.scale);
  const spellings = [...NOTES];
  notes.forEach((n) => {
    spellings[n.pc] = n.name;
  });
  const pages = Math.max(1, Math.ceil(part.chords.length / 6));
  const page = Math.min(state.sheetPage, pages - 1);
  const visible = part.chords.slice(page * 6, page * 6 + 6);
  return `<div class="display-page ${state.focus ? "focus-mode" : ""}"><div class="display-toolbar no-print"><div><label class="inline-label">Part<select data-field="display-part">${options(
    project.parts.map((p) => [p.id, p.name]),
    part.id,
  )}</select></label></div><div class="display-tools"><div class="segmented"><button data-action="labels" data-value="notes" aria-pressed="${state.labels === "notes"}">Notes</button><button data-action="labels" data-value="intervals" aria-pressed="${state.labels === "intervals"}">Intervals</button></div><label class="inline-label">Frets<select data-field="display-start">${options(
    [
      [0, "0–12"],
      [5, "5–17"],
      [12, "12–24"],
    ],
    state.start,
  )}</select></label><label class="inline-label size-control">Size<input type="range" min="90" max="150" step="10" value="${state.zoom}" data-field="zoom" aria-label="Display size"></label>${button("fullscreen", state.focus ? "Exit focus" : "Fullscreen", "expand", "outlined")}${button("print", "Print sheet", "print", "primary")}</div></div><div class="sheet" style="--display-zoom:${state.zoom / 100}"><div class="sheet-heading"><div><div class="eyebrow">${esc(project.title)} / ${String(project.parts.indexOf(part) + 1).padStart(2, "0")}</div><h1>${esc(part.name)}</h1></div><div class="sheet-meta"><strong>${esc(scaleName(part))}</strong><span>${esc(guitar.name)} · ${guitar.strings.length} strings</span><small>${esc(guitar.strings.map(pitchName).join(" · "))}</small></div></div><section class="scale-map"><div class="map-heading"><span class="eyebrow">THE WHOLE NECK</span><div class="legend"><span><i class="root-key"></i>Root</span><span><i></i>Scale tone</span><span>High string on top</span></div></div>${fretboard(
    guitar.strings,
    notes.map((n) => n.pc),
    part.root,
    { start: state.start, labels: state.labels, spelling: spellings },
  )}</section><div class="sheet-chords-heading"><h2>Chord sheet</h2><span>Low string on left · × mute · ○ open</span><div class="page-controls no-print">${button("sheet-page", "", "left", "icon-button", `data-direction="-1" aria-label="Previous chord page" ${page === 0 ? "disabled" : ""}`)}<span>${page + 1} / ${pages}</span>${button("sheet-page", "", "right", "icon-button", `data-direction="1" aria-label="Next chord page" ${page >= pages - 1 ? "disabled" : ""}`)}</div></div><div class="chord-cards display-chords screen-only">${visible.map((c, i) => chordCard(c, page * 6 + i, part, guitar, true, false, state.errors[c.id])).join("") || `<div class="empty-progression"><p>Add chords in Build parts to make your chord sheet.</p>${button("view", "Build parts", "right", "outlined", 'data-view="parts"')}</div>`}</div><div class="print-only chord-cards">${part.chords.map((c, i) => chordCard(c, i, part, guitar, true, false, state.errors[c.id])).join("")}</div></div></div>`;
}

export const renderView = (project, state) =>
  ({ guitars: guitarsView, parts: partsView, display: displayView })[
    state.view
  ](project, state);
