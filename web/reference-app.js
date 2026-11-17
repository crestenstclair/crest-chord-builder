import { ReferenceBridge } from "./reference-bridge.js";
import { parseReferenceSnapshot, referencePayload, referencePreferences } from "./reference-state.js";
import { parseProject, MAX_FILE_BYTES } from "./project.js";
import { mountSheet } from "./sheet-renderer.js";
import { capoFret } from "./fingering-settings.js";
import { esc, options } from "./ui.js";

const root = document.querySelector("#reference-root");
const dialog = document.querySelector("#reference-config");
const jsonInput = document.querySelector("#reference-json");
const errorOutput = document.querySelector("#reference-config-error");
let bridge;
let current = { generation: 0, project: null, ui: referencePreferences() };
let saveSequence = 0;
let hostStatus = "Stored in plug-in · save your Live set to keep changes";
let saveError = false;

function status(message, error = false) {
  hostStatus = message;
  saveError = error;
  const node = document.querySelector(".reference-status");
  if (node) { node.textContent = message; node.classList.toggle("error", error); }
}

function applyHostSnapshot(snapshot) {
  const next = parseReferenceSnapshot(snapshot);
  if (next.generation <= current.generation) return;
  saveSequence++;
  current = next;
  if (dialog.open) dialog.close();
  status("Stored in plug-in · save your Live set to keep changes");
  render();
}

async function save() {
  const sequence = ++saveSequence;
  status("Storing in plug-in…");
  try {
    const reply = await bridge.write(referencePayload(current.project, current.ui, current.generation));
    if (sequence !== saveSequence) return;
    if (!reply.ok) {
      if (reply.snapshot && reply.snapshot.generation > current.generation) applyHostSnapshot(reply.snapshot);
      throw new Error(reply.error || "The plug-in rejected the change.");
    }
    status("Stored in plug-in · save your Live set to keep changes");
  } catch (error) {
    if (sequence === saveSequence) status(error.message, true);
  }
}

function configure() {
  jsonInput.value = current.project ? JSON.stringify(current.project, null, 2) : "";
  errorOutput.textContent = "";
  dialog.showModal();
  jsonInput.focus();
}

function applyJSON(source) {
  const project = parseProject(source);
  current = { ...current, project, ui: referencePreferences(current.ui, project) };
  dialog.close();
  render();
  save();
}

function render() {
  const { project, ui } = current;
  document.documentElement.dataset.theme = ui.theme;
  root.innerHTML = `<header class="reference-header"><h1>${esc(project?.title ?? "Crest Chord Reference")}</h1><output class="reference-status ${saveError ? "error" : ""}" role="status">${esc(hostStatus)}</output><button data-reference="configure" class="outlined">Project JSON</button></header>`;
  if (!project) {
    root.insertAdjacentHTML("beforeend", '<section class="reference-empty"><h2>Your guitar parts, inside your Live set</h2><p>Paste your project JSON once. Every instance keeps its own copy.</p><button class="primary" data-reference="configure">Paste project JSON</button></section>');
    return;
  }
  const part = project.parts.find((entry) => entry.id === ui.partId) ?? project.parts[0];
  const guitar = project.guitars.find((entry) => entry.id === part.guitarId);
  ui.partId = part.id;
  ui.start = Math.max(capoFret(guitar), ui.start);
  root.insertAdjacentHTML("beforeend", `<nav class="reference-controls" aria-label="Reference controls"><label class="inline-label">Part<select data-reference="part" aria-label="Part">${options(project.parts.map((entry) => [entry.id, entry.name]), part.id)}</select></label><label class="inline-label">Frets<select data-reference="start" aria-label="Frets">${options(Array.from({ length: 13 - capoFret(guitar) }, (_, index) => { const start = index + capoFret(guitar); return [start, `${start}–${start + 12}`]; }), ui.start)}</select></label><label class="inline-label">Size<input data-reference="zoom" type="range" min="80" max="150" step="10" value="${ui.zoom}" aria-label="Display size"></label><div class="segmented"><button data-reference="labels" data-value="intervals" aria-pressed="${ui.labels === "intervals"}">Intervals</button><button data-reference="labels" data-value="notes" aria-pressed="${ui.labels === "notes"}">Notes</button></div><button data-reference="theme" class="outlined">${ui.theme === "dark" ? "Light theme" : "Dark theme"}</button></nav><iframe class="custom-sheet-frame" title="Guitar part reference" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe>`);
  const sheet = part.sheet ?? { format: "markdown", layout: "append", source: "", files: [] };
  const frame = root.querySelector("iframe");
  mountSheet(frame, sheet, { part, guitar, projectTitle: project.title, theme: ui.theme, labels: ui.labels, start: ui.start, zoom: ui.zoom / 100, referenceOnly: true }).catch((error) => {
    if (frame.isConnected) { const message = document.createElement("p"); message.textContent = error.message; frame.replaceWith(message); }
  });
}

root.addEventListener("click", (event) => {
  const target = event.target.closest("[data-reference]");
  if (!target) return;
  if (target.dataset.reference === "configure") return configure();
  if (target.dataset.reference === "labels") current.ui.labels = target.dataset.value;
  else if (target.dataset.reference === "theme") current.ui.theme = current.ui.theme === "dark" ? "light" : "dark";
  else return;
  render();
  save();
});
root.addEventListener("change", (event) => {
  const target = event.target;
  if (target.dataset.reference === "part") current.ui.partId = target.value;
  else if (["start", "zoom"].includes(target.dataset.reference)) current.ui[target.dataset.reference] = Number(target.value);
  else return;
  render();
  save();
});
document.querySelector("#reference-cancel").addEventListener("click", () => dialog.close());
document.querySelector("#reference-apply").addEventListener("click", () => {
  try { applyJSON(jsonInput.value); } catch (error) { errorOutput.textContent = `${error.message} The previous project is unchanged.`; }
});
document.querySelector("#reference-open").addEventListener("click", () => document.querySelector("#reference-file").click());
document.querySelector("#reference-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  const generation = current.generation;
  event.target.value = "";
  if (!file) return;
  try {
    if (file.size > MAX_FILE_BYTES) throw new Error("Project files must be smaller than 2 MB.");
    const source = await file.text();
    // A host recall or cancelled dialog wins over an in-flight file read.
    if (generation !== current.generation || !dialog.open) return;
    jsonInput.value = source;
    applyJSON(jsonInput.value);
  } catch (error) { errorOutput.textContent = `${error.message} The previous project is unchanged.`; }
});

try {
  bridge = new ReferenceBridge(window.__JUCE__);
  bridge.onRestore = (snapshot) => {
    try { applyHostSnapshot(snapshot); } catch (error) { status(`Host state could not be loaded: ${error.message}`, true); }
  };
  applyHostSnapshot(await bridge.read());
} catch (error) {
  root.textContent = error.message;
}
