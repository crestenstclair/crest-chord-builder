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

// Every option accounts for all sounding pitches. A rootless interpretation's
// key check includes its implied root, even though that note is not played.
// At most one reading per root keeps the list bounded. Fewer than two distinct
// pitches cannot establish a chord name.
export function chordNameOptions(tuning, frets, keyTones, preferredRoot) {
  const pitches = unique(soundingNotes(tuning, frets).map(mod12));
  if (pitches.length < 2) return [];
  const options = Array.from({ length: 12 }, (_, root) => nameOption(tuning, frets, root, keyTones))
    .filter((option) => option.rank < 4);
  if (!options.length) return [nameOption(tuning, frets, preferredRoot, keyTones)];
  return options.sort((a, b) => a.rank - b.rank || Number(b.inKey) - Number(a.inKey)
    || Number(b.root === preferredRoot) - Number(a.root === preferredRoot)
    || Number(b.root === b.bass) - Number(a.root === a.bass) || a.root - b.root);
}
