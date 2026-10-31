export const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const icon = (name, size = 18) => {
  const paths = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    tune: '<path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    display:
      '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5"/>',
    upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"/>',
    print: '<path d="M7 8V3h10v5M7 17H3V8h18v9h-4M7 14h10v7H7z"/>',
    expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    edit: '<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14z"/>',
    left: '<path d="m14 6-6 6 6 6"/>',
    right: '<path d="m10 6 6 6-6 6"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    undo: '<path d="M4 10h10a6 6 0 0 1 0 12M4 10l5-5m-5 5 5 5"/>',
    play: '<path d="m8 4 12 8-12 8z"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
};
export const options = (entries, selected) =>
  entries
    .map(
      ([value, name]) =>
        `<option value="${esc(value)}" ${String(value) === String(selected) ? "selected" : ""}>${esc(name)}</option>`,
    )
    .join("");
export const button = (action, label, symbol, cls = "", attrs = "") =>
  `<button type="button" data-action="${action}" class="${cls}" ${attrs}>${symbol ? icon(symbol) : ""}${label}</button>`;

export function downloadJSON(project) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(project, null, 2) + "\n"], {
      type: "application/json",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${project.title.replace(/[^a-z0-9_-]/gi, "-").slice(0, 80) || "chords"}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

let audio;
let audition = 0;
const playing = new Set();
export async function playNotes(midis) {
  // An empty preview unlocks audio from a user gesture and silences any
  // previous voicing while an asynchronous fingering search is running.
  const version = ++audition;
  audio ??= new AudioContext();
  await audio.resume();
  if (version !== audition) return;
  for (const voice of playing) {
    try {
      voice.stop();
    } catch {}
  }
  playing.clear();
  midis.forEach((midi, i) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = audio.currentTime + i * 0.045;
    oscillator.type = "triangle";
    playing.add(oscillator);
    oscillator.onended = () => playing.delete(oscillator);
    oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(
      0.14 / Math.sqrt(midis.length),
      start + 0.015,
    );
    gain.gain.exponentialRampToValueAtTime(0.001, start + 1.4);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + 1.5);
  });
}
