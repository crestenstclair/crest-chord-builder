export const MAX_SHEET_SOURCE = 200_000;
export const MAX_ATTACHMENT_BYTES = 512 * 1024;
const MIME_TYPES = new Set([
  "application/json", "text/plain", "text/markdown", "text/html", "text/css",
  "text/javascript", "image/svg+xml", "image/png", "image/jpeg", "image/webp",
]);

export function makeSheet() {
  return { format: "markdown", layout: "replace", source: "# Practice sheet\n\n<scale-map></scale-map>\n\n<chord-sheet></chord-sheet>\n\n## Notes\n\nAdd playing instructions here.\n", files: [] };
}

export function parseSheet(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Sheet must be an object.");
  if (!["markdown", "html"].includes(value.format))
    throw new Error("Sheet format must be markdown or html.");
  const layout = value.layout ?? "replace";
  if (!["append", "replace"].includes(layout)) throw new Error("Unknown sheet layout.");
  if (typeof value.source !== "string" || value.source.length > MAX_SHEET_SOURCE)
    throw new Error("Sheet source must be text, up to 200,000 characters.");
  const files = value.files ?? [];
  if (!Array.isArray(files) || files.length > 32)
    throw new Error("A sheet can contain up to 32 attached files.");
  const parsed = files.map(parseAttachment);
  if (new Set(parsed.map((file) => file.name)).size !== parsed.length)
    throw new Error("Attached filenames must be unique.");
  return { format: value.format, layout, source: value.source, files: parsed };
}

function parseAttachment(file) {
  if (!file || typeof file !== "object" || Array.isArray(file) ||
      typeof file.name !== "string" || !/^[\w][\w .-]{0,119}$/.test(file.name))
    throw new Error("Use a filename of 1–120 letters, numbers, spaces, dots, underscores or hyphens, without a folder path.");
  if (!MIME_TYPES.has(file.mime)) throw new Error(`Unsupported file type: ${file.name}.`);
  if (!["utf8", "base64"].includes(file.encoding) || typeof file.content !== "string")
    throw new Error(`Invalid attachment encoding: ${file.name}.`);
  const binary = ["image/png", "image/jpeg", "image/webp"].includes(file.mime);
  if (binary !== (file.encoding === "base64"))
    throw new Error(`Use base64 for raster images and utf8 for text: ${file.name}.`);
  if (binary && !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.content))
    throw new Error(`Invalid image data: ${file.name}.`);
  const bytes = binary ? file.content.length * 3 / 4 : new TextEncoder().encode(file.content).length;
  if (bytes > MAX_ATTACHMENT_BYTES) throw new Error(`${file.name} exceeds 512 KiB.`);
  return { name: file.name, mime: file.mime, encoding: file.encoding, content: file.content };
}

export async function readAttachment(file) {
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error(`${file.name} exceeds 512 KiB.`);
  const extension = file.name.split(".").pop().toLowerCase();
  const mime = ({ json: "application/json", md: "text/markdown", html: "text/html", htm: "text/html", css: "text/css", js: "text/javascript", txt: "text/plain", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" })[extension];
  if (!mime) throw new Error(`Unsupported file type: ${file.name}.`);
  const binary = ["png", "jpg", "jpeg", "webp"].includes(extension);
  let content;
  if (binary) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let text = "";
    for (const byte of bytes) text += String.fromCharCode(byte);
    content = btoa(text);
  } else content = await file.text();
  return parseAttachment({ name: file.name, mime, encoding: binary ? "base64" : "utf8", content });
}
