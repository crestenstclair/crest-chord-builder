import { capoFret, maximumCapo, handPositions, playingSetupLabel, absolutePosition } from "./fingering-settings.js";
import { esc, options } from "./ui.js";

export function fingeringControls(guitar) {
  const target = `data-guitar-id="${esc(guitar.id)}"`;
  const capos = Array.from({ length: maximumCapo(guitar) + 1 }, (_, fret) => [fret, fret === 0 ? "None" : `Fret ${fret}`]);
  return `<section class="fingering-settings no-print" aria-label="Fingering filters"><div class="fingering-filter-controls"><label class="inline-label">Capo<select aria-label="Capo" data-field="capo" ${target}>${options(capos, capoFret(guitar))}</select></label><label class="inline-label">Hand position<select aria-label="Hand position" data-field="hand-position" ${target}>${options(handPositions(guitar), absolutePosition(guitar.position, capoFret(guitar)))}</select></label><label class="open-strings-control"><input type="checkbox" aria-label="Allow open strings" data-field="allow-open" ${target} ${guitar.allowOpen === false ? "" : "checked"}>Allow open strings</label></div><p>${esc(playingSetupLabel(guitar))}. The hand position filters fingerings; the Frets control only moves the scale map.</p></section>`;
}
