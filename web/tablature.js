import { pitchName } from "./music.js";
import { esc } from "./ui.js";
import { tabNotation } from "./tab-notation.js";

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
  // Standard tablature always shows the complete instrument, treble first.
  const strings = Array.from({ length: tab.tuning.length }, (_, i) => i + 1);
  return { perRow, first, bars, strings };
}

// Interpolate the cursor through the engraver's actual note positions.
export function tabPosition(beat, points) {
  const next = points.findIndex(([time]) => time > beat);
  if (next === 0) return points[0][1];
  if (next < 0) return points.at(-1)[1];
  const [a, x] = points[next - 1], [b, y] = points[next];
  return x + (y - x) * (beat - a) / (b - a);
}

// Both inputs have already passed the tab and visible-range validators.
export function tabPlaybackPlan(tab, options) {
  const barLength = tab.meter[0] * 4 / tab.meter[1];
  const startBeat = (options.first - tab.startBar) * barLength;
  const endBeat = startBeat + options.bars * barLength;
  const events = tab.events.filter((event) => event.beat < endBeat && event.beat + event.duration > startBeat)
    .map((event) => ({
      beat: Math.max(startBeat, event.beat),
      duration: Math.min(endBeat, event.beat + event.duration) - Math.max(startBeat, event.beat),
      midi: event.midi + tab.pitchShift,
    }));
  return { startBeat, endBeat, startBar: tab.startBar, meter: tab.meter, tempo: tab.tempo, events };
}

function playbackControls(tab, plan) {
  return `<div class="tab-transport no-print" role="group" aria-label="${esc(tab.title)} playback">
    <button type="button" class="primary tab-play" aria-label="Play tab">Play</button><button type="button" class="outlined tab-stop" aria-label="Stop tab">Stop</button>
    <label class="tab-tempo-label">Tempo <input class="tab-tempo" type="number" min="20" max="400" step="any" value="${tab.tempo}" aria-label="Playback tempo"> BPM</label>
    <input class="tab-seek" type="range" min="${plan.startBeat}" max="${plan.endBeat}" step="0.01" value="${plan.startBeat}" aria-label="Playback position">
    <output class="tab-position" aria-live="off"></output><span class="tab-playback-status" role="status">Ready</span></div>`;
}

export function renderTab(input, attributes = {}, currentTuning = null) {
  const tab = parseTab(input);
  const options = tabOptions(tab, attributes);
  const plan = tabPlaybackPlan(tab, options);
  const notation = tabNotation(tab, options);
  const systems = `<div class="tab-score" data-notation="${esc(JSON.stringify(notation))}"></div>`;
  const mismatch = currentTuning && currentTuning.join() !== tab.tuning.join();
  return `<section class="tablature" data-playback="${esc(JSON.stringify(plan))}"><header><h2>${esc(tab.title)}</h2><p>${tab.tempo} BPM · ${tab.meter.join("/")} · bars ${options.first}–${options.first + options.bars - 1}${tab.pitchShift ? ` · guitar output shift ${tab.pitchShift > 0 ? "+" : ""}${tab.pitchShift} semitones` : ""}</p><p class="tab-key">Standard tablature · treble string at top · tied notes sustain without another attack.</p>${mismatch ? `<p class="component-error">This tab uses a different tuning from the selected guitar. Its original string/fret positions are preserved.</p>` : ""}</header>${playbackControls(tab, plan)}${notation.rounded ? '<p class="tab-key">Notation rounds fine timing to a readable rhythmic grid. Playback retains the original timing.</p>' : ""}${systems}<footer>Open strings, treble to bass: ${esc([...tab.tuning].reverse().map(pitchName).join(" · "))}${tab.source ? `<br>${esc(tab.source)}` : ""}</footer></section>`;
}
