import { marked } from "./vendor/marked.js";
import { parseSheet } from "./sheet-data.js";
import { renderTab } from "./tablature.js";
import { engraveTab } from "./tab-engraver.js";
import { tabPlaybackScript } from "./tab-playback.js";
import { chordBox, fretboard } from "./diagrams.js";
import { getFingering } from "./project.js";
import { chordName, describeFingering, partScale, pitchName, scaleNotes } from "./music.js";
import { esc } from "./ui.js";

let styles;
function sheetStyles() {
  styles ??= Promise.all(["styles.css", "sheets.css"].map(async (name) => {
    const response = await fetch(new URL(name, import.meta.url));
    if (!response.ok) throw new Error("Sheet styles could not be loaded. Reload to retry.");
    return response.text();
  })).then((parts) => parts.join("\n")).catch((error) => { styles = null; throw error; });
  return styles;
}

function attachment(sheet, name) {
  const file = sheet.files.find((entry) => entry.name === name);
  if (!file) throw new Error(`Attach the file “${name}” to this sheet.`);
  return file;
}

function fileURL(file) {
  return file.encoding === "base64"
    ? `data:${file.mime};base64,${file.content}`
    : `data:${file.mime};charset=utf-8,${encodeURIComponent(file.content)}`;
}

function scaleComponent(context, element) {
  const { part, guitar } = context;
  const start = Number(element?.getAttribute("start") ?? 0);
  if (!Number.isInteger(start) || start < 0 || start > 12) throw new Error("Scale start must be a fret from 0 to 12.");
  const notes = scaleNotes(part.root, partScale(part));
  const labels = element?.getAttribute("labels") === "notes" ? "notes" : "intervals";
  return `<section class="scale-map"><h2>${esc(partScale(part).name)}</h2>${fretboard(guitar.strings, notes.map((n) => n.pc), part.root, { start, labels, intervalLabels: Object.fromEntries(notes.map((n) => [n.pc, n.interval])) })}</section>`;
}

export function sheetChordCard(chord, context, position = "Voicing") {
  const frets = getFingering(chord, context.guitar.strings);
  const bass = frets ? describeFingering(context.guitar.strings, frets, chord.root).bass : chord.bass;
  const name = chordName(chord, bass);
  const disabled = context.canCycle ? "" : "disabled";
  return `<article class="sheet-component-chord" data-chord="${esc(chord.id)}"><h3>${esc(chord.label || name)}</h3>${chord.label && chord.label !== name ? `<small>${esc(name)}</small>` : ""}${frets ? chordBox(context.guitar.strings, frets, chord.root, name, false, "intervals", chord) : '<p>Open this chord in Parts to choose a fingering.</p>'}<div class="fret-values">${frets?.map((fret) => fret < 0 ? "×" : fret).join(" ") ?? ""}</div><div class="sheet-voicing-controls no-print"><button type="button" data-sheet-voicing="-1" aria-label="Previous voicing for ${esc(name)}" ${disabled}>‹</button><span class="sheet-voicing-status" role="status">${esc(position)}</span><button type="button" data-sheet-voicing="1" aria-label="Next voicing for ${esc(name)}" ${disabled}>›</button></div></article>`;
}

function chordComponent(context) {
  return `<section><h2>Chord sheet</h2><div class="sheet-component-chords">${context.part.chords.map((chord) => sheetChordCard(chord, context)).join("") || "<p>No chords in this part.</p>"}</div></section>`;
}

function includedFile(element, sheet, context, depth) {
  const file = attachment(sheet, element.getAttribute("src"));
  if (file.mime.startsWith("image/")) return `<img src="${esc(fileURL(file))}" alt="${esc(file.name)}">`;
  if (file.mime === "text/markdown") return expandMarkup(marked.parse(file.content), sheet, context, depth + 1);
  if (file.mime === "text/html") return expandMarkup(file.content, sheet, context, depth + 1);
  return `<pre><code>${esc(file.content)}</code></pre>`;
}

function bindFiles(fragment, sheet) {
  for (const node of fragment.querySelectorAll("img[src],script[src],link[rel=stylesheet][href]")) {
    const name = node.getAttribute(node.tagName === "LINK" ? "href" : "src");
    if (node.tagName === "IMG" && name.startsWith("data:image/")) continue;
    const file = attachment(sheet, name);
    if (node.tagName === "IMG") node.setAttribute("src", fileURL(file));
    else if (node.tagName === "SCRIPT") {
      if (file.mime !== "text/javascript") throw new Error(`${name} must be a JavaScript file.`);
      node.removeAttribute("src");
      node.textContent = file.content;
    } else {
      if (file.mime !== "text/css") throw new Error(`${name} must be a CSS file.`);
      const style = document.createElement("style");
      style.textContent = file.content;
      node.replaceWith(style);
    }
  }
}

function expandMarkup(markup, sheet, context, depth = 0) {
  if (depth > 4) throw new Error("Included files are nested too deeply (maximum four levels).");
  // Templates remain inert: imported scripts and custom elements never enter the app DOM.
  const template = document.createElement("template");
  template.innerHTML = markup;
  template.content.querySelectorAll("meta,base").forEach((node) => node.remove());
  for (const element of template.content.querySelectorAll("guitar-tab,scale-map,chord-sheet,file-content")) {
    let html;
    if (element.tagName === "GUITAR-TAB")
      html = renderTab(attachment(sheet, element.getAttribute("src")).content, Object.fromEntries([...element.attributes].map((a) => [a.name, a.value])), context.guitar.strings);
    else if (element.tagName === "SCALE-MAP") html = scaleComponent(context, element);
    else if (element.tagName === "CHORD-SHEET") html = chordComponent(context);
    else html = includedFile(element, sheet, context, depth);
    const replacement = document.createElement("template");
    replacement.innerHTML = html;
    if (element.tagName === "GUITAR-TAB") engraveTab(replacement.content);
    element.replaceWith(replacement.content);
  }
  bindFiles(template.content, sheet);
  return template.innerHTML;
}

function defaultContent(context) {
  return `<header><p>${esc(context.projectTitle)}</p><h1>${esc(context.part.name)}</h1><p>${esc(context.guitar.name)} · treble to bass: ${esc([...context.guitar.strings].reverse().map(pitchName).join(" · "))}</p></header>${scaleComponent(context)}${chordComponent(context)}`;
}

// This bootstrap runs only in the opaque-origin iframe. User scripts receive
// selected-part data and attached files, never storage or the parent application.
function frameRuntime(data) {
  const files = new Map(data.files.map((file) => [file.name, file]));
  function readText(name) {
    const file = files.get(name);
    if (!file || file.encoding !== "utf8") throw new Error(`No text attachment named ${name}.`);
    return file.content;
  }
  window.crest = Object.freeze({
    guitar: data.guitar, part: data.part,
    filenames: Object.freeze([...files.keys()]),
    readText,
    readJSON: (name) => JSON.parse(readText(name)),
    fileURL: (name) => {
      const file = files.get(name);
      if (!file) throw new Error(`No attachment named ${name}.`);
      return file.encoding === "base64" ? `data:${file.mime};base64,${file.content}` : `data:${file.mime};charset=utf-8,${encodeURIComponent(file.content)}`;
    },
  });
  addEventListener("DOMContentLoaded", () => {
    const report = () => parent.postMessage({ type: "crest-sheet-height", height: Math.ceil(document.body.getBoundingClientRect().height) + 2 }, "*");
    new ResizeObserver(report).observe(document.body);
    report();
    parent.postMessage({ type: "crest-sheet-ready" }, "*");
  });
  addEventListener("message", (event) => {
    if (event.source === parent && event.data?.type === "crest-sheet-print") window.print();
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sheet-voicing]");
    if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") return;
    const card = button.closest("[data-chord]");
    card.querySelectorAll("button").forEach((node) => node.setAttribute("aria-disabled", "true"));
    card.querySelector(".sheet-voicing-status").textContent = "Finding…";
    parent.postMessage({ type: "crest-sheet-cycle", chordId: card.dataset.chord, direction: Number(button.dataset.sheetVoicing) }, "*");
  });
  addEventListener("message", (event) => {
    if (event.source !== parent || event.data?.type !== "crest-sheet-chord") return;
    if (event.data.part) data.part.chords = event.data.part.chords;
    const cards = [...document.querySelectorAll(".sheet-component-chord")].filter((card) => card.dataset.chord === event.data.chordId);
    for (const card of cards) {
      if (event.data.error) {
        card.querySelectorAll("button").forEach((node) => node.removeAttribute("aria-disabled"));
        card.querySelector(".sheet-voicing-status").textContent = event.data.error;
      } else {
        const template = document.createElement("template");
        template.innerHTML = event.data.html;
        const next = template.content.firstElementChild;
        const focused = card.contains(document.activeElement);
        card.replaceWith(next);
        if (focused) next.querySelector(`[data-sheet-voicing="${event.data.direction}"]`)?.focus({ preventScroll: true });
      }
    }
  });
}

export async function sheetDocument(input, context) {
  const sheet = parseSheet(input);
  const markup = sheet.format === "markdown" ? marked.parse(sheet.source) : sheet.source;
  const body = (sheet.layout === "append" ? defaultContent(context) : "") + expandMarkup(markup, sheet, context);
  const data = JSON.stringify({ files: sheet.files, guitar: context.guitar, part: { ...context.part, sheet: undefined } }).replaceAll("<", "\\u003c");
  const css = await sheetStyles();
  const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'";
  return `<!doctype html><html lang="en" data-theme="${context.theme === "light" ? "light" : "dark"}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(context.part.name)}</title><style>${css}</style><script>(${frameRuntime.toString()})(${data});\n${tabPlaybackScript()}</script></head><body class="sheet-document" style="--display-zoom:${context.zoom ?? 1}">${body}</body></html>`;
}

export function sheetFrame(title = "Custom practice sheet") {
  return `<iframe class="custom-sheet-frame" title="${esc(title)}" sandbox="allow-scripts allow-modals" allow="autoplay" referrerpolicy="no-referrer"></iframe>`;
}

export function pauseSheetPlayback() {
  document.querySelectorAll(".custom-sheet-frame").forEach((frame) => frame.contentWindow.postMessage({ type: "crest-sheet-pause" }, "*"));
}

export async function mountSheet(frame, sheet, context, onCycle = null) {
  const revision = Symbol();
  frame.sheetRevision = revision;
  frame.onCycle = onCycle;
  frame.dataset.ready = "false";
  const html = await sheetDocument(sheet, { ...context, canCycle: Boolean(onCycle) });
  if (frame.isConnected && frame.sheetRevision === revision) frame.srcdoc = html;
}

addEventListener("message", (event) => {
  const frame = [...document.querySelectorAll(".custom-sheet-frame")].find((node) => node.contentWindow === event.source);
  if (!frame) return;
  if (event.data?.type === "crest-sheet-cycle" && frame.onCycle &&
      typeof event.data.chordId === "string" && [-1, 1].includes(event.data.direction)) {
    const revision = frame.sheetRevision;
    Promise.resolve().then(() => frame.onCycle(event.data.chordId, event.data.direction)).then((result) => {
      if (result && frame.isConnected && frame.sheetRevision === revision)
        frame.contentWindow.postMessage({ type: "crest-sheet-chord", chordId: event.data.chordId, direction: event.data.direction, ...result }, "*");
    }).catch((error) => {
      if (frame.isConnected && frame.sheetRevision === revision)
        frame.contentWindow.postMessage({ type: "crest-sheet-chord", chordId: event.data.chordId, error: error.message }, "*");
    });
  }
  if (event.data?.type === "crest-sheet-ready") frame.dataset.ready = "true";
  if (event.data?.type === "crest-sheet-height" && Number.isFinite(event.data.height))
    frame.style.height = `${Math.max(160, Math.min(60000, event.data.height))}px`;
});
