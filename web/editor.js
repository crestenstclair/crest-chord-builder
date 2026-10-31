import {
  NOTES,
  QUALITIES,
  INTERVALS,
  pitchName,
  mod12,
  toneSet,
  describeFingering,
  moveVoice,
  soundingNotes,
} from "./music.js";
import { getFingering, setFingering } from "./project.js";
import { findVoicings } from "./voicings.js";
import { esc, options, button, playNotes } from "./ui.js";
import { fretboard, chordBox } from "./diagrams.js";

const dialog = document.querySelector("#editor");
let session = null;
let requestVersion = 0;

function voiceRow(open, string, current) {
  const fret = current.frets?.[string] ?? -1;
  const midi = fret >= 0 ? open + fret : null;
  return `<div class="voice-row"><span class="voice-string">${string + 1}<small>${esc(pitchName(open))}</small></span><strong>${midi === null ? "Muted" : esc(pitchName(midi))}<small>${midi === null ? "×" : INTERVALS[mod12(midi - current.chord.root)]}</small></strong><div>${button("octave", "−8ve", "", "octave-button", `data-string="${string}" data-delta="-12" ${fret < 12 ? "disabled" : ""} aria-label="String ${string + 1} down one octave"`)}${button("octave", "+8ve", "", "octave-button", `data-string="${string}" data-delta="12" ${fret < 0 || fret > 12 ? "disabled" : ""} aria-label="String ${string + 1} up one octave"`)}${button("mute", "×", "", "icon-button", `data-string="${string}" aria-label="Mute string ${string + 1}" ${fret < 0 ? "disabled" : ""}`)}</div></div>`;
}

function renderEditor() {
  if (!session) return;
  const { chord, tuning, frets, active, mode, start, busy, message } = session;
  const described = frets ? describeFingering(tuning, frets, chord.root) : null;
  const name = described?.name ?? "Finding your voicing…";
  const quality =
    Object.entries(QUALITIES).find(
      ([, q]) => q.intervals.join() === chord.intervals.join(),
    )?.[0] ?? "";
  const focus = dialog.contains(document.activeElement)
    ? document.activeElement.dataset.focus
    : null;
  dialog.innerHTML = `<div class="editor-header"><div><div class="eyebrow">CHORD WORKSHOP</div><h2 id="editor-title">${esc(name)}</h2><p>Keep the harmony. Find the grip.</p></div>${button("close", "", "close", "icon-button", 'aria-label="Close chord editor"')}</div><div class="editor-controls"><label>Root<select data-editor="root" data-focus="root">${options(
    NOTES.map((n, i) => [i, n]),
    chord.root,
  )}</select></label><label>Chord<select data-editor="quality" data-focus="quality"><option value="" disabled>Custom notes</option>${options(
    Object.entries(QUALITIES).map(([key, q]) => [key, q.name]),
    quality,
  )}</select></label><label class="chord-label-input">Label (optional)<input data-editor="label" data-focus="label" value="${esc(chord.label)}" maxlength="120" placeholder="e.g. Chorus voicing"></label>${button("audition", "Listen", "play", "outlined", busy || !described?.midis.length ? "disabled" : "")}${button("suggest", "Find a grip", "", "outlined", busy ? "disabled" : "")}</div><div class="editor-neck"><div class="neck-toolbar"><div class="segmented"><button data-action="mode" data-value="move" aria-pressed="${mode === "move"}">Move notes</button><button data-action="mode" data-value="draw" aria-pressed="${mode === "draw"}">Draw / remove</button></div><label class="inline-label">Fret window<select data-editor="start" data-focus="start">${options(
    Array.from({ length: 13 }, (_, i) => [i, `${i}–${i + 12}`]),
    start,
  )}</select></label>${button("clear", "Clear grip", "", "quiet")}</div>${fretboard(tuning, toneSet(chord), chord.root, { start, frets, active, editing: !busy })}<div class="editor-hint">${active ? `<span class="selected-note">${esc(pitchName(active.midi))}</span> Solid ring: same pitch. Dotted ring: another octave. Click a ring on an empty string to move; mute occupied destinations first.` : mode === "draw" ? "Click any fret to add or replace a note. Click it again to mute. The chord name follows your notes." : "Click a selected note, then a matching ring to move it. Switch to Draw / remove to add notes."}</div></div><div class="editor-bottom"><div class="editor-preview">${chordBox(tuning, frets, described?.root ?? chord.root, name)}<strong>${esc(name)}</strong><span>${frets ? frets.map((f) => (f < 0 ? "×" : f)).join(" · ") : "Searching…"}</span></div><div class="voice-list"><div class="eyebrow">VOICE BY VOICE <span>OCTAVE SHIFTS STAY ON THE SAME STRING</span></div>${tuning.map((open, string) => voiceRow(open, string, session)).join("")}</div></div><div class="editor-status" role="status">${esc(message || (busy ? "Searching your tuning…" : "One sounding note per string. Root notes are green."))}</div><footer class="editor-footer"><span>Edits apply when you save.</span><div>${button("close", "Cancel", "", "quiet")}${button("save", "Save chord", "plus", "primary", busy || !described?.midis.length ? "disabled" : "")}</div></footer>`;
  if (focus) dialog.querySelector(`[data-focus="${focus}"]`)?.focus();
}

async function suggestGrip() {
  const current = session;
  const version = ++requestVersion;
  current.busy = true;
  current.message = "";
  renderEditor();
  try {
    const voicings = await findVoicings(current.tuning, current.chord);
    if (session !== current || version !== requestVersion) return;
    current.frets = voicings.length
      ? [...voicings[0].frets]
      : current.tuning.map(() => -1);
    current.message = voicings.length
      ? ""
      : "No complete grip found within a four-fret span. Use Draw / remove to craft one.";
    if (!voicings.length) current.mode = "draw";
  } catch (error) {
    if (session !== current || version !== requestVersion) return;
    current.message = error.message;
    current.frets ??= current.tuning.map(() => -1);
  } finally {
    if (session === current && version === requestVersion) {
      current.busy = false;
      current.active = null;
      renderEditor();
    }
  }
}

function changeFret(string, fret) {
  if (session.busy) return;
  const { tuning, frets, mode, active } = session;
  session.message = "";
  if (mode === "draw") {
    frets[string] = frets[string] === fret ? -1 : fret;
    session.active = null;
  } else if (frets[string] === fret) {
    session.active = { string, fret, midi: tuning[string] + fret };
  } else if (active && mod12(active.midi) === mod12(tuning[string] + fret)) {
    try {
      session.frets = moveVoice(frets, active.string, string, fret);
      session.active = { string, fret, midi: tuning[string] + fret };
    } catch (error) {
      session.message = error.message;
    }
  } else {
    session.message = active
      ? "Choose a matching ring to keep the note, or switch to Draw / remove."
      : "Select a sounding note first, or switch to Draw / remove to add one.";
  }
  renderEditor();
}

function saveChord() {
  if (session.busy) return;
  const { chord, tuning, frets, onSave } = session;
  const actual = describeFingering(tuning, frets, chord.root);
  if (!actual.midis.length) return;
  chord.root = actual.root;
  chord.intervals = actual.intervals;
  chord.bass = actual.bass === actual.root ? -1 : actual.bass;
  chord.label = chord.label.trim();
  setFingering(chord, tuning, frets);
  onSave(chord);
  dialog.close();
}

dialog.addEventListener("click", async (event) => {
  if (!session) return;
  const fret = event.target.closest("[data-fret]");
  if (fret) {
    changeFret(Number(fret.dataset.string), Number(fret.dataset.fret));
    return;
  }
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (action === "close") {
    dialog.close();
    return;
  }
  if (action === "save") {
    saveChord();
    return;
  }
  if (action === "suggest") {
    await suggestGrip();
    return;
  }
  if (action === "audition") {
    try {
      await playNotes(soundingNotes(session.tuning, session.frets));
    } catch {
      session.message = "Audio playback is unavailable in this browser.";
      renderEditor();
    }
    return;
  }
  if (session.busy) return;
  if (action === "mode") {
    session.mode = target.dataset.value;
    session.active = null;
  }
  if (action === "clear") {
    session.frets = session.tuning.map(() => -1);
    session.mode = "draw";
    session.active = null;
  }
  if (action === "mute") {
    session.frets[Number(target.dataset.string)] = -1;
    session.active = null;
  }
  if (action === "octave") {
    const string = Number(target.dataset.string);
    const next = session.frets[string] + Number(target.dataset.delta);
    if (next >= 0 && next <= 24) session.frets[string] = next;
    session.active = null;
  }
  renderEditor();
});

dialog.addEventListener("input", (event) => {
  if (session && event.target.dataset.editor === "label")
    session.chord.label = event.target.value;
});
dialog.addEventListener("change", async (event) => {
  if (!session) return;
  const { editor } = event.target.dataset;
  if (editor === "start") {
    session.start = Number(event.target.value);
    renderEditor();
    return;
  }
  if (editor === "root") session.chord.root = Number(event.target.value);
  if (editor === "quality")
    session.chord.intervals = [...QUALITIES[event.target.value].intervals];
  if (editor === "root" || editor === "quality") {
    session.chord.bass = -1;
    await suggestGrip();
  }
});
dialog.addEventListener("close", () => {
  session = null;
  requestVersion++;
});

export function openChordEditor(chord, tuning, onSave) {
  session = {
    chord: structuredClone(chord),
    tuning: [...tuning],
    frets: getFingering(chord, tuning),
    onSave,
    mode: "move",
    active: null,
    start: 0,
    busy: false,
    message: "",
  };
  if (session.frets) {
    const first = session.frets.filter((f) => f > 0);
    if (first.length && Math.min(...first) > 8)
      session.start = Math.min(12, Math.min(...first) - 1);
  }
  renderEditor();
  dialog.showModal();
  if (!session.frets) suggestGrip();
}
