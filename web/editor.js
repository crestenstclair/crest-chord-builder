import { selectChordTone, withSoundingIntervals } from "./chord-formula.js";
import {
  FAMILIES,
  NOTES,
  mod12,
  describeFingering,
  soundingNotes,
  previewPitches,
  voicedChord,
} from "./music.js";
import { getFingering, setFingering } from "./project.js";
import { findVoicings, groupVoicings } from "./voicings.js";
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

function clearSuggestions() {
  session.voicings = [];
  session.voicingGroups = [];
  session.voicingGroup = 0;
  session.voicingIndex = -1;
  session.voicingPage = 0;
}

function endVoicingSearch() {
  session.searchError = "";
  session.anchors = [];
  session.searchOpen = false;
  clearSuggestions();
}

function closeVoicingSearch() {
  // A close during a pending request must not let its result reopen the search.
  requestVersion++;
  session.busy = false;
  session.message = "";
  endVoicingSearch();
  session.chord.bass = session.frets
    ? describeFingering(session.tuning, session.frets, session.chord.root).bass
    : -1;
  audition([]);
  renderEditor();
  dialog.querySelector(`[data-focus="view-${session.view}"]`)?.focus({ preventScroll: true });
}

function showGrip(index) {
  session.voicingIndex = index;
  session.frets = [...session.voicings[index].frets];
  session.chord.bass = describeFingering(
    session.tuning,
    session.frets,
    session.chord.root,
  ).bass;
  session.voicingGroup = session.voicingGroups.findIndex((group) => group.indices.includes(index));
  const groupIndex = session.voicingGroups[session.voicingGroup].indices.indexOf(index);
  session.voicingPage = Math.floor(groupIndex / VOICINGS_PER_PAGE);
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
  current.searchError = "";
  // Background suggestions must never erase the notes the player just placed.
  current.selectionFrets = current.frets?.slice() ?? current.tuning.map(() => -1);
  clearSuggestions();
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
      { ...bounds, anchors: current.anchors },
    );
    if (session !== current || version !== requestVersion) return;
    current.voicings = voicings;
    current.voicingGroups = groupVoicings(current.tuning, current.chord.root, voicings);
    if (voicings.length && choose) {
      showGrip(0);
      if (preview) audition(soundingNotes(current.tuning, current.frets));
    } else if (!voicings.length) {
      current.frets ??= current.tuning.map(() => -1);
      current.message =
        current.anchors.length
          ? "No nearby voicing matches these filters. Your selected notes are ready to save."
          : "No complete grip found in this hand position. Keep editing notes or change the filters.";
    }
  } catch (error) {
    if (session !== current || version !== requestVersion) return;
    current.searchError = error.message;
    current.message =
      error.message + (current.anchors.length
        ? " Your selected notes are kept."
        : " You can still add or remove notes on the fretboard.");
    current.frets ??= current.tuning.map(() => -1);
  } finally {
    if (session === current && version === requestVersion) {
      current.busy = false;
      renderEditor();
    }
  }
}

function setSelectedGrip() {
  session.frets = [...session.selectionFrets];
  const actual = describeFingering(session.tuning, session.frets, session.chord.root);
  session.chord.bass = actual.bass;
}

function regenerate() {
  audition([]);
  // Keep compatible notes visible while the engine places the edited formula.
  session.frets = (session.frets ?? session.tuning.map(() => -1)).map((fret, string) =>
    fret >= 0 && session.chord.intervals.includes(mod12(session.tuning[string] + fret - session.chord.root))
      ? fret : -1,
  );
  session.anchors = session.anchors.filter(({ string, fret }) => session.frets[string] === fret);
  if (!session.chord.intervals.length) {
    requestVersion++;
    session.busy = false;
    session.chord.bass = -1;
    session.message = "";
    endVoicingSearch();
    renderEditor();
    return;
  }
  return suggestGrip({ preview: true });
}

// Every direct fingering edit has the same meaning: the sounding notes define
// the chord. A search may suggest alternatives but cannot replace this edit.
function updateFingering() {
  requestVersion++;
  session.busy = false;
  session.message = "";
  session.searchError = "";
  const actual = describeFingering(session.tuning, session.frets, session.chord.root);
  session.chord = { ...withSoundingIntervals(session.chord, actual.intervals), bass: actual.bass };
  session.bassFilter = -1;
  session.anchors = session.anchors.filter(({ string, fret }) => session.frets[string] === fret);
  clearSuggestions();
  audition(actual.midis);
  if (!actual.midis.length) {
    endVoicingSearch();
    renderEditor();
    return;
  }
  session.searchOpen = true;
  suggestGrip({ choose: false });
}

function changeFret(string, fret) {
  session.frets ??= session.tuning.map(() => -1);
  session.frets[string] = session.frets[string] === fret ? -1 : fret;
  session.anchors = session.anchors.filter((position) => position.string !== string);
  if (session.frets[string] >= 0) session.anchors.push({ string, fret });
  session.anchors.sort((a, b) => a.string - b.string);
  updateFingering();
}

function saveChord() {
  const { chord, tuning, frets, onSave } = session;
  if (!frets) return;
  const actual = describeFingering(tuning, frets, chord.root);
  if (!actual.midis.length) return;
  requestVersion++; // A background search cannot replace a saved selection.
  chord.bass = actual.bass;
  chord.label = chord.label.trim();
  setFingering(chord, tuning, frets);
  onSave(chord);
  dialog.close();
}

function editVoicingResults(action, target) {
  if (action === "choose-voicing") {
    const index = Number(target.dataset.index);
    if (session.voicingIndex === index) {
      session.voicingIndex = -1;
      setSelectedGrip();
      audition(soundingNotes(session.tuning, session.frets));
    } else {
      showGrip(index);
      audition(soundingNotes(session.tuning, session.frets));
    }
  }
  if (action === "voicing-group") {
    session.voicingGroup = Number(target.dataset.index);
    session.voicingPage = 0;
  }
  const indices = session.voicingGroups[session.voicingGroup]?.indices ?? [];
  if (action === "voicing-page") {
    const last = Math.ceil(indices.length / VOICINGS_PER_PAGE) - 1;
    session.voicingPage = Math.max(0, Math.min(last,
      session.voicingPage + Number(target.dataset.direction),
    ));
  }
  if (action === "alternative" && session.voicings.length) {
    const choices = session.anchors.length ? indices : session.voicings.map((_, index) => index);
    const direction = Number(target.dataset.direction);
    const selected = choices.indexOf(session.voicingIndex);
    const index = selected < 0 ? (direction > 0 ? -1 : 0) : selected;
    showGrip(choices[(index + direction + choices.length) % choices.length]);
    audition(soundingNotes(session.tuning, session.frets));
  }
}

function editGrip(action, target) {
  if (action === "view") {
    session.view = target.dataset.value;
    renderEditor();
    return;
  }
  if (action === "clear") {
    session.frets = session.tuning.map(() => -1);
    updateFingering();
    return;
  }
  if (action === "mute") {
    session.frets[Number(target.dataset.string)] = -1;
    updateFingering();
    return;
  }
  if (action === "octave") {
    const string = Number(target.dataset.string);
    const next = session.frets[string] + Number(target.dataset.delta);
    if (session.frets[string] >= 0 && next >= 0 && next <= 24) {
      session.frets[string] = next;
      updateFingering();
    }
    return;
  }
  if (session.busy) return;
  editVoicingResults(action, target);
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
    if (action === "close-search") return closeVoicingSearch();
    if (action === "retry-search") return suggestGrip({ choose: false });
    if (action === "remove-anchor")
      return changeFret(Number(target.dataset.string), Number(target.dataset.position));
    if (action === "save") return saveChord();
    if (action === "theme") {
      session.toggleTheme();
      renderEditor();
      return;
    }
    if (action === "suggest") {
      session.searchOpen = true;
      return regenerate();
    }
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

dialog.addEventListener("keydown", (event) => {
  if (!session || !event.target.matches('[role="tab"]')) return;
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  session.view = event.key === "Home" ? "fretboard" : event.key === "End" ? "scale"
    : session.view === "fretboard" ? "scale" : "fretboard";
  renderEditor();
  dialog.querySelector(`[data-focus="view-${session.view}"]`).focus();
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
  { keyNotes, scaleName, partName, isNew, toggleTheme },
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
    keyTones: keyNotes.map((note) => note.pc),
    spelling: Object.assign([...NOTES], Object.fromEntries(keyNotes.map((note) => [note.pc, note.name]))),
    scaleName,
    partName,
    isNew,
    toggleTheme,
    view: "fretboard",
    searchOpen: false,
    selectionFrets: frets?.slice() ?? tuning.map(() => -1),
    anchors: [],
    voicingGroups: [],
    voicingGroup: 0,
    voicingPage: 0,
    bassFilter: -1,
    start: 0,
    position: "any",
    busy: false,
    message: "",
    searchError: "",
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
