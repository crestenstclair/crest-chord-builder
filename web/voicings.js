import { describeFingering, mod12 } from "./music.js";

// The worker keeps the existing Go search off the interface thread. Requests
// share promises by tuning + chord, and callers discard stale selections.
let worker;
let sequence = 0;
const pending = new Map();
const cache = new Map();

function getWorker() {
  if (worker) return worker;
  const current = new Worker(new URL("./engine/worker.js", import.meta.url));
  worker = current;
  const fail = (message) => {
    if (worker !== current) return;
    for (const job of pending.values()) job.reject(new Error(message));
    pending.clear();
    cache.clear();
    current.terminate();
    worker = null;
  };
  current.onmessage = ({ data }) => {
    if (worker !== current) return;
    if (data.engineFailed) return fail(data.error);
    const job = pending.get(data.id);
    if (!job) return;
    pending.delete(data.id);
    if (data.error) job.reject(new Error(data.error));
    else job.resolve(data.voicings);
  };
  current.onerror = () => fail("Voicing engine failed. Retry the search.");
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
      const current = getWorker();
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      current.postMessage({ id, request });
    });
    cache.set(key, job);
    job.catch(() => { if (cache.get(key) === job) cache.delete(key); });
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
