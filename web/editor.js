import { selectChordTone, withSoundingIntervals } from "./chord-formula.js";
import {
  FAMILIES,
  mod12,
  describeFingering,
  moveVoice,
  soundingNotes,
  previewPitches,
  voicedChord,
} from "./music.js";
import { getFingering, setFingering } from "./project.js";
import { findVoicings } from "./voicings.js";
import { playNotes } from "./ui.js";
import { editorView } from "./editor-view.js";

const dialog = document.querySelector("#editor");
let session = null;
let requestVersion = 0;

function renderEditor() {
  if (!session) return;
  const focus = dialog.contains(document.activeElement)
    ? document.activeElement.dataset.focus
    : null;
  const scroll = dialog.scrollTop;
  dialog.innerHTML = editorView(session);
  if (focus)
    dialog
      .querySelector(`[data-focus="${focus}"]`)
      ?.focus({ preventScroll: true });
  dialog.scrollTop = scroll;
}

async function audition(midis) {
  const current = session;
  try {
    await playNotes(midis);
  } catch {
    if (session !== current) return;
    session.message = "Audio playback is unavailable in this browser.";
    renderEditor();
  }
}

function showGrip(index) {
  session.voicingIndex = index;
  session.frets = [...session.voicings[index].frets];
  session.active = null;
  const fretted = session.frets.filter((n) => n > 0);
  session.start =
    fretted.length && Math.max(...fretted) > 12
      ? Math.min(12, Math.max(0, Math.min(...fretted) - 2))
      : 0;
}

async function suggestGrip() {
  const current = session;
  const version = ++requestVersion;
  current.busy = true;
  current.message = "";
  current.active = null;
  current.frets = null;
  current.voicings = [];
  renderEditor();
  const bounds =
    current.position === "any"
      ? {}
      : {
          minFret: Number(current.position),
          maxFret:
            Number(current.position) === 0 ? 4 : Number(current.position) + 3,
        };
  try {
    const voicings = await findVoicings(current.tuning, current.chord, bounds);
    if (session !== current || version !== requestVersion) return;
    current.voicings = voicings;
    if (voicings.length) showGrip(0);
    else {
      current.frets = current.tuning.map(() => -1);
      current.mode = "draw";
      current.message =
        "No complete grip found in this hand position. Choose another position or place notes with Draw / remove.";
    }
  } catch (error) {
    if (session !== current || version !== requestVersion) return;
    current.message =
      error.message + " Use Draw / remove to place notes manually.";
    current.frets = current.tuning.map(() => -1);
    current.mode = "draw";
  } finally {
    if (session === current && version === requestVersion) {
      current.busy = false;
      renderEditor();
    }
  }
}

function regenerate() {
  audition(previewPitches(session.chord));
  suggestGrip();
}

// Explicit manual edits define the sounding chord. Automatic searches retain
// the requested harmony even when the engine leaves out an optional fifth.
function updateManualChord() {
  const actual = describeFingering(
    session.tuning,
    session.frets,
    session.chord.root,
  );
  if (actual.midis.length) {
    session.chord = withSoundingIntervals(session.chord, actual.intervals);
    session.chord.bass = actual.bass;
  }
  session.voicings = [];
  audition(actual.midis);
}

function changeFret(string, fret) {
  if (session.busy) return;
  const { tuning, frets, mode, active } = session;
  session.message = "";
  if (mode === "draw") {
    frets[string] = frets[string] === fret ? -1 : fret;
    session.active = null;
    updateManualChord();
  } else if (frets[string] === fret) {
    session.active = { string, fret, midi: tuning[string] + fret };
  } else if (active && mod12(active.midi) === mod12(tuning[string] + fret)) {
    session.frets = moveVoice(frets, active.string, string, fret);
    session.active = { string, fret, midi: tuning[string] + fret };
    session.chord.bass = describeFingering(
      tuning,
      session.frets,
      session.chord.root,
    ).bass;
    session.voicings = [];
    audition(soundingNotes(tuning, session.frets));
  } else {
    session.message = active
      ? "Choose a matching ring, or switch to Draw / remove."
      : "Select a sounding note first, or switch to Draw / remove.";
  }
  renderEditor();
}

function saveChord() {
  if (session.busy) return;
  const { chord, tuning, frets, onSave } = session;
  const actual = describeFingering(tuning, frets, chord.root);
  if (!actual.midis.length) return;
  // Keep Any inversion when chosen; manual octave/move operations set actual bass.
  chord.label = chord.label.trim();
  setFingering(chord, tuning, frets);
  onSave(chord);
  dialog.close();
}

function editGrip(action, target) {
  if (session.busy) return;
  session.active = null;
  if (action === "mode") session.mode = target.dataset.value;
  if (action === "clear") {
    session.frets = session.tuning.map(() => -1);
    session.voicings = [];
    session.mode = "draw";
  }
  if (action === "mute") {
    session.frets[Number(target.dataset.string)] = -1;
    updateManualChord();
  }
  if (action === "octave") {
    const string = Number(target.dataset.string);
    const next = session.frets[string] + Number(target.dataset.delta);
    if (session.frets[string] >= 0 && next >= 0 && next <= 24) {
      session.frets[string] = next;
      session.chord.bass = describeFingering(
        session.tuning,
        session.frets,
        session.chord.root,
      ).bass;
      session.voicings = [];
      audition(soundingNotes(session.tuning, session.frets));
    }
  }
  if (action === "alternative" && session.voicings.length) {
    showGrip(
      (session.voicingIndex +
        Number(target.dataset.direction) +
        session.voicings.length) %
        session.voicings.length,
    );
    audition(soundingNotes(session.tuning, session.frets));
  }
  renderEditor();
}

dialog.addEventListener("click", (event) => {
  if (!session) return;
  const target = event.target.closest("[data-action], [data-fret]");
  if (!target || target.disabled) return;
  try {
    if (target.dataset.fret !== undefined)
      return changeFret(
        Number(target.dataset.string),
        Number(target.dataset.fret),
      );
    const action = target.dataset.action;
    if (action === "close") return dialog.close();
    if (action === "save") return saveChord();
    if (action === "theme") {
      session.toggleTheme();
      renderEditor();
      return;
    }
    if (action === "suggest") return suggestGrip();
    if (action === "audition")
      return audition(
        session.frets?.some((n) => n >= 0)
          ? soundingNotes(session.tuning, session.frets)
          : previewPitches(session.chord),
      );
    if (action === "interval") {
      session.chord = selectChordTone(session.chord, target.dataset.tone);
      return regenerate();
    }
    if (["root", "family", "bass"].includes(action)) {
      if (action === "root") {
        const difference = Number(target.dataset.value) - session.chord.root;
        if (session.chord.bass >= 0)
          session.chord.bass = mod12(session.chord.bass + difference);
        session.chord.root = Number(target.dataset.value);
      }
      if (action === "family") {
        session.chord.intervals = [...FAMILIES[target.dataset.value].intervals];
        delete session.chord.formula;
        session.chord.bass = session.chord.root;
      }
      if (action === "bass") session.chord.bass = Number(target.dataset.value);
      return regenerate();
    }
    editGrip(action, target);
  } catch (error) {
    session.message = error.message;
    renderEditor();
  }
});

dialog.addEventListener("input", (event) => {
  if (session && event.target.dataset.editor === "label")
    session.chord.label = event.target.value;
});
dialog.addEventListener("change", (event) => {
  if (!session) return;
  const field = event.target.dataset.editor;
  const value = event.target.value;
  if (field === "start") {
    session.start = Number(value);
    renderEditor();
    return;
  }
  if (field === "label") return;
  if (field === "position") session.position = value;
  regenerate();
});
dialog.addEventListener("close", () => {
  session = null;
  requestVersion++;
});

export function openChordEditor(
  chord,
  tuning,
  onSave,
  { keyTones, partName, isNew, toggleTheme },
) {
  const frets = getFingering(chord, tuning);
  chord = voicedChord(
    chord,
    frets ? describeFingering(tuning, frets, chord.root) : null,
  );
  session = {
    chord: structuredClone(chord),
    tuning: [...tuning],
    frets,
    onSave,
    keyTones,
    partName,
    isNew,
    toggleTheme,
    mode: "move",
    active: null,
    start: 0,
    position: "any",
    busy: false,
    message: "",
    voicings: [],
    voicingIndex: 0,
  };
  const fretted = session.frets?.filter((f) => f > 0) ?? [];
  if (fretted.length && Math.max(...fretted) > 12)
    session.start = Math.min(12, Math.max(0, Math.min(...fretted) - 2));
  renderEditor();
  dialog.showModal();
  if (!session.frets) suggestGrip();
}
