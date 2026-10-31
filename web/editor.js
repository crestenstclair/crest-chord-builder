import { selectChordTone, withSoundingIntervals } from "./chord-formula.js";
import {
  FAMILIES,
  mod12,
  describeFingering,
  soundingNotes,
  previewPitches,
  voicedChord,
} from "./music.js";
import { getFingering, setFingering } from "./project.js";
import { findVoicings } from "./voicings.js";
import { playNotes } from "./ui.js";
import { editorView, VOICINGS_PER_PAGE } from "./editor-view.js";

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
  session.chord.bass = describeFingering(
    session.tuning,
    session.frets,
    session.chord.root,
  ).bass;
  session.voicingPage = Math.floor(index / VOICINGS_PER_PAGE);
  const fretted = session.frets.filter((n) => n > 0);
  session.start =
    fretted.length && Math.max(...fretted) > 12
      ? Math.min(12, Math.max(0, Math.min(...fretted) - 2))
      : 0;
}

async function suggestGrip({ preview = false, choose = true } = {}) {
  const current = session;
  const version = ++requestVersion;
  current.busy = true;
  current.message = "";
  current.frets = null;
  current.voicings = [];
  current.voicingIndex = -1;
  current.voicingPage = 0;
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
    const voicings = await findVoicings(
      current.tuning,
      { ...current.chord, bass: current.bassFilter },
      { ...bounds, anchor: current.anchor },
    );
    if (session !== current || version !== requestVersion) return;
    current.voicings = voicings;
    if (voicings.length && choose) {
      showGrip(0);
      if (preview) audition(soundingNotes(current.tuning, current.frets));
    } else if (!voicings.length) {
      current.frets = current.tuning.map(() => -1);
      current.message =
        current.anchor
          ? "No nearby voicing contains this note with the current filters. Choose another note, change a filter, or use Draw / remove."
          : "No complete grip found in this hand position. Choose another position or use Draw / remove.";
    }
  } catch (error) {
    if (session !== current || version !== requestVersion) return;
    current.message =
      error.message + " Use Draw / remove to place notes manually.";
    current.frets = current.tuning.map(() => -1);
  } finally {
    if (session === current && version === requestVersion) {
      current.busy = false;
      renderEditor();
    }
  }
}

function regenerate() {
  // Unlock audio in the click handler and stop the previous audition. Play
  // only the returned grip once the latest search has completed.
  audition([]);
  if (
    session.anchor &&
    !session.chord.intervals.includes(
      mod12(session.tuning[session.anchor.string] + session.anchor.fret - session.chord.root),
    )
  ) {
    session.anchor = null;
    session.showHarmony = true;
  }
  return suggestGrip({ preview: true });
}

// Manual drawing changes harmony; choosing a suggested grip preserves it.
function updateManualGrip() {
  const actual = describeFingering(
    session.tuning,
    session.frets,
    session.chord.root,
  );
  if (actual.midis.length) {
    if (session.mode === "draw")
      session.chord = withSoundingIntervals(session.chord, actual.intervals);
    session.chord.bass = actual.bass;
  } else {
    session.chord.bass = -1;
  }
  session.anchor = null;
  session.showHarmony = true;
  session.bassFilter = -1;
  session.voicings = [];
  audition(actual.midis);
}

function changeFret(string, fret) {
  if (session.busy && session.mode === "draw") return;
  const { tuning, chord, mode } = session;
  session.message = "";
  if (mode === "select") {
    const interval = mod12(tuning[string] + fret - chord.root);
    if (!chord.intervals.includes(interval)) return;
    session.anchor = { string, fret };
    session.showHarmony = false;
    session.chord.bass = -1;
    audition([tuning[string] + fret]);
    return suggestGrip({ choose: false });
  }
  session.frets[string] = session.frets[string] === fret ? -1 : fret;
  updateManualGrip();
  renderEditor();
}

function saveChord() {
  if (session.busy) return;
  const { chord, tuning, frets, onSave } = session;
  const actual = describeFingering(tuning, frets, chord.root);
  if (!actual.midis.length) return;
  chord.bass = actual.bass;
  chord.label = chord.label.trim();
  setFingering(chord, tuning, frets);
  onSave(chord);
  dialog.close();
}

function editGrip(action, target) {
  if (session.busy) return;
  if (action === "mode" && session.mode !== target.dataset.value) {
    session.mode = target.dataset.value;
    session.anchor = null;
    session.showHarmony = true;
    session.voicings = [];
    session.frets ??= session.tuning.map(() => -1);
  }
  if (action === "harmony") session.showHarmony = !session.showHarmony;
  if (action === "choose-voicing") {
    showGrip(Number(target.dataset.index));
    audition(soundingNotes(session.tuning, session.frets));
  }
  if (action === "voicing-page") {
    const last = Math.ceil(session.voicings.length / VOICINGS_PER_PAGE) - 1;
    session.voicingPage = Math.max(0, Math.min(last,
      session.voicingPage + Number(target.dataset.direction),
    ));
  }
  if (action === "clear") {
    session.frets = session.tuning.map(() => -1);
    session.chord.bass = -1;
    session.bassFilter = -1;
    session.voicings = [];
    session.anchor = null;
    session.showHarmony = true;
    audition([]);
  }
  if (action === "mute") {
    session.frets[Number(target.dataset.string)] = -1;
    updateManualGrip();
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
      session.bassFilter = -1;
      session.anchor = null;
      session.showHarmony = true;
      audition(soundingNotes(session.tuning, session.frets));
    }
  }
  if (action === "alternative" && session.voicings.length) {
    const direction = Number(target.dataset.direction);
    const index = session.voicingIndex < 0
      ? (direction > 0 ? -1 : 0)
      : session.voicingIndex;
    showGrip(
      (index + direction + session.voicings.length) % session.voicings.length,
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
    if (action === "suggest") return regenerate();
    if (action === "audition")
      return audition(
        session.frets?.some((n) => n >= 0)
          ? soundingNotes(session.tuning, session.frets)
          : previewPitches({ ...session.chord, bass: session.bassFilter }),
      );
    if (action === "interval") {
      session.chord = selectChordTone(session.chord, target.dataset.tone);
      if (
        session.bassFilter >= 0 &&
        !session.chord.intervals.includes(
          mod12(session.bassFilter - session.chord.root),
        )
      )
        session.bassFilter = -1;
      return regenerate();
    }
    if (["root", "family", "bass"].includes(action)) {
      if (action === "root") {
        const difference = Number(target.dataset.value) - session.chord.root;
        if (session.chord.bass >= 0)
          session.chord.bass = mod12(session.chord.bass + difference);
        if (session.bassFilter >= 0)
          session.bassFilter = mod12(session.bassFilter + difference);
        session.chord.root = Number(target.dataset.value);
      }
      if (action === "family") {
        session.chord.intervals = [...FAMILIES[target.dataset.value].intervals];
        delete session.chord.formula;
        session.chord.bass = session.chord.root;
        session.bassFilter = -1;
      }
      if (action === "bass") session.bassFilter = Number(target.dataset.value);
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
    mode: "select",
    anchor: null,
    showHarmony: true,
    voicingPage: 0,
    bassFilter: -1,
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
