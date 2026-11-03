import { makeSheet, parseSheet, readAttachment, MAX_SHEET_SOURCE } from "./sheet-data.js";
import { sheetFrame, mountSheet, sheetDocument } from "./sheet-renderer.js";
import { esc, options } from "./ui.js";

const dialog = document.querySelector("#sheet-editor");
let session = null;
let timer;

function status(message, error = false) {
  const node = dialog.querySelector(".sheet-editor-status");
  node.textContent = message;
  node.classList.toggle("error", error);
}

async function preview() {
  const current = session;
  if (!current) return;
  const revision = current.previewRevision = (current.previewRevision ?? 0) + 1;
  try {
    await mountSheet(dialog.querySelector("iframe"), current.draft, current.context);
    if (session === current && current.previewRevision === revision) status("Preview updated. Changes apply when saved.");
  } catch (error) {
    if (session === current && current.previewRevision === revision) status(error.message, true);
  }
}

function fileRow(file) {
  return `<li><button data-sheet-action="edit-file" data-name="${esc(file.name)}" ${file.encoding !== "utf8" ? "disabled" : ""}>${esc(file.name)}</button><small>${Math.ceil(file.content.length / 1024)} KiB</small><button data-sheet-action="remove-file" data-name="${esc(file.name)}" class="icon-button" aria-label="Remove ${esc(file.name)}">×</button></li>`;
}

function renderEditor() {
  const { draft, editingFile } = session;
  const file = draft.files.find((entry) => entry.name === editingFile);
  dialog.innerHTML = `<header class="editor-header"><div><h2 id="sheet-editor-title">Edit practice sheet</h2><p>Markdown, HTML and components use files attached below.</p></div><button data-sheet-action="close" class="icon-button" aria-label="Close sheet editor">×</button></header>
    <div class="sheet-editor-layout"><section class="sheet-source-panel"><div class="sheet-source-tools"><label>Format<select data-sheet-field="format" aria-label="Sheet format">${options([["markdown", "Markdown"], ["html", "HTML"]], draft.format)}</select></label><label>Layout<select data-sheet-field="layout" aria-label="Sheet layout">${options([["replace", "Custom sheet"], ["append", "After scale and chords"]], draft.layout)}</select></label><button data-sheet-action="open-source" class="outlined">Open .md / .html</button><button data-sheet-action="download-source" class="quiet">Download source</button></div>
    <div class="sheet-insert-tools"><button data-sheet-action="source" class="quiet">Sheet source</button><button data-sheet-action="insert" data-component="tab">Insert tab</button><button data-sheet-action="insert" data-component="scale">Scale</button><button data-sheet-action="insert" data-component="chords">Chords</button><button data-sheet-action="insert" data-component="include">Include file</button></div>
    <label class="sheet-source-label">${file ? esc(file.name) : "Sheet source"}<textarea id="sheet-source" aria-label="${file ? `Edit ${esc(file.name)}` : "Sheet source"}" spellcheck="false" maxlength="${file ? 524288 : MAX_SHEET_SOURCE}">${esc(file ? file.content : draft.source)}</textarea></label>
    <div class="sheet-files-heading"><h3>Attached files</h3><button data-sheet-action="attach" class="outlined">Add files</button></div><ul class="sheet-file-list">${draft.files.map(fileRow).join("") || "<li>No attached files.</li>"}</ul><p class="sheet-help">JSON, Markdown, HTML, CSS, JavaScript, text and images. 512 KiB per file; 2 MiB per project. HTML runs in an isolated sheet. <a href="https://github.com/crestenstclair/crest-chord-builder/blob/main/docs/custom-sheets.md" target="_blank" rel="noreferrer">Components and LLM format</a></p></section>
    <section class="sheet-preview-panel"><h3>Preview</h3>${sheetFrame("Sheet editor preview")}</section></div>
    <footer class="editor-footer"><p class="sheet-editor-status" role="status">Changes apply when saved.</p><div><button data-sheet-action="remove" class="quiet">Use standard sheet</button><button data-sheet-action="close" class="quiet">Cancel</button><button data-sheet-action="save" class="primary">Save sheet</button></div></footer>
    <input id="sheet-source-file" type="file" accept=".md,.html,.htm,.txt" hidden><input id="sheet-attachments" type="file" accept=".json,.md,.html,.htm,.css,.js,.txt,.svg,.png,.jpg,.jpeg,.webp" multiple hidden>`;
  preview();
}

function insertComponent(kind) {
  session.editingFile = null;
  const file = session.draft.files.find((entry) => kind === "tab" ? entry.mime === "application/json" : entry.mime === "text/markdown");
  const name = file?.name ?? (kind === "tab" ? "tab.json" : "notes.md");
  const markup = ({ tab: `<guitar-tab src="${esc(name)}" bars-per-row="4"></guitar-tab>`, scale: "<scale-map></scale-map>", chords: "<chord-sheet></chord-sheet>", include: `<file-content src="${esc(name)}"></file-content>` })[kind];
  session.draft.source += `\n\n${markup}\n`;
  renderEditor();
}

function downloadSource() {
  const { draft } = session;
  const url = URL.createObjectURL(new Blob([draft.source], { type: draft.format === "html" ? "text/html" : "text/markdown" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `practice-sheet.${draft.format === "html" ? "html" : "md"}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

dialog.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-sheet-action]");
  if (!target || !session) return;
  try {
    const action = target.dataset.sheetAction;
    if (action === "close") return dialog.close();
    if (action === "open-source") return dialog.querySelector("#sheet-source-file").click();
    if (action === "attach") return dialog.querySelector("#sheet-attachments").click();
    if (action === "download-source") return downloadSource();
    if (action === "insert") return insertComponent(target.dataset.component);
    if (action === "save") {
      const current = session;
      const draft = parseSheet(current.draft);
      await sheetDocument(draft, current.context);
      if (session !== current) return;
      current.onSave(draft);
      return dialog.close();
    }
    if (action === "remove") {
      session.onSave(null);
      return dialog.close();
    }
    if (action === "source") session.editingFile = null;
    if (action === "edit-file") session.editingFile = target.dataset.name;
    if (action === "remove-file") {
      session.draft.files = session.draft.files.filter((file) => file.name !== target.dataset.name);
      if (session.editingFile === target.dataset.name) session.editingFile = null;
    }
    renderEditor();
  } catch (error) { if (session) status(error.message, true); }
});

dialog.addEventListener("input", (event) => {
  if (!session || event.target.id !== "sheet-source") return;
  if (session.editingFile) session.draft.files.find((file) => file.name === session.editingFile).content = event.target.value;
  else session.draft.source = event.target.value;
  clearTimeout(timer);
  timer = setTimeout(preview, 250);
});

dialog.addEventListener("change", async (event) => {
  const current = session;
  if (!current) return;
  try {
    if (event.target.dataset.sheetField) {
      current.draft[event.target.dataset.sheetField] = event.target.value;
      return preview();
    }
    if (event.target.type !== "file") return;
    const files = [...event.target.files];
    const attachments = await Promise.all(files.map(readAttachment));
    if (session !== current || !attachments.length) return;
    if (event.target.id === "sheet-source-file") {
      current.draft.source = attachments[0].content;
      current.draft.format = attachments[0].mime === "text/html" ? "html" : "markdown";
      current.editingFile = null;
    } else {
      const incoming = new Set(attachments.map((file) => file.name));
      const next = { ...current.draft, files: [...current.draft.files.filter((file) => !incoming.has(file.name)), ...attachments] };
      current.draft = parseSheet(next);
    }
    renderEditor();
  } catch (error) { if (session === current) status(error.message, true); }
});

dialog.addEventListener("close", () => { clearTimeout(timer); session = null; dialog.innerHTML = ""; });

export function openSheetEditor(sheet, context, onSave) {
  session = { draft: structuredClone(sheet ?? makeSheet()), context: structuredClone(context), onSave, editingFile: null };
  renderEditor();
  dialog.showModal();
}
