import test from "node:test";
import assert from "node:assert/strict";
import { createProject, makeChord, parseProject, getFingering, getPlayableFingering, setFingering } from "../web/project.js";
import { playingTuning, lastFret, fingeringOptions, fingeringMatchesSettings, handPositions, fretWindows, absoluteFret, relativeFret, absolutePosition, relativePosition, absoluteFrets, fretValues } from "../web/fingering-settings.js";
import { soundingNotes, mod12 } from "../web/music.js";
import { chordBox, fretboard } from "../web/diagrams.js";

test("capo changes sounding tuning, not the guitar's base tuning or concert-pitch harmony", () => {
  const guitar = { ...createProject().guitars[0], capo: 2 };
  assert.deepEqual(playingTuning(guitar), [42, 47, 52, 57, 61, 66]);
  assert.deepEqual(guitar.strings, [40, 45, 50, 55, 59, 64]);
  assert.equal(lastFret(guitar), 22);
  const notes = soundingNotes(playingTuning(guitar), [3, 5, 3, 3, 3, 3]);
  assert.deepEqual([...new Set(notes.map(mod12))].sort((a, b) => a - b), [0, 4, 7, 9]);
});

test("hand positions restrict all fretted notes, with explicit control of open-at-capo strings", () => {
  const guitar = { ...createProject().guitars[0], capo: 2, position: 7 };
  assert.deepEqual(fingeringOptions(guitar), { minFret: 7, maxFret: 10, excludeOpen: false });
  assert.equal(fingeringMatchesSettings([-1, 0, 7, 8, 9, 10], guitar), true);
  assert.equal(fingeringMatchesSettings([-1, 0, 6, 8, 9, 10], guitar), false);
  assert.equal(fingeringMatchesSettings([-1, 0, 7, 8, 9, 11], guitar), false);
  guitar.allowOpen = false;
  assert.equal(fingeringMatchesSettings([-1, 0, 7, 8, 9, 10], guitar), false);
  assert.equal(fingeringMatchesSettings([-1, -1, 7, 8, 9, 10], guitar), true);
  assert.equal(fingeringMatchesSettings(Array(6).fill(-1), guitar), false);
  assert.equal(fingeringMatchesSettings(null, guitar), false);
});

test("capo snapshots preserve and restore the original no-capo fingering", () => {
  const guitar = createProject().guitars[0];
  const chord = makeChord(9, "min7");
  const original = [-1, 0, 2, 0, 1, 0];
  setFingering(chord, guitar.strings, original);
  guitar.capo = 2;
  assert.equal(getPlayableFingering(chord, guitar), null);
  const capoGrip = [3, 5, 3, 3, 3, 3];
  setFingering(chord, playingTuning(guitar), capoGrip);
  assert.deepEqual(getPlayableFingering(chord, guitar), capoGrip);
  guitar.position = 7;
  assert.equal(getPlayableFingering(chord, guitar), null);
  assert.deepEqual(getFingering(chord, playingTuning(guitar)), capoGrip);
  guitar.capo = 0;
  guitar.position = "any";
  assert.deepEqual(getPlayableFingering(chord, guitar), original);
});

test("capo and filter settings round trip; old projects retain their defaults without mutation", () => {
  const doc = createProject();
  const before = structuredClone(doc);
  assert.deepEqual(parseProject(doc), before);
  Object.assign(doc.guitars[0], { capo: 12, position: 9, allowOpen: false });
  assert.deepEqual(parseProject(JSON.stringify(doc)), doc);
  for (const settings of [
    { capo: -1 }, { capo: 13 }, { capo: 1.5 }, { capo: "2" },
    { position: -1 }, { position: 22 }, { position: "5" }, { position: null },
    { capo: 12, position: 10 }, { allowOpen: "false" }, { allowOpen: null },
    { capo: 2, strings: [102] },
  ]) {
    const invalid = structuredClone(before);
    Object.assign(invalid.guitars[0], settings);
    assert.throws(() => parseProject(invalid));
  }
});

test("position and scale-window choices cannot extend beyond physical fret 24", () => {
  const guitar = { ...createProject().guitars[0], capo: 12 };
  assert.deepEqual(fretWindows(guitar), [[12, "12–24"]]);
  assert.deepEqual(handPositions(guitar)[1], [12, "12–16"]);
  assert.deepEqual(handPositions(guitar).at(-1), [21, "21–24"]);
  assert.deepEqual(fingeringOptions(guitar), { minFret: 0, maxFret: 12, excludeOpen: false });
  assert.equal(fingeringMatchesSettings([-1, 13, -1, -1, -1, -1], guitar), false);
  assert.equal(fingeringMatchesSettings([-1, 12, -1, -1, -1, -1], guitar), true);
});

test("diagrams, accessible labels and fretboard inputs use absolute physical frets", () => {
  const guitar = { ...createProject().guitars[0], capo: 2 };
  const tuning = playingTuning(guitar);
  const diagram = chordBox(tuning, [3, 5, 3, 3, 3, 3], 9, "Am7", false, "intervals", makeChord(9, "min7"), 2);
  assert.match(diagram, /frets 5, 7, 5, 5, 5, 5/);
  assert.match(diagram, /Capo at fret 2; absolute frets from the nut/);
  const map = fretboard(tuning, [6], 6, { capo: 2, editing: true });
  assert.match(map, /String 6, fret 2: F♯2/);
  assert.match(map, /data-fret="2"/);
  assert.doesNotMatch(map, /data-fret="[01]"/);
  assert.doesNotMatch(map, /relative frets/);
});

test("absolute-fret UI conversions preserve saved shapes, mute marks and open-at-capo notes", () => {
  const saved = [-1, 0, 3, 5];
  assert.deepEqual(absoluteFrets(saved, 2), [-1, 2, 5, 7]);
  assert.equal(fretValues(saved, 2), "× 2 5 7");
  assert.deepEqual(saved, [-1, 0, 3, 5]);
  assert.equal(absoluteFret(0, 2), 2);
  assert.equal(relativeFret(7, 2), 5);
  assert.equal(absolutePosition(5, 2), 7);
  assert.equal(relativePosition("7", 2), 5);
  assert.equal(absolutePosition("any", 12), "any");
  assert.equal(relativePosition("any", 12), "any");
  assert.equal(fretValues(null, 2), undefined);
});
