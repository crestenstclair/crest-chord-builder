import { describeFingering, mod12 } from "./music.js";

// The worker keeps the existing Go search off the interface thread. Requests
// share promises by tuning + chord, and callers discard stale selections.
let worker;
let sequence = 0;
const pending = new Map();
const cache = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./engine/worker.js", import.meta.url));
  worker.onmessage = ({ data }) => {
    const job = pending.get(data.id);
    if (!job) return;
    pending.delete(data.id);
    if (data.error) job.reject(new Error(data.error));
    else job.resolve(data.voicings);
  };
  worker.onerror = () => {
    for (const job of pending.values())
      job.reject(new Error("Voicing engine failed. Reload the page to retry."));
    pending.clear();
    cache.clear();
    worker.terminate();
    worker = null;
  };
  return worker;
}

export function findVoicings(
  tuning,
  chord,
  { minFret = 0, maxFret = 24, anchors = [] } = {},
) {
  if (chord.intervals.length > 7) return Promise.resolve([]);
  const request = {
    openMidi: tuning,
    tones: chord.intervals.map((n) => (chord.root + n) % 12),
    root: chord.root,
    bass: chord.bass ?? -1,
    minFret,
    maxFret,
    ...(anchors.length ? { anchors } : {}),
  };
  const key = JSON.stringify(request);
  if (!cache.has(key)) {
    const job = new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      getWorker().postMessage({ id, request });
    });
    cache.set(key, job);
    job.catch(() => cache.delete(key));
    if (cache.size > 256) cache.delete(cache.keys().next().value);
  }
  return cache.get(key);
}
// Keep engine ranking inside each group; use sounding pitch for re-entrant tunings.
export function groupVoicings(tuning, root, voicings) {
  const groups = new Map();
  voicings.forEach((voicing, index) => {
    const { bass } = describeFingering(tuning, voicing.frets, root);
    if (!groups.has(bass)) groups.set(bass, { bass, indices: [] });
    groups.get(bass).indices.push(index);
  });
  return [...groups.values()].sort((a, b) => mod12(a.bass - root) - mod12(b.bass - root));
}
