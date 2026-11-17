// Keep existing snapshots/engine coordinates unchanged; the UI uses absolute frets.
export const capoFret = (guitar) => guitar.capo ?? 0;
export const lastFret = (guitar) => 24 - capoFret(guitar);
export const playingTuning = (guitar) => guitar.strings.map((pitch) => pitch + capoFret(guitar));
export const maximumCapo = (guitar) => Math.min(12, 103 - Math.max(...guitar.strings));
export const absoluteFret = (fret, capo = 0) => fret < 0 ? fret : Number(fret) + capo;
export const relativeFret = (fret, capo = 0) => Number(fret) - capo;
export const absolutePosition = (position = "any", capo = 0) => position === "any" ? position : absoluteFret(position, capo);
export const relativePosition = (position, capo = 0) => position === "any" ? position : relativeFret(position, capo);
export const absoluteFrets = (frets, capo = 0) => frets?.map((fret) => absoluteFret(fret, capo));
export const fretValues = (frets, capo = 0) => absoluteFrets(frets, capo)?.map((fret) => fret < 0 ? "×" : fret).join(" ");

export function parseGuitarSettings(value, strings) {
  const settings = {};
  if (value.capo !== undefined) {
    if (!Number.isInteger(value.capo) || value.capo < 0 || value.capo > maximumCapo({ strings }))
      throw new Error("Capo must be a fret from 0 to 12, with sounding open pitches no higher than MIDI 103.");
    settings.capo = value.capo;
  }
  if (value.position !== undefined) {
    if (value.position !== "any" && (!Number.isInteger(value.position) || value.position < 0 || value.position > lastFret(settings) - 3))
      throw new Error("Hand position must fit four frets above the capo, within physical fret 24.");
    settings.position = value.position;
  }
  if (value.allowOpen !== undefined) {
    if (typeof value.allowOpen !== "boolean") throw new Error("Allow open strings must be true or false.");
    settings.allowOpen = value.allowOpen;
  }
  return settings;
}

export function fingeringOptions(guitar) {
  const position = guitar.position ?? "any";
  const minFret = position === "any" ? 0 : Number(position);
  return {
    minFret,
    maxFret: position === "any" ? lastFret(guitar) : minFret === 0 ? 4 : minFret + 3,
    excludeOpen: guitar.allowOpen === false,
  };
}

export function fingeringMatchesSettings(frets, guitar) {
  if (!frets?.some((fret) => fret >= 0)) return false;
  const { minFret, maxFret, excludeOpen } = fingeringOptions(guitar);
  return frets.every((fret) => fret === -1 || (fret === 0
    ? !excludeOpen
    : fret >= Math.max(1, minFret) && fret <= maxFret));
}

export function handPositions(guitar) {
  const capo = capoFret(guitar);
  return [["any", "Any"], ...Array.from({ length: lastFret(guitar) - 2 }, (_, fret) => {
    const start = absoluteFret(fret, capo);
    return [start, `${start}–${start + (fret === 0 ? 4 : 3)}`];
  })];
}

export function fretWindows(guitar) {
  return Array.from({ length: lastFret(guitar) - 11 }, (_, fret) => {
    const start = absoluteFret(fret, capoFret(guitar));
    return [start, `${start}–${start + 12}`];
  });
}

export function playingSetupLabel(guitar) {
  const capo = capoFret(guitar);
  const position = guitar.position ?? "any";
  const { minFret, maxFret, excludeOpen } = fingeringOptions(guitar);
  return `${capo ? `Capo at fret ${capo}` : "No capo"} · absolute frets from the nut · ${position === "any" ? "any hand position" : `hand position ${absoluteFret(minFret, capo)}–${absoluteFret(maxFret, capo)}`} · ${excludeOpen ? "no open strings" : "open strings allowed"} · concert-pitch chords`;
}

export const hasFingeringFilters = (guitar) => capoFret(guitar) > 0 ||
  (guitar.position !== undefined && guitar.position !== "any") || guitar.allowOpen === false;
