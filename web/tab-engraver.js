import "./vendor/vexflow.js";

const { Renderer, TabStave, TabNote, StaveNote, GhostNote, Voice, Formatter, Fraction, Dot, Beam, Tuplet, TabTie } = globalThis.Vex.Flow;
const EPSILON = 0.000001;

function notatedVoice(tokens, meter, voiceIndex) {
  const notes = tokens.map((token) => {
    const properties = { duration: token.duration, dots: token.dots };
    let note;
    if (token.group) {
      note = new TabNote({ ...properties, positions: token.group.positions, stem_direction: voiceIndex ? -1 : 1 }, true);
    } else if (voiceIndex && token.wholeRest) {
      note = new GhostNote(properties);
    } else {
      note = new StaveNote({ ...properties, keys: [voiceIndex ? "d/4" : "b/4"], duration: `${token.duration}r`, align_center: Boolean(token.wholeRest) });
    }
    if (token.wholeRest) note.setDuration(new Fraction(meter[0], meter[1]));
    for (let i = 0; i < token.dots; i++) Dot.buildAndAttach([note], { index: 0 });
    return note;
  });
  const triplets = new Map();
  tokens.forEach((token, index) => {
    if (token.triplet === null) return;
    if (!triplets.has(token.triplet)) triplets.set(token.triplet, []);
    triplets.get(token.triplet).push(notes[index]);
  });
  const tuplets = [...triplets.values()].map((group) => new Tuplet(group, {
    num_notes: 3, notes_occupied: 2, bracketed: true, location: voiceIndex ? -1 : 1,
  }));
  const voice = new Voice({ num_beats: meter[0], beat_value: meter[1] }).addTickables(notes);
  const beams = Beam.generateBeams(notes, { stem_direction: voiceIndex ? -1 : 1,
    groups: Beam.getDefaultBeamGroups(meter.join("/")) });
  return { voice, notes, tokens, beams, tuplets };
}

function makeMeasure(measure, model, first) {
  const voices = measure.voices.map((tokens, index) => notatedVoice(tokens, model.meter, index));
  const formatter = new Formatter();
  voices.forEach(({ voice }) => formatter.joinVoices([voice]));
  const minimum = formatter.preCalculateMinTotalWidth(voices.map(({ voice }) => voice));
  // Reserve clef/meter space and enough room for flags, ties and bar numbers.
  return { ...measure, voices, formatter, width: Math.max(150, minimum + (first ? 125 : 45)) };
}

function drawTie(context, first, last) {
  const positions = (first ?? last).getPositions().map((_, index) => index);
  new TabTie({ first_note: first, last_note: last, first_indices: positions, last_indices: positions })
    .setContext(context).draw();
}

function drawSystem(measures, model, systemIndex) {
  const host = document.createElement("div");
  const renderer = new Renderer(host, Renderer.Backends.SVG);
  const context = renderer.getContext();
  context.setFillStyle("currentColor").setStrokeStyle("currentColor").setBackgroundFillStyle("var(--surface)");
  const width = Math.max(1000, measures.reduce((sum, measure) => sum + measure.width, 0) + 20);
  const extra = (width - 20 - measures.reduce((sum, measure) => sum + measure.width, 0)) / measures.length;
  const polyphonic = measures.some((measure) => measure.voices.length > 1);
  const height = 105 + model.tuning.length * 13 + (polyphonic ? 45 : 0);
  renderer.resize(width, height);
  const points = new Map();
  const fragments = new Map();
  let x = 10;
  for (const [measureIndex, measure] of measures.entries()) {
    const stave = new TabStave(x, 25, measure.width + extra, { num_lines: model.tuning.length });
    if (measureIndex === 0) {
      stave.addClef("tab");
      if (systemIndex === 0) stave.addTimeSignature(model.meter.join("/"));
    }
    stave.setStyle({ strokeStyle: "currentColor", fillStyle: "currentColor" });
    stave.setMeasure(measure.number).setContext(context).draw();
    measure.voices.forEach(({ notes }) => notes.forEach((note) => note.setStave(stave)));
    measure.formatter.formatToStave(measure.voices.map(({ voice }) => voice), stave);
    for (const { voice, notes, tokens, beams, tuplets } of measure.voices) {
      voice.draw(context, stave);
      beams.forEach((beam) => beam.setContext(context).draw());
      tuplets.forEach((tuplet) => tuplet.setContext(context).draw());
      notes.forEach((note, index) => {
        const token = tokens[index];
        points.set(token.beat, token.wholeRest ? stave.getNoteStartX() + 10 : note.getAbsoluteX() + note.getGlyphWidth() / 2);
        if (!token.group) return;
        const element = host.querySelector(`[id="vf-${note.getAttribute("id")}"]`);
        element.classList.add("tab-note");
        // Highlight this fragment only; ties do not create new playback attacks.
        element.dataset.beat = Math.max(token.beat, token.group.sourceBeat);
        element.dataset.duration = Math.min(token.beat + token.length, token.group.sourceBeat + token.group.sourceDuration) - Number(element.dataset.beat);
        element.dataset.midi = token.group.positions.map((position) => position.midi).join(",");
        element.dataset.attack = String(Math.abs(token.beat - token.group.start) < EPSILON);
        if (!fragments.has(token.group.id)) fragments.set(token.group.id, []);
        fragments.get(token.group.id).push({ note, token });
      });
    }
    points.set(measure.end, x + measure.width + extra - 4);
    x += measure.width + extra;
  }
  for (const group of fragments.values()) {
    const first = group[0], last = group.at(-1);
    if (first.token.beat > first.token.group.start + EPSILON) drawTie(context, undefined, first.note);
    for (let i = 1; i < group.length; i++) drawTie(context, group[i - 1].note, group[i].note);
    if (last.token.beat + last.token.length < last.token.group.end - EPSILON) drawTie(context, last.note, undefined);
  }
  const svg = host.querySelector("svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.removeAttribute("style");
  svg.classList.add("tab-system");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `${model.title}, ${model.tuning.length}-string tablature, bars ${measures[0].number}–${measures.at(-1).number}`);
  svg.dataset.start = measures[0].start;
  svg.dataset.end = measures.at(-1).end;
  svg.dataset.strings = model.tuning.length;
  svg.dataset.positions = JSON.stringify([...points].sort(([a], [b]) => a - b));
  const cursor = document.createElementNS("http://www.w3.org/2000/svg", "line");
  cursor.setAttribute("class", "tab-playhead no-print");
  cursor.setAttribute("y1", "25");
  cursor.setAttribute("y2", String(height - 20));
  cursor.style.display = "none";
  svg.append(cursor);
  return svg;
}

// Called only on markup generated by renderTab. The detached renderer receives
// parsed musical data, never imported HTML or scripts from the practice sheet.
export function engraveTab(fragment) {
  const score = fragment.querySelector(".tab-score");
  const model = JSON.parse(score.dataset.notation);
  delete score.dataset.notation;
  for (let index = 0; index < model.measures.length; index += model.perRow) {
    const measures = model.measures.slice(index, index + model.perRow)
      .map((measure, i) => makeMeasure(measure, model, i === 0));
    score.append(drawSystem(measures, model, index / model.perRow));
  }
}
