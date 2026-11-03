import { marked } from "./vendor/marked.js";
import { parseSheet } from "./sheet-data.js";
import { renderTab } from "./tablature.js";
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

function chordComponent(context) {
  return `<section><h2>Chord sheet</h2><div class="sheet-component-chords">${context.part.chords.map((chord) => {
    const frets = getFingering(chord, context.guitar.strings);
    const bass = frets ? describeFingering(context.guitar.strings, frets, chord.root).bass : chord.bass;
    const name = chordName(chord, bass);
    return `<article class="sheet-component-chord"><h3>${esc(chord.label || name)}</h3>${frets ? chordBox(context.guitar.strings, frets, chord.root, name, false, "intervals", chord) : '<p>Open this chord in Parts to choose a fingering.</p>'}</article>`;
  }).join("") || "<p>No chords in this part.</p>"}</div></section>`;
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
}

export async function sheetDocument(input, context) {
  const sheet = parseSheet(input);
  const markup = sheet.format === "markdown" ? marked.parse(sheet.source) : sheet.source;
  const body = (sheet.layout === "append" ? defaultContent(context) : "") + expandMarkup(markup, sheet, context);
  const data = JSON.stringify({ files: sheet.files, guitar: context.guitar, part: { ...context.part, sheet: undefined } }).replaceAll("<", "\\u003c");
  const css = await sheetStyles();
  const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'";
  return `<!doctype html><html lang="en" data-theme="${context.theme === "light" ? "light" : "dark"}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(context.part.name)}</title><style>${css}</style><script>(${frameRuntime.toString()})(${data});</script></head><body class="sheet-document" style="--display-zoom:${context.zoom ?? 1}">${body}</body></html>`;
}

export function sheetFrame(title = "Custom practice sheet") {
  return `<iframe class="custom-sheet-frame" title="${esc(title)}" sandbox="allow-scripts allow-modals" referrerpolicy="no-referrer"></iframe>`;
}

export async function mountSheet(frame, sheet, context) {
  const revision = Symbol();
  frame.sheetRevision = revision;
  frame.dataset.ready = "false";
  const html = await sheetDocument(sheet, context);
  if (frame.isConnected && frame.sheetRevision === revision) frame.srcdoc = html;
}

addEventListener("message", (event) => {
  const frame = [...document.querySelectorAll(".custom-sheet-frame")].find((node) => node.contentWindow === event.source);
  if (!frame) return;
  if (event.data?.type === "crest-sheet-ready") frame.dataset.ready = "true";
  if (event.data?.type === "crest-sheet-height" && Number.isFinite(event.data.height))
    frame.style.height = `${Math.max(160, Math.min(60000, event.data.height))}px`;
});
