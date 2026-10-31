import {
  NOTES,
  FAMILIES,
  pitchName,
  mod12,
  toneSet,
  chordName,
  chordQuality,
  chordInterval,
  intervalControls,
  describeFingering,
} from "./music.js";
import { esc, options, button } from "./ui.js";
import { fretboard, chordBox } from "./diagrams.js";

function voiceRow(open, string, session) {
  const fret = session.frets?.[string] ?? -1;
  const midi = fret >= 0 ? open + fret : null;
  const number = session.tuning.length - string;
  return `<div class="voice-row"><span class="voice-string">${number}<small>${esc(pitchName(open))}</small></span><strong>${midi === null ? "×" : chordInterval(session.chord, mod12(midi))}<small>${midi === null ? "Muted" : `${esc(pitchName(midi))} · fret ${fret}`}</small></strong><div>${button("octave", "−8ve", "", "octave-button", `data-string="${string}" data-delta="-12" ${session.busy || fret < 12 ? "disabled" : ""} aria-label="String ${number} down one octave"`)}${button("octave", "+8ve", "", "octave-button", `data-string="${string}" data-delta="12" ${session.busy || fret < 0 || fret > 12 ? "disabled" : ""} aria-label="String ${number} up one octave"`)}${button("mute", "×", "", "icon-button", `data-string="${string}" aria-label="Mute string ${number}" ${session.busy || fret < 0 ? "disabled" : ""}`)}</div></div>`;
}

function intervalRow(session) {
  const entries = intervalControls(session.family, session.seventh);
  for (const n of session.chord.intervals) {
    if (!entries.some(([value]) => value === n))
      entries.push([
        n,
        chordInterval(session.chord, mod12(session.chord.root + n)),
      ]);
  }
  return `<div class="interval-section"><div><strong>Chord intervals</strong><span>Toggle an interval to preview and regenerate the fingering.</span></div><div class="chord-intervals">${entries.map(([n, label]) => button("interval", label, "", "interval-toggle", `data-interval="${n}" data-focus="interval-${n}" aria-label="Chord interval ${label}" aria-pressed="${session.chord.intervals.includes(n)}"`)).join("")}</div></div>`;
}

function chordControls(session) {
  const { chord } = session;
  const bassOptions = [
    [-1, "Any inversion"],
    ...chord.intervals.map((n) => [
      mod12(chord.root + n),
      `${chordInterval(chord, mod12(chord.root + n))} in bass${n === 0 ? " (root position)" : ""}`,
    ]),
  ];
  return `<div class="editor-controls"><label>Root<select data-editor="root" data-focus="root">${options(
    NOTES.map((n, i) => [i, n]),
    chord.root,
  )}</select></label><label>Quality<select data-editor="family" data-focus="family">${options(
    Object.entries(FAMILIES).map(([key, f]) => [key, f.name]),
    session.family,
  )}</select></label><label class="chord-label-input">Label (optional)<input data-editor="label" data-focus="label" value="${esc(chord.label)}" maxlength="120" placeholder="Chord label"></label><label>Chord menu<select data-editor="extension" data-focus="extension"><option value="">Choose an operation</option><option value="7">Add 7th</option><option value="dominant7">Use minor 7th (dominant / minor)</option><option value="major7">Use major 7th</option><option value="9">Add 9th</option><option value="13">Add 13th</option><option value="inversion">Set inversion…</option></select></label><label>Inversion<select data-editor="bass" data-focus="bass">${options(bassOptions, chord.bass)}</select></label></div>${intervalRow(session)}`;
}

function neckControls(session) {
  return `<div class="neck-toolbar"><div class="segmented"><button data-action="mode" data-value="move" aria-pressed="${session.mode === "move"}">Move notes</button><button data-action="mode" data-value="draw" aria-pressed="${session.mode === "draw"}">Draw / remove</button></div><label class="inline-label">Hand position<select data-editor="position" data-focus="position">${options(
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
  )}</select></label><label class="inline-label">Fret window<select data-editor="start" data-focus="start">${options(
    Array.from({ length: 13 }, (_, i) => [i, `${i}–${i + 12}`]),
    session.start,
  )}</select></label>${button("clear", "Clear grip", "", "quiet", session.busy ? "disabled" : "")}</div>`;
}

export function editorView(session) {
  const { chord, tuning, frets, active, busy } = session;
  const actual = frets ? describeFingering(tuning, frets, chord.root) : null;
  const name = chordName(
    chord,
    actual?.midis.length ? actual.bass : chord.bass,
  );
  const hint = active
    ? `Interval ${chordInterval(chord, mod12(active.midi))}: solid ring = same pitch; dotted ring = another octave. Mute an occupied destination before moving.`
    : session.mode === "draw"
      ? "Click a fret to place a note; click again to mute it. Manual changes update the chord intervals and name."
      : "Select a sounding note, then select a matching ring to move it. Use Draw / remove to place any interval.";
  return `<div class="editor-header"><div><div class="eyebrow">CHORD WORKSHOP · ${esc(session.partName)}</div><h2 id="editor-title">${esc(name)}</h2><p>${esc(chordQuality(chord).name)} · ${chord.intervals.map((n) => chordInterval(chord, mod12(chord.root + n))).join(" · ")}</p></div><div>${button("theme", document.documentElement.dataset.theme === "light" ? "Dark theme" : "Light theme", "", "outlined")}${button("close", "", "close", "icon-button", 'aria-label="Close chord editor"')}</div></div>
    ${chordControls(session)}<div class="editor-neck">${neckControls(session)}<div class="legend workshop-legend"><span><i class="root-key"></i>Root</span><span><i></i>Chord tone</span><span><i class="scale-key"></i>In scale</span><span><i class="outside-key"></i>Outside scale (dashed)</span><span>Selected notes have an outer ring</span></div>${fretboard(tuning, toneSet(chord), chord.root, { start: session.start, frets, active, editing: !busy, labels: "intervals", keyTones: session.keyTones, chord })}<p class="editor-hint">${esc(hint)}</p></div>
    <div class="editor-bottom"><div class="editor-preview">${chordBox(tuning, frets, chord.root, name, false, "intervals", chord)}<strong>${esc(name)}</strong><span>${actual?.midis.length ? `Sounding intervals: ${actual.intervals.map((n) => chordInterval(chord, mod12(chord.root + n))).join(" · ")}` : "No sounding notes"}</span><div>${button("audition", "Preview", "play", "outlined")}${button("suggest", "Find a grip", "", "outlined", busy ? "disabled" : "")}</div><div class="grip-controls">${button("alternative", "", "left", "icon-button", `data-direction="-1" aria-label="Previous grip" ${busy || session.voicings.length < 2 ? "disabled" : ""}`)}<span>${session.voicings.length ? `${session.voicingIndex + 1} / ${session.voicings.length}` : "Manual grip"}</span>${button("alternative", "", "right", "icon-button", `data-direction="1" aria-label="Next grip" ${busy || session.voicings.length < 2 ? "disabled" : ""}`)}</div></div><div class="voice-list"><div class="eyebrow">STRINGS · TREBLE TO BASS</div>${tuning
      .map((open, string) => voiceRow(open, string, session))
      .reverse()
      .join("")}</div></div>
    <div class="editor-status" role="status">${esc(session.message || (busy ? "Finding fingerings…" : "Automatic fingerings use a four-fret span; open strings remain available. Extended chords may omit the fifth."))}</div><footer class="editor-footer"><span>Changes apply when saved.</span><div>${button("close", "Cancel", "", "quiet")}${button("save", session.isNew ? "Add to part" : "Save chord", "plus", "primary", busy || !actual?.midis.length ? "disabled" : "")}</div></footer>`;
}
