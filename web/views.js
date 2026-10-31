import {
  NOTES,
  INTERVALS,
  SCALES,
  pitchName,
  tuningInterval,
  scaleNotes,
  scaleChords,
  chordName,
  chordQuality,
  chordInterval,
  describeFingering,
  voicedChord,
  partScale,
  mod12,
} from "./music.js";
import { PRESETS, presetsForCount } from "./tunings.js";
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
const scaleName = (part) => `${NOTES[part.root]} ${partScale(part).name}`;
const numberName = (chord, part) =>
  INTERVALS[mod12(chord.root - part.root)] + chordQuality(chord).suffix;

function partNavigation(part, index, selected) {
  const chords = selected
    ? `<ol class="part-children">${part.chords.map((c, i) => `<li><button data-action="edit-chord" data-id="${c.id}" data-part-id="${part.id}" aria-label="Open ${esc(chordName(c))} in ${esc(part.name)}"><span>${i + 1}</span>${esc(c.label || numberName(c, part))}<small>${esc(chordName(c))}</small></button></li>`).join("")}</ol>`
    : "";
  return `<div class="part-group"><button data-action="select-part" data-id="${part.id}" class="part-nav ${selected ? "active" : ""}" aria-expanded="${selected}"><span class="part-number">${String(index + 1).padStart(2, "0")}</span><span>${esc(part.name)}<small>${esc(scaleName(part))}</small></span><span class="part-count">${part.chords.length}</span></button>${chords}</div>`;
}

export function shell(project, state, content) {
  const part =
    project.parts.find((p) => p.id === state.partId) ?? project.parts[0];
  const navigation = [
    ["guitars", "tune", "Guitars"],
    ["parts", "grid", "Parts"],
    ["display", "display", "Play & Print"],
  ]
    .map(([view, symbol, label]) =>
      button(
        "view",
        label,
        symbol,
        `nav-item ${view === state.view ? "active" : ""}`,
        `data-view="${view}" ${view === state.view ? 'aria-current="page"' : ""}`,
      ),
    )
    .join("");
  return `<header class="topbar">
    <a href="./" class="brand" aria-label="Crest Chord Builder"><img src="./favicon.svg" alt="" width="30" height="30"><strong>Crest<span> / Chord Builder</span></strong></a>
    <div class="project-title"><input aria-label="Project title" data-field="project-title" value="${esc(project.title)}" maxlength="120"><span class="save-state ${state.storageError ? "error" : ""}">${state.storageError ? "Not saved locally" : "Saved locally"}</span></div>
    <div class="top-actions">${button("theme", state.theme === "light" ? "Dark theme" : "Light theme", "", "outlined", 'aria-label="Toggle light or dark theme"')}${button("undo", "", "undo", "icon-button", `aria-label="Undo last change" ${state.canUndo ? "" : "disabled"}`)}${button("import", "Open JSON", "upload", "quiet")}${button("export", "Save JSON", "download", "outlined")}</div>
  </header><div class="workspace"><aside class="sidebar"><nav aria-label="Workflow">${navigation}</nav>
    <div class="sidebar-section"><div class="sidebar-label">PARTS ${button("add-part", "", "plus", "icon-button", 'aria-label="Add Part"')}</div><nav aria-label="Parts">${project.parts.map((p, i) => partNavigation(p, i, p.id === part.id)).join("")}</nav>${button("add-part", "Add Part", "plus", "add-part")}</div>
    <div class="sidebar-foot">Data stays in this browser.<a href="https://github.com/crestenstclair/crest-chord-builder" target="_blank" rel="noreferrer">Documentation & source ↗</a></div>
  </aside><main id="main" tabindex="-1">${content}</main></div>`;
}

function guitarString(open, index, guitar, part) {
  const number = guitar.strings.length - index;
  const interval = index
    ? tuningInterval(guitar.strings[index - 1], open)
    : "Reference";
  return `<div class="string-editor" data-string-number="${number}"><div class="string-index">${number}<small>${number === 1 ? "treble" : index === 0 ? "bass" : "string"}</small></div>
    <label>Note<select data-field="string-note" data-index="${index}" aria-label="String ${number} note">${noteOptions(mod12(open))}</select></label>
    <label>Octave<select data-field="string-octave" data-index="${index}" aria-label="String ${number} octave">${options(
      Array.from({ length: 10 }, (_, i) => [i - 1, i - 1]),
      Math.floor(open / 12) - 1,
    )}</select></label>
    <div class="tuning-pitch">${esc(pitchName(open))}<small>${INTERVALS[mod12(open - part.root)]} relative to ${esc(NOTES[part.root])}</small></div>
    <div class="string-interval"><strong>${esc(interval)}</strong><small>${index ? `from string ${number + 1}` : "bass-side string"}</small></div></div>`;
}

export function guitarsView(project, state) {
  const guitar =
    project.guitars.find((g) => g.id === state.guitarId) ?? project.guitars[0];
  const part =
    project.parts.find((p) => p.id === state.partId) ?? project.parts[0];
  const count = guitar.strings.length;
  const preset =
    Object.entries(PRESETS).find(
      ([, p]) => p.strings.join() === guitar.strings.join(),
    )?.[0] ?? "";
  const counts = [6, 7, 8].includes(count)
    ? [6, 7, 8].map((n) => [n, n])
    : [[count, `${count} (imported)`], ...[6, 7, 8].map((n) => [n, n])];
  return `<div class="page-heading"><div><h1>Guitar configuration</h1><p>Select a string count and tuning preset, then adjust individual strings.</p></div>${button("new-guitar", "Add guitar", "plus", "primary", project.guitars.length >= 16 ? "disabled" : "")}</div>
    <div class="guitar-layout"><section class="panel tuning-panel"><div class="setup-controls">
    <label>Guitar<select data-field="active-guitar">${options(
      project.guitars.map((g) => [g.id, g.name]),
      guitar.id,
    )}</select></label><label>Guitar name<input data-field="guitar-name" value="${esc(guitar.name)}" maxlength="120"></label>
    <label>Strings<select data-field="string-count" aria-label="String count">${options(counts, count)}</select></label><label>Tuning preset<select data-field="preset"><option value="">Custom tuning</option>${options(
      presetsForCount(count).map(([key, p]) => [key, p.name]),
      preset,
    )}</select></label>
    </div><div class="string-list">${guitar.strings
      .map((n, i) => guitarString(n, i, guitar, part))
      .reverse()
      .join(
        "",
      )}</div><div class="panel-bottom">String 1 is the treble-side string. Tuning changes preserve saved fingerings.</div></section>
    <aside class="tuning-aside"><h2>Current tuning</h2><p>Treble to bass</p><div class="tuning-summary">${guitar.strings
      .map(
        (n, i) =>
          `<div><span>String ${count - i}</span><strong>${esc(pitchName(n))}</strong></div>`,
      )
      .reverse()
      .join("")}</div>
    <h3>Intervals</h3><p>The interval column measures from the string below, including octave distance. Scale intervals are relative to ${esc(NOTES[part.root])}, the selected part’s root.</p><a href="https://github.com/crestenstclair/crest-chord-builder/blob/main/docs/tunings.md" target="_blank" rel="noreferrer">Tuning preset sources ↗</a>${button("view", "Build parts", "right", "primary", 'data-view="parts"')}</aside></div>`;
}

function customScaleControls(part) {
  if (part.scale !== "custom") return "";
  return `<div class="custom-scale"><label>Custom scale name<input data-field="custom-scale-name" value="${esc(part.customScale.name)}" maxlength="120"></label><div class="scale-intervals" aria-label="Custom scale intervals">${INTERVALS.map((name, n) => button("scale-interval", name, "", "interval-toggle", `data-interval="${n}" aria-label="Scale interval ${name}" aria-pressed="${part.customScale.intervals.includes(n)}" ${n === 0 ? "disabled" : ""}`)).join("")}</div><p>Choose intervals relative to the scale root. Interval 1 is required.</p></div>`;
}

function triadPalette(part) {
  const chords = scaleChords(part.root, partScale(part), 3);
  const cells = chords
    .map(
      (chord, i) =>
        `<button class="harmony-chord" data-action="open-triad" data-degree="${i}" aria-label="Open ${esc(chord.name)} chord workshop"><strong>${esc(INTERVALS[mod12(chord.root - part.root)])} · ${esc(chordQuality(chord).name)}</strong><span>${esc(chord.name)}<span>${esc(chord.roman)}</span></span></button>`,
    )
    .join("");
  return `<div class="palette-heading"><h2>Triads in scale</h2><span>Select a chord to open the workshop.</span></div><div class="harmony-grid">${cells || "<p>No standard triads fit this interval set. Use Chord workshop to build a chord.</p>"}</div>`;
}

function chordCard(chord, index, part, guitar, state, display = false) {
  const frets = getFingering(chord, guitar.strings);
  const actual = frets?.some((f) => f >= 0)
    ? describeFingering(guitar.strings, frets, chord.root)
    : null;
  const definition = {
    ...voicedChord(chord, actual),
    bass: actual?.bass ?? chord.bass,
  };
  const name = chordName(definition);
  const label =
    chord.label ||
    (state.labels === "intervals" ? numberName(definition, part) : name);
  let diagram = chordBox(
    guitar.strings,
    frets,
    chord.root,
    name,
    display,
    state.labels,
    definition,
  );
  if (state.errors[chord.id] && !frets)
    diagram =
      '<div class="diagram-placeholder">Search unavailable. Open the workshop to place notes manually.</div>';
  if (frets && !actual)
    diagram =
      '<div class="diagram-placeholder">No automatic fingering found. Open the workshop to place notes manually.</div>';
  return `<article class="chord-card" data-chord="${chord.id}"><header><span class="chord-order">${String(index + 1).padStart(2, "0")}</span><div><h3><button data-action="edit-chord" data-id="${chord.id}" aria-label="Open ${esc(name)} workshop">${esc(label)}</button></h3><small>${esc(name)} · ${esc(chordQuality(definition).name)}</small><small class="card-formula">${definition.intervals.map((n) => chordInterval(definition, mod12(definition.root + n))).join(" · ")}</small></div>${button("play-chord", "", "play", "icon-button no-print", `data-id="${chord.id}" aria-label="Play ${esc(name)}" ${actual ? "" : "disabled"}`)}</header>${diagram}<div class="fret-values">${frets ? frets.map((f) => (f < 0 ? "×" : f)).join(" ") : "Calculating fingering…"}</div>
    <div class="chord-card-actions no-print">${button("cycle-voicing", "", "left", "icon-button", `data-id="${chord.id}" data-direction="-1" aria-label="Previous fingering for ${esc(name)}"`)}${button("edit-chord", "Edit", "edit", "quiet", `data-id="${chord.id}" aria-label="Edit ${esc(name)}"`)}${button("cycle-voicing", "", "right", "icon-button", `data-id="${chord.id}" data-direction="1" aria-label="Next fingering for ${esc(name)}"`)}</div>
    ${display ? "" : `<div class="reorder-actions">${button("move-chord", "←", "", "icon-button", `data-id="${chord.id}" data-direction="-1" aria-label="Move ${esc(name)} earlier" ${index === 0 ? "disabled" : ""}`)}${button("remove-chord", "", "trash", "icon-button", `data-id="${chord.id}" aria-label="Remove ${esc(name)}"`)}${button("move-chord", "→", "", "icon-button", `data-id="${chord.id}" data-direction="1" aria-label="Move ${esc(name)} later" ${index === part.chords.length - 1 ? "disabled" : ""}`)}</div>`}</article>`;
}

export function partsView(project, state) {
  const part =
    project.parts.find((p) => p.id === state.partId) ?? project.parts[0];
  const guitar = partGuitar(project, part);
  const notes = scaleNotes(part.root, partScale(part));
  return `<div class="page-heading"><div><h1>Parts</h1><p>Each part has a name, guitar, scale, and ordered chord progression.</p></div>${button("view", "Play & Print", "right", "outlined", 'data-view="display"')}</div>
    <section class="panel scale-panel"><div class="part-switcher"><label>Current part<select data-field="active-part">${options(
      project.parts.map((p) => [p.id, p.name]),
      part.id,
    )}</select></label>${button("add-part", "Add Part", "plus", "outlined")}</div>
    <div class="part-config"><label class="part-name">Part name<input data-field="part-name" value="${esc(part.name)}" maxlength="120"></label><label>Guitar<select data-field="part-guitar">${options(
      project.guitars.map((g) => [g.id, g.name]),
      part.guitarId,
    )}</select></label><div class="scale-select"><label>Root<select data-field="part-root" aria-label="Scale root">${noteOptions(part.root)}</select></label><label>Scale<select data-field="part-scale" aria-label="Scale">${options([...Object.entries(SCALES).map(([key, s]) => [key, s.name]), ["custom", "Custom scale"]], part.scale)}</select></label></div>${button("remove-part", "", "trash", "icon-button", `aria-label="Delete this part" ${project.parts.length <= 1 ? "disabled" : ""}`)}</div>
    ${customScaleControls(part)}<div class="scale-summary"><strong>${esc(scaleName(part))}</strong><div class="scale-tones">${notes.map((n) => `<span><b>${esc(n.interval)}</b><small>${esc(n.name)}</small></span>`).join("")}</div></div>${triadPalette(part)}</section>
    <section class="progression"><div class="section-heading"><div><h2>${esc(part.name)} — progression <span class="count-badge">${part.chords.length}</span></h2><p>Chord numbers are relative to the scale root. Diagram intervals are relative to each chord root.</p></div>${button("custom-chord", "Chord workshop", "plus", "primary")}</div>
    ${part.chords.length ? `<div class="chord-cards">${part.chords.map((c, i) => chordCard(c, i, part, guitar, state)).join("")}</div>` : `<div class="empty-progression"><h3>No chords in this part</h3><p>Select a triad, edit its intervals and fingering, then save it to ${esc(part.name)}.</p></div>`}</section>`;
}

export function displayView(project, state) {
  const part =
    project.parts.find((p) => p.id === state.partId) ?? project.parts[0];
  const guitar = partGuitar(project, part);
  const notes = scaleNotes(part.root, partScale(part));
  const spellings = [...NOTES];
  notes.forEach((n) => {
    spellings[n.pc] = n.name;
  });
  const pages = Math.max(1, Math.ceil(part.chords.length / 6));
  const page = Math.min(state.sheetPage, pages - 1);
  const visible = part.chords.slice(page * 6, page * 6 + 6);
  return `<div class="display-page"><div class="display-toolbar no-print"><label class="inline-label">Part<select data-field="display-part" aria-label="Part">${options(
    project.parts.map((p) => [p.id, p.name]),
    part.id,
  )}</select></label><div class="display-tools"><div class="segmented"><button data-action="labels" data-value="intervals" aria-pressed="${state.labels === "intervals"}">Intervals</button><button data-action="labels" data-value="notes" aria-pressed="${state.labels === "notes"}">Notes</button></div><label class="inline-label">Frets<select data-field="display-start">${options(
    [
      [0, "0–12"],
      [5, "5–17"],
      [12, "12–24"],
    ],
    state.start,
  )}</select></label><label class="inline-label size-control">Size<input type="range" min="90" max="150" step="10" value="${state.zoom}" data-field="zoom" aria-label="Display size"></label>${button("theme", state.theme === "light" ? "Dark theme" : "Light theme", "", "outlined")}${button("fullscreen", state.focus ? "Exit focus" : "Fullscreen", "expand", "outlined")}${button("print", "Print sheet", "print", "primary")}</div></div>
    <div class="sheet" style="--display-zoom:${state.zoom / 100}"><div class="sheet-heading"><div><div class="eyebrow">${esc(project.title)} / PART ${project.parts.indexOf(part) + 1}</div><h1>${esc(part.name)}</h1></div><div class="sheet-meta"><strong>${esc(scaleName(part))}</strong><span>${esc(guitar.name)} · ${guitar.strings.length} strings</span><small>Treble to bass: ${esc([...guitar.strings].reverse().map(pitchName).join(" · "))}</small></div></div>
    <section class="scale-map"><div class="map-heading"><h2>Scale fretboard</h2><div class="legend"><span><i class="root-key"></i>Root</span><span><i></i>Scale interval</span><span>Treble string at top</span></div></div>${fretboard(
      guitar.strings,
      notes.map((n) => n.pc),
      part.root,
      {
        start: state.start,
        labels: state.labels,
        spelling: spellings,
        intervalLabels: Object.fromEntries(
          notes.map((n) => [n.pc, n.interval]),
        ),
      },
    )}</section>
    <div class="sheet-chords-heading"><h2>Chord sheet</h2><span>Intervals relative to chord root · × muted · ○ open</span><div class="page-controls no-print">${button("sheet-page", "", "left", "icon-button", `data-direction="-1" aria-label="Previous chord page" ${page === 0 ? "disabled" : ""}`)}<span>${page + 1} / ${pages}</span>${button("sheet-page", "", "right", "icon-button", `data-direction="1" aria-label="Next chord page" ${page >= pages - 1 ? "disabled" : ""}`)}</div></div>
    <div class="chord-cards display-chords screen-only">${visible.map((c, i) => chordCard(c, page * 6 + i, part, guitar, state, true)).join("") || '<div class="empty-progression">This part has no chords. Add chords in Parts.</div>'}</div><div class="print-only chord-cards">${part.chords.map((c, i) => chordCard(c, i, part, guitar, state, true)).join("")}</div></div></div>`;
}

export const renderView = (project, state) =>
  ({ guitars: guitarsView, parts: partsView, display: displayView })[
    state.view
  ](project, state);
