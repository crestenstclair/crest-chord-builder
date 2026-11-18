// Usage: node composer/tests/guitar-web.mjs /path/to/guitar_tests
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { parseProject, getPlayableFingering } from '../../web/project.js';
import { parseReferenceSnapshot } from '../../web/reference-state.js';
import { playingTuning } from '../../web/fingering-settings.js';
import { soundingNotes } from '../../web/music.js';

const source = execFileSync(process.argv[2], ['--emit'], { encoding: 'utf8' });
const project = parseProject(source);
assert.equal(project.version, 3);
assert.deepEqual(parseReferenceSnapshot({ generation: 1, projectJSON: source }).project, project);
const guitar = project.guitars[0];
const chords = project.parts.flatMap(part => part.chords);
const pitches = chords.map(chord => {
  const grip = getPlayableFingering(chord, guitar);
  return grip && soundingNotes(playingTuning(guitar), grip).sort((a, b) => a - b);
});
assert.deepEqual(pitches, [[45, 52, 55, 60, 64], [52, 58, 62, 67], null, [64, 64]]);
assert.deepEqual(chords[2].intervals, [0, 1, 2]);
console.log('PASS: Builder and Reference accept native export; saved grips play the specified pitches');
