import {
  PRESETS,
  scaleChords,
  soundingNotes,
  partScale,
  scaleNotes,
} from "./music.js";
import {
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  MAX_FILE_BYTES,
  id,
  createProject,
  makePart,
  makeChord,
  parseProject,
  getFingering,
  setFingering,
} from "./project.js";
import { shell, renderView } from "./views.js";
import { downloadJSON, playNotes } from "./ui.js";
import { findVoicings } from "./voicings.js";
import { openChordEditor } from "./editor.js";
import { resizeTuning } from "./tunings.js";
import { readPreferences, savePreferences } from "./preferences.js";

const app = document.querySelector("#app");
const history = [];
const generating = new Set();
const failed = new Set();
let project = createProject();
let startupError = "";
try {
  const saved =
    localStorage.getItem(STORAGE_KEY) ??
    localStorage.getItem(LEGACY_STORAGE_KEY);
  if (saved) project = parseProject(saved);
} catch (error) {
  startupError = `Saved project could not be loaded: ${error.message} Original browser data has been left untouched.`;
}
const state = {
  view: "parts",
  partId: project.parts[0].id,
  guitarId: project.guitars[0].id,
  sheetPage: 0,
  start: 0,
  zoom: 100,
  ...readPreferences(),
  focus: false,
  storageError: Boolean(startupError),
  canUndo: false,
  lastChordId: null,
  errors: Object.create(null),
};
savePreferences(state);
let storageBlocked = Boolean(startupError);
let toastTimer;

function notify(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 6500);
}

function currentPart(doc = project) {
  return doc.parts.find((p) => p.id === state.partId) ?? doc.parts[0];
}
function currentGuitar(doc = project) {
  return doc.guitars.find((g) => g.id === state.guitarId) ?? doc.guitars[0];
}
function guitarForPart(part = currentPart()) {
  return project.guitars.find((g) => g.id === part.guitarId);
}
function chordById(chordId) {
  return currentPart().chords.find((c) => c.id === chordId);
}

function persist() {
  if (storageBlocked) {
    state.storageError = true;
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    state.storageError = false;
  } catch {
    state.storageError = true;
    notify(
      "Browser storage is unavailable or full. Use Save JSON to keep your work.",
    );
  }
}

function render(preserveInput = false) {
  const active = app.contains(document.activeElement)
    ? document.activeElement
    : null;
  const field = active?.dataset.field;
  const index = active?.dataset.index;
  const value = active?.value;
  const selection =
    active?.tagName === "INPUT" && active.type === "text"
      ? active.selectionStart
      : null;
  const buttonSelector = active?.dataset.action
    ? Object.entries(active.dataset)
        .map(
          ([key, v]) =>
            `[data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}="${CSS.escape(v)}"]`,
        )
        .join("")
    : null;
  state.canUndo = history.length > 0;
  document.body.classList.toggle("in-focus", state.focus);
  app.innerHTML = shell(project, state, renderView(project, state));
  if (field) {
    const target = app.querySelector(
      `[data-field="${field}"]${index !== undefined ? `[data-index="${index}"]` : ""}`,
    );
    if (target) {
      if (preserveInput) target.value = value;
      target.focus({ preventScroll: true });
      if (selection !== null) target.setSelectionRange(selection, selection);
    }
  }
  if (buttonSelector)
    app.querySelector(buttonSelector)?.focus({ preventScroll: true });
  hydrateFingerings();
}

function commit(update, { undo = true, preserveInput = false } = {}) {
  const next = structuredClone(project);
  update(next);
  const valid = parseProject(next);
  if (undo) {
    history.push(project);
    if (history.length > 50) history.shift();
  }
  project = valid;
  persist();
  render(preserveInput);
}

function chordSignature(chord, tuning) {
  return JSON.stringify([
    chord.id,
    tuning,
    chord.root,
    chord.intervals,
    chord.bass,
  ]);
}

function hydrateFingerings() {
  if (state.view === "guitars") return;
  const part = currentPart();
  const tuning = guitarForPart(part).strings;
  for (const chord of part.chords) {
    const key = chordSignature(chord, tuning);
    if (
      !getFingering(chord, tuning) &&
      !generating.has(key) &&
      !failed.has(key)
    )
      generateFingering(part.id, chord, tuning, key);
  }
}

async function generateFingering(partId, chord, tuning, key) {
  generating.add(key);
  try {
    const voicings = await findVoicings(tuning, chord);
    const part = project.parts.find((p) => p.id === partId);
    const current = part?.chords.find((c) => c.id === chord.id);
    if (
      !current ||
      chordSignature(current, guitarForPart(part).strings) !== key ||
      getFingering(current, tuning)
    )
      return;
    delete state.errors[chord.id];
    commit(
      (doc) => {
        const target = doc.parts
          .find((p) => p.id === partId)
          .chords.find((c) => c.id === chord.id);
        setFingering(
          target,
          tuning,
          voicings[0]?.frets ?? tuning.map(() => -1),
        );
      },
      { undo: false, preserveInput: true },
    );
    if (!voicings.length)
      notify(
        "No complete automatic grip for this chord and tuning. Use Edit to draw a fingering.",
      );
  } catch (error) {
    failed.add(key);
    state.errors[chord.id] = error.message;
    render(true);
    notify(error.message + " Use Edit to draw a fingering.");
  } finally {
    generating.delete(key);
  }
}

async function cycleVoicing(chordId, direction) {
  const partId = currentPart().id;
  const chord = chordById(chordId);
  const tuning = [...guitarForPart().strings];
  const signature = chordSignature(chord, tuning);
  const voicings = await findVoicings(tuning, chord);
  const part = project.parts.find((p) => p.id === partId);
  const current = part?.chords.find((c) => c.id === chordId);
  if (
    !current ||
    chordSignature(current, guitarForPart(part).strings) !== signature
  )
    return;
  if (!voicings.length) {
    notify("No automatic grip found. Use Edit to craft one.");
    return;
  }
  const selected = getFingering(current, tuning)?.join(",");
  const index = voicings.findIndex((v) => v.frets.join(",") === selected);
  const next = (index + direction + voicings.length) % voicings.length;
  commit((doc) =>
    setFingering(
      doc.parts
        .find((p) => p.id === partId)
        .chords.find((c) => c.id === chordId),
      tuning,
      voicings[next].frets,
    ),
  );
}

function editChord(chord, isNew = false) {
  const partId = currentPart().id;
  const tuning = [...guitarForPart().strings];
  if (isNew && currentPart().chords.length >= 64)
    throw new Error("A part can hold up to 64 chords.");
  openChordEditor(
    chord,
    tuning,
    (edited) => {
      commit((doc) => {
        const part = doc.parts.find((p) => p.id === partId);
        if (isNew) part.chords.push(edited);
        else
          part.chords[part.chords.findIndex((c) => c.id === edited.id)] =
            edited;
      });
      notify("Chord saved.");
    },
    {
      keyTones: scaleNotes(currentPart().root, partScale(currentPart())).map(
        (n) => n.pc,
      ),
      partName: currentPart().name,
      isNew,
      toggleTheme,
    },
  );
}

function selectPart(partId) {
  state.partId = partId;
  state.guitarId = currentPart().guitarId;
  state.sheetPage = 0;
  render();
}

async function toggleFullscreen() {
  state.focus = !state.focus;
  render();
  try {
    if (state.focus && !document.fullscreenElement)
      await document.documentElement.requestFullscreen();
    else if (!state.focus && document.fullscreenElement)
      await document.exitFullscreen();
  } catch {
    if (state.focus)
      notify(
        "Focus view is ready. Browser fullscreen is unavailable; use your browser’s fullscreen command.",
      );
  }
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  savePreferences(state);
  render(true);
}

const actions = {
  theme: toggleTheme,
  "scale-interval": (target) =>
    commit((doc) => {
      const scale = currentPart(doc).customScale;
      const interval = Number(target.dataset.interval);
      if (interval === 0) return;
      scale.intervals = scale.intervals.includes(interval)
        ? scale.intervals.filter((n) => n !== interval)
        : [...scale.intervals, interval];
    }),
  view: (target) => {
    state.view = target.dataset.view;
    state.focus = false;
    render();
  },
  "select-part": (target) => {
    if (state.view === "guitars") state.view = "parts";
    selectPart(target.dataset.id);
  },
  "add-part": () => {
    const part = makePart(state.guitarId, project.parts.length + 1);
    state.partId = part.id;
    state.view = "parts";
    state.sheetPage = 0;
    commit((doc) => doc.parts.push(part));
    app.querySelector('[data-field="part-name"]')?.select();
  },
  "remove-part": () => {
    if (project.parts.length <= 1) return;
    const oldId = currentPart().id;
    state.partId = project.parts.find((p) => p.id !== oldId).id;
    commit((doc) => {
      doc.parts = doc.parts.filter((p) => p.id !== oldId);
    });
    notify("Part removed. Undo restores it.");
  },
  "new-guitar": () => {
    const guitar = {
      id: id(),
      name: `Guitar ${project.guitars.length + 1}`,
      strings: [...PRESETS.standard.strings],
    };
    state.guitarId = guitar.id;
    commit((doc) => doc.guitars.push(guitar));
  },
  "open-triad": (target) => {
    const part = currentPart();
    const source = scaleChords(part.root, partScale(part), 3)[
      Number(target.dataset.degree)
    ];
    editChord(
      {
        id: id(),
        root: source.root,
        intervals: source.intervals,
        bass: source.root,
        label: "",
        fingerings: {},
      },
      true,
    );
  },
  "custom-chord": () => editChord(makeChord(currentPart().root), true),
  "edit-chord": (target) => {
    if (target.dataset.partId) state.partId = target.dataset.partId;
    editChord(chordById(target.dataset.id));
  },
  "cycle-voicing": (target) =>
    cycleVoicing(target.dataset.id, Number(target.dataset.direction)),
  "remove-chord": (target) =>
    commit((doc) => {
      const part = currentPart(doc);
      part.chords = part.chords.filter((c) => c.id !== target.dataset.id);
    }),
  "move-chord": (target) =>
    commit((doc) => {
      const chords = currentPart(doc).chords;
      const from = chords.findIndex((c) => c.id === target.dataset.id);
      const to = from + Number(target.dataset.direction);
      if (from >= 0 && to >= 0 && to < chords.length)
        [chords[from], chords[to]] = [chords[to], chords[from]];
    }),
  "play-chord": (target) => {
    const chord = chordById(target.dataset.id);
    const tuning = guitarForPart().strings;
    return playNotes(soundingNotes(tuning, getFingering(chord, tuning) ?? []));
  },
  labels: (target) => {
    state.labels = target.dataset.value;
    savePreferences(state);
    render();
  },
  "sheet-page": (target) => {
    state.sheetPage = Math.max(
      0,
      Math.min(
        Math.ceil(currentPart().chords.length / 6) - 1,
        state.sheetPage + Number(target.dataset.direction),
      ),
    );
    render();
  },
  fullscreen: toggleFullscreen,
  print: () => window.print(),
  export: () => {
    downloadJSON(project);
    notify("JSON downloaded. Keep it as a portable backup.");
  },
  import: () => document.querySelector("#import-file").click(),
  undo: () => {
    if (!history.length) return;
    project = history.pop();
    if (!project.parts.some((p) => p.id === state.partId))
      state.partId = project.parts[0].id;
    if (!project.guitars.some((g) => g.id === state.guitarId))
      state.guitarId = project.guitars[0].id;
    persist();
    render();
    notify("Last change undone.");
  },
};

function changeField(target) {
  const field = target.dataset.field;
  const value = target.value;
  if (field === "active-guitar") {
    state.guitarId = value;
    render();
    return;
  }
  if (field === "display-part") {
    selectPart(value);
    return;
  }
  if (field === "active-part") {
    selectPart(value);
    return;
  }
  if (field === "display-start" || field === "zoom") {
    state[field === "zoom" ? "zoom" : "start"] = Number(value);
    render();
    return;
  }
  commit((doc) => {
    const part = currentPart(doc);
    const guitar = currentGuitar(doc);
    if (field === "project-title") doc.title = value.trim();
    if (field === "guitar-name") guitar.name = value.trim();
    if (field === "part-name") part.name = value.trim();
    if (field === "part-guitar") {
      part.guitarId = value;
      state.guitarId = value;
    }
    if (field === "part-root") part.root = Number(value);
    if (field === "part-scale") {
      if (value === "custom" && part.scale !== "custom")
        part.customScale = {
          name: "Custom scale",
          intervals: [...partScale(part).intervals],
        };
      part.scale = value;
    }
    if (field === "custom-scale-name") part.customScale.name = value.trim();
    if (field === "string-count")
      guitar.strings = resizeTuning(guitar.strings, Number(value));
    if (
      field === "preset" &&
      Object.hasOwn(PRESETS, value) &&
      PRESETS[value].strings.length === guitar.strings.length
    ) {
      guitar.strings = [...PRESETS[value].strings];
    }
    const index = Number(target.dataset.index);
    if (field === "string-note")
      guitar.strings[index] =
        Math.floor(guitar.strings[index] / 12) * 12 + Number(value);
    if (field === "string-octave")
      guitar.strings[index] =
        (Number(value) + 1) * 12 + (guitar.strings[index] % 12);
  });
}

app.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target || target.disabled) return;
  try {
    await actions[target.dataset.action]?.(target);
  } catch (error) {
    notify(error.message);
  }
});
app.addEventListener("change", (event) => {
  if (!event.target.dataset.field) return;
  try {
    changeField(event.target);
  } catch (error) {
    render();
    notify(error.message);
  }
});
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && state.focus) {
    state.focus = false;
    render();
  }
});
window.addEventListener("storage", (event) => {
  if (
    ![STORAGE_KEY, LEGACY_STORAGE_KEY].includes(event.key) ||
    event.newValue === JSON.stringify(project)
  )
    return;
  storageBlocked = true;
  state.storageError = true;
  render(true);
  notify(
    "Another tab changed this session. Autosave is paused to protect both versions. Save JSON, then reload to use the other version.",
  );
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    !document.querySelector("#editor").open &&
    state.focus
  ) {
    state.focus = false;
    render();
  }
});

document
  .querySelector("#import-file")
  .addEventListener("change", async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > MAX_FILE_BYTES)
        throw new Error("Project files must be smaller than 2 MB.");
      const imported = parseProject(await file.text());
      history.push(project);
      project = imported;
      state.partId = project.parts[0].id;
      state.guitarId = project.guitars[0].id;
      state.sheetPage = 0;
      storageBlocked = false;
      persist();
      render();
      notify("Project opened. Undo restores the previous session.");
    } catch (error) {
      notify(
        `Could not open JSON: ${error.message} Your current session is unchanged.`,
      );
    }
  });

if (!startupError) persist();
render();
if (startupError) notify(startupError + " Save JSON to keep new work.");
