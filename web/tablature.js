import { pitchName } from "./music.js";
import { esc } from "./ui.js";

const fail = (message) => { throw new Error(`Tab: ${message}`); };
function integer(value, min, max, name) {
  if (!Number.isInteger(value) || value < min || value > max) fail(`${name} must be ${min}–${max}.`);
  return value;
}

export function parseTab(input) {
  const value = typeof input === "string" ? JSON.parse(input) : input;
  if (!value || value.format !== "crest-tab" || value.version !== 1) fail("expected crest-tab version 1.");
  if (!Array.isArray(value.tuning) || value.tuning.length < 1 || value.tuning.length > 8) fail("use 1–8 strings.");
  const tuning = value.tuning.map((n) => integer(n, 0, 103, "Open MIDI pitch"));
  if (!Array.isArray(value.meter) || value.meter.length !== 2 || ![2, 4, 8, 16].includes(value.meter[1])) fail("invalid meter.");
  const meter = [integer(value.meter[0], 1, 16, "Meter numerator"), value.meter[1]];
  const bars = integer(value.bars, 1, 256, "Bar count");
  const startBar = integer(value.startBar ?? 1, 1, 100000, "Start bar");
  if (typeof value.title !== "string" || value.title.length > 120) fail("title must be text up to 120 characters.");
  if (typeof value.source !== "undefined" && (typeof value.source !== "string" || value.source.length > 2000)) fail("invalid source description.");
  if (!Number.isFinite(value.tempo) || value.tempo < 20 || value.tempo > 400) fail("tempo must be 20–400 BPM.");
  if (!Array.isArray(value.events) || value.events.length > 4096) fail("use at most 4096 events.");
  const length = bars * meter[0] * 4 / meter[1];
  const events = value.events.map((event) => parseEvent(event, tuning, length)).sort((a, b) => a.beat - b.beat || a.string - b.string);
  const ends = new Map();
  for (const event of events) {
    if ((ends.get(event.string) ?? 0) > event.beat + 0.000001) fail(`overlapping notes on string ${event.string}.`);
    ends.set(event.string, event.beat + event.duration);
  }
  return { format: "crest-tab", version: 1, title: value.title, source: value.source ?? "", tuning, meter, tempo: value.tempo, startBar, bars, pitchShift: integer(value.pitchShift ?? 0, -24, 24, "Pitch shift"), events };
}

function parseEvent(event, tuning, length) {
  if (!event || typeof event !== "object") fail("invalid event.");
  const string = integer(event.string, 1, tuning.length, "String number");
  const fret = integer(event.fret, 0, 24, "Fret");
  if (!Number.isFinite(event.beat) || event.beat < 0 || event.beat >= length ||
      !Number.isFinite(event.duration) || event.duration <= 0 || event.beat + event.duration > length + 0.000001)
    fail("event timing must fit inside the tab; beat and duration use quarter notes.");
  const midi = tuning[tuning.length - string] + fret;
  if (event.midi !== undefined && event.midi !== midi) fail("MIDI pitch does not match its string and fret.");
  return { beat: event.beat, duration: event.duration, string, fret, midi };
}

function tabOptions(tab, attributes) {
  const perRow = integer(Number(attributes["bars-per-row"] ?? 4), 1, 8, "Bars per row");
  const first = integer(Number(attributes["from-bar"] ?? tab.startBar), tab.startBar, tab.startBar + tab.bars - 1, "First bar");
  const bars = integer(Number(attributes.bars ?? tab.startBar + tab.bars - first), 1, tab.startBar + tab.bars - first, "Visible bars");
  const strings = attributes.strings
    ? attributes.strings.split(",").map((n) => integer(Number(n.trim()), 1, tab.tuning.length, "Visible string"))
    : Array.from({ length: tab.tuning.length }, (_, i) => i + 1);
  if (new Set(strings).size !== strings.length) fail("visible strings must be unique.");
  strings.sort((a, b) => a - b);
  const firstBeat = (first - tab.startBar) * tab.meter[0] * 4 / tab.meter[1];
  const lastBeat = firstBeat + bars * tab.meter[0] * 4 / tab.meter[1];
  if (tab.events.some((e) => e.beat < lastBeat && e.beat + e.duration > firstBeat && !strings.includes(e.string)))
    fail("visible strings would hide notes. Include every played string.");
  return { perRow, first, bars, strings };
}

function noteMark(event, context) {
  const { x, start, end, strings } = context;
  if (event.beat >= end || event.beat + event.duration <= start) return "";
  const y = 64 + strings.indexOf(event.string) * 24;
  const left = x(Math.max(start, event.beat));
  const right = x(Math.min(end, event.beat + event.duration));
  const attack = event.beat >= start;
  return `<g class="tab-note" data-midi="${event.midi}" data-beat="${event.beat}" data-duration="${event.duration}" data-string="${event.string}" data-fret="${event.fret}"><title>${esc(pitchName(event.midi))}, string ${event.string}, fret ${event.fret}; start ${event.beat}, duration ${event.duration} quarter notes</title><path class="tab-duration" d="M${left + (attack ? 11 : 0)} ${y + 7} H${right - 3}"/>${attack ? `<text class="tab-fret" x="${left}" y="${y + 5}">${event.fret}</text>` : `<text class="tab-hold" x="${left + 7}" y="${y - 5}">hold</text>`}</g>`;
}

function tabSystem(tab, options, offset) {
  const count = Math.min(options.perRow, options.bars - offset);
  const barLength = tab.meter[0] * 4 / tab.meter[1];
  const start = (options.first - tab.startBar + offset) * barLength;
  const end = start + count * barLength;
  const width = 1000, left = 70, barWidth = (width - left - 20) / count;
  const height = 95 + (options.strings.length - 1) * 24;
  // Keep a margin at bar boundaries so fret numbers never collide with barlines.
  const x = (beat) => {
    const relative = (beat - start) / barLength;
    const bar = Math.min(count - 1, Math.floor(relative));
    return left + bar * barWidth + 17 + (relative - bar) * (barWidth - 30);
  };
  const strings = options.strings.map((string, row) => {
    const y = 64 + row * 24;
    return `<text class="tab-tuning" x="4" y="${y + 5}">${string} · ${esc(pitchName(tab.tuning[tab.tuning.length - string]))}</text><line x1="${left}" x2="${width - 20}" y1="${y}" y2="${y}"/>`;
  }).join("");
  const measures = Array.from({ length: count }, (_, bar) => {
    const number = options.first + offset + bar;
    const ticks = Array.from({ length: tab.meter[0] }, (_, beat) => `<text class="tab-beat" x="${x(start + (bar * tab.meter[0] + beat) * 4 / tab.meter[1])}" y="39">${beat + 1}</text>`).join("");
    return `<text class="tab-bar" x="${left + bar * barWidth + 6}" y="17">${number}</text><line class="tab-barline" x1="${left + bar * barWidth}" x2="${left + bar * barWidth}" y1="48" y2="${height - 20}"/>${ticks}`;
  }).join("");
  const notes = tab.events.map((event) => noteMark(event, { x, start, end, strings: options.strings })).join("");
  return `<svg class="tab-system" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(tab.title)}; bars ${options.first + offset}–${options.first + offset + count - 1}"><g class="tab-lines">${strings}${measures}</g>${notes}</svg>`;
}

export function renderTab(input, attributes = {}, currentTuning = null) {
  const tab = parseTab(input);
  const options = tabOptions(tab, attributes);
  const systems = Array.from({ length: Math.ceil(options.bars / options.perRow) }, (_, i) => tabSystem(tab, options, i * options.perRow)).join("");
  const mismatch = currentTuning && currentTuning.join() !== tab.tuning.join();
  return `<section class="tablature"><header><h2>${esc(tab.title)}</h2><p>${tab.tempo} BPM · ${tab.meter.join("/")} · bars ${options.first}–${options.first + options.bars - 1}${tab.pitchShift ? ` · guitar output shift ${tab.pitchShift > 0 ? "+" : ""}${tab.pitchShift} semitones` : ""}</p><p class="tab-key">Frets shown at note attacks; lines show duration. “hold” continues a note from the previous row. Empty measures are rests.</p>${mismatch ? `<p class="component-error">This tab uses a different tuning from the selected guitar. Its original string/fret positions are preserved.</p>` : ""}</header>${systems}<footer>Open strings, treble to bass: ${esc([...tab.tuning].reverse().map(pitchName).join(" · "))}${tab.source ? `<br>${esc(tab.source)}` : ""}</footer></section>`;
}
