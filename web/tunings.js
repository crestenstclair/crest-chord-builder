// Physical string order in stored data stays bass-side to treble-side.
// The interface reverses the rows and numbers the treble string as string 1.
export const PRESETS = {
  standard: { name: "E standard", strings: [40, 45, 50, 55, 59, 64] },
  dropd: { name: "Drop D", strings: [38, 45, 50, 55, 59, 64] },
  dropc: { name: "Drop C", strings: [36, 43, 48, 53, 57, 62] },
  dstandard: { name: "D standard", strings: [38, 43, 48, 53, 57, 62] },
  dadgad: { name: "DADGAD", strings: [38, 45, 50, 55, 57, 62] },
  openD: { name: "Open D", strings: [38, 45, 50, 54, 57, 62] },
  openG: { name: "Open G", strings: [38, 43, 50, 55, 59, 62] },
  seven: { name: "B standard", strings: [35, 40, 45, 50, 55, 59, 64] },
  sevenDropA: { name: "Drop A", strings: [33, 40, 45, 50, 55, 59, 64] },
  sevenA: { name: "A standard", strings: [33, 38, 43, 48, 53, 57, 62] },
  sevenDropG: { name: "Drop G", strings: [31, 38, 43, 48, 53, 57, 62] },
  sevenFourths: { name: "All fourths", strings: [35, 40, 45, 50, 55, 60, 65] },
  sevenOpenC: { name: "Open C", strings: [31, 36, 43, 48, 55, 60, 64] },
  eight: { name: "F♯ standard", strings: [30, 35, 40, 45, 50, 55, 59, 64] },
  eightDropE: { name: "Drop E", strings: [28, 35, 40, 45, 50, 55, 59, 64] },
  eightF: { name: "F standard", strings: [29, 34, 39, 44, 49, 54, 58, 63] },
  eightE: { name: "E standard", strings: [28, 33, 38, 43, 48, 53, 57, 62] },
  eightDropD: {
    name: "Drop D (Drop E, down a tone)",
    strings: [26, 33, 38, 43, 48, 53, 57, 62],
  },
  eightDoubleDrop: {
    name: "Double drop E/A",
    strings: [28, 33, 40, 45, 50, 55, 59, 64],
  },
  eightFourths: {
    name: "All fourths",
    strings: [30, 35, 40, 45, 50, 55, 60, 65],
  },
};

export function presetsForCount(count) {
  return Object.entries(PRESETS).filter(
    ([, preset]) => preset.strings.length === count,
  );
}

export function resizeTuning(strings, count) {
  if (![6, 7, 8].includes(count)) throw new Error("Choose 6, 7, or 8 strings.");
  const next = strings.slice(-count);
  while (next.length < count) next.unshift(Math.max(0, next[0] - 5));
  return next;
}
