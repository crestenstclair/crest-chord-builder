import { chordQuality, describeFingering, mod12, soundingNotes, unique } from "./music.js";

function nameOption(tuning, frets, root, keyTones) {
  const { intervals, bass } = describeFingering(tuning, frets, root);
  const chord = { root, intervals, bass };
  const quality = chordQuality(chord);
  const fullIntervals = quality.intervals ?? unique([
    ...intervals, ...quality.omissions.map((interval) => interval === "1" ? 0 : 7),
  ]);
  const fullTones = fullIntervals.map((interval) => mod12(root + interval));
  const playedTones = intervals.map((interval) => mod12(root + interval));
  const impliedTones = fullTones.filter((tone) => !playedTones.includes(tone));
  return {
    ...chord,
    impliedTones,
    inKey: fullTones.every((tone) => keyTones.includes(tone)),
    // Complete catalog matches lead; alterations and omitted-tone readings follow.
    rank: quality.name === "Custom chord" ? 4
      : impliedTones.length ? (quality.intervals ? 2 : 3) : quality.intervals ? 0 : 1,
  };
}

// Every suggested root must be played. Omitted fifths remain valid, and their
// implied pitches still count toward key membership. At most one reading per
// root keeps the list bounded. Fewer than two distinct pitches cannot name a chord.
export function chordNameOptions(tuning, frets, keyTones, preferredRoot) {
  const pitches = unique(soundingNotes(tuning, frets).map(mod12));
  if (pitches.length < 2) return [];
  const options = pitches.map((root) => nameOption(tuning, frets, root, keyTones))
    .filter((option) => option.rank < 4);
  if (!options.length) {
    const root = pitches.includes(preferredRoot) ? preferredRoot
      : describeFingering(tuning, frets, preferredRoot).bass;
    return [nameOption(tuning, frets, root, keyTones)];
  }
  return options.sort((a, b) => a.rank - b.rank || Number(b.inKey) - Number(a.inKey)
    || Number(b.root === preferredRoot) - Number(a.root === preferredRoot)
    || Number(b.root === b.bass) - Number(a.root === a.bass) || a.root - b.root);
}
