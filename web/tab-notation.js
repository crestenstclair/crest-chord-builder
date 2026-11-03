// Converts timed guitar events into independent notated voices. Playback keeps
// using the original events; only engraving may round unnotatable microtiming.
const EPSILON = 0.000001;

function rhythmValues() {
  const values = [];
  for (const denominator of [1, 2, 4, 8, 16, 32, 64, 128]) {
    const base = 128 / denominator;
    for (const dots of [0, 1, 2]) {
      const ticks = base * (2 - 1 / 2 ** dots);
      if (Number.isInteger(ticks)) values.push({ duration: String(denominator), dots, ticks, base });
    }
  }
  return values.sort((a, b) => b.ticks - a.ticks);
}
const RHYTHMS = rhythmValues();

function tripletBeats(events) {
  const groups = new Map();
  for (const point of events.flatMap((event) => [event.beat, event.beat + event.duration])) {
    const beat = Math.floor(point + EPSILON);
    if (!groups.has(beat)) groups.set(beat, []);
    groups.get(beat).push(point - beat);
  }
  return new Set([...groups].filter(([, points]) =>
    points.some((point) => Math.abs(point * 32 - Math.round(point * 32)) > EPSILON) &&
    points.every((point) => Math.abs(point * 48 - Math.round(point * 48)) < EPSILON)).map(([beat]) => beat));
}

function groupEvents(events, triplets) {
  let rounded = false;
  const groups = new Map();
  const snap = (point) => {
    const whole = Math.floor(point + EPSILON);
    const grid = triplets.has(whole) ? 48 : 32;
    const result = whole + Math.round((point - whole) * grid) / grid;
    if (Math.abs(result - point) > EPSILON) rounded = true;
    return result;
  };
  events.forEach((event, index) => {
    const start = snap(event.beat), end = snap(event.beat + event.duration);
    if (end <= start) throw new Error("Tab: a note is too short for readable notation (shorter than a 128th note or triplet). Its original MIDI data is unchanged.");
    const key = `${event.beat}:${event.duration}`;
    if (!groups.has(key)) groups.set(key, { id: String(index), start, end, sourceBeat: event.beat, sourceDuration: event.duration, positions: [] });
    groups.get(key).positions.push({ str: event.string, fret: event.fret, midi: event.midi });
  });
  return { groups: [...groups.values()], rounded };
}

function allocateVoices(groups) {
  const voices = [];
  for (const group of groups) {
    let voice = voices.find((notes) => notes.at(-1).end <= group.start + EPSILON);
    if (!voice) { voice = []; voices.push(voice); }
    voice.push(group);
  }
  return voices.length ? voices : [[]];
}

function splitRhythm(start, end, barStart, triplet, group) {
  const factor = triplet ? 1.5 : 1;
  const origin = triplet ? Math.floor(start + EPSILON) : barStart;
  let offset = Math.round((start - origin) * 32 * factor);
  let remaining = Math.round((end - start) * 32 * factor);
  const result = [];
  while (remaining > 0) {
    // An off-beat fragment ends at the next beat, then ties into larger values.
    // Otherwise greedy dotted values turn a simple syncopation into tiny ties.
    const available = offset % 32 ? Math.min(remaining, 32 - offset % 32) : remaining;
    const rhythm = RHYTHMS.find((value) => value.ticks <= available && offset % Math.min(32, value.base) === 0);
    if (!rhythm) throw new Error("Tab: this rhythm could not be notated.");
    const beat = origin + offset / (32 * factor);
    result.push({ ...rhythm, beat, length: rhythm.ticks / (32 * factor), triplet: triplet ? origin : null, group });
    offset += rhythm.ticks;
    remaining -= rhythm.ticks;
  }
  return result;
}

function notateSpan(start, end, barStart, triplets, group = null) {
  const result = [];
  let cursor = start;
  while (cursor < end - EPSILON) {
    const triplet = triplets.has(Math.floor(cursor + EPSILON));
    let boundary = Math.min(end, Math.floor(cursor + EPSILON) + 1);
    if (!triplet) while (boundary < end - EPSILON && !triplets.has(Math.floor(boundary + EPSILON))) boundary = Math.min(end, boundary + 1);
    result.push(...splitRhythm(cursor, boundary, barStart, triplet, group));
    cursor = boundary;
  }
  return result;
}

function voiceMeasure(voice, start, end, triplets) {
  const notes = voice.filter((note) => note.start < end - EPSILON && note.end > start + EPSILON);
  if (!notes.length) return [{ beat: start, length: end - start, duration: "1", dots: 0, group: null, wholeRest: true, triplet: null }];
  const result = [];
  let cursor = start;
  for (const note of notes) {
    const onset = Math.max(start, note.start), finish = Math.min(end, note.end);
    if (onset > cursor + EPSILON) result.push(...notateSpan(cursor, onset, start, triplets));
    result.push(...notateSpan(onset, finish, start, triplets, note));
    cursor = finish;
  }
  if (cursor < end - EPSILON) result.push(...notateSpan(cursor, end, start, triplets));
  return result;
}

export function tabNotation(tab, options) {
  const triplets = tripletBeats(tab.events);
  const { groups, rounded } = groupEvents(tab.events, triplets);
  const voices = allocateVoices(groups);
  const voiceTriplets = voices.map((voice) => tripletBeats(voice.map((group) => ({ beat: group.start, duration: group.end - group.start }))));
  const barLength = tab.meter[0] * 4 / tab.meter[1];
  const measures = Array.from({ length: options.bars }, (_, index) => {
    const number = options.first + index;
    const start = (number - tab.startBar) * barLength;
    return { number, start, end: start + barLength, voices: voices.map((voice, i) => voiceMeasure(voice, start, start + barLength, voiceTriplets[i])) };
  });
  return { tuning: tab.tuning, meter: tab.meter, title: tab.title, perRow: options.perRow, measures, rounded };
}
