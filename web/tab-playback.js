import { tabPosition } from "./tablature.js";

// Scheduled in seconds on the audio clock, so visual timers cannot move notes.
function scheduleTabTone(audio, midi, start, end, voices) {
  start = Math.max(start, audio.currentTime);
  if (end <= start) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const duration = end - start;
  oscillator.type = "triangle";
  oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.07, start + Math.min(0.008, duration / 4));
  gain.gain.setValueAtTime(0.07, end - Math.min(0.04, duration / 4));
  gain.gain.linearRampToValueAtTime(0, end);
  oscillator.connect(gain).connect(audio.destination);
  voices.add(oscillator);
  oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
  oscillator.start(start);
  oscillator.stop(end);
}

// Owns one validated tab's transport. No source tempo or event data is mutated.
export class TabPlayer {
  constructor(plan, onUpdate, createAudio = () => new AudioContext()) {
    this.plan = plan;
    this.onUpdate = onUpdate;
    this.createAudio = createAudio;
    this.tempo = plan.tempo;
    this.beat = plan.startBeat;
    this.state = "stopped";
    this.error = "";
    this.voices = new Set();
    this.revision = 0;
  }

  position() {
    if (this.state !== "playing") return this.beat;
    return Math.min(this.plan.endBeat, this.anchorBeat + Math.max(0, this.audio.currentTime - this.anchorTime) * this.tempo / 60);
  }

  async play() {
    const revision = ++this.revision;
    try {
      this.error = "";
      this.audio ??= this.createAudio();
      if (this.beat >= this.plan.endBeat) this.beat = this.plan.startBeat;
      this.state = "starting";
      this.onUpdate(this);
      await this.audio.resume();
      if (revision !== this.revision) return;
      if (this.audio.state !== "running") throw new Error("Audio is suspended. Press Play again.");
      this.anchorBeat = this.beat;
      this.anchorTime = this.audio.currentTime + 0.025;
      const next = this.plan.events.findIndex((event) => event.beat + event.duration > this.beat);
      this.next = next < 0 ? this.plan.events.length : next;
      this.state = "playing";
      this.tick();
      this.timer = setInterval(() => this.tick(), 25);
    } catch (error) {
      if (revision !== this.revision) return;
      this.error = `Playback unavailable: ${error.message}`;
      this.halt("paused", this.beat);
    }
  }

  tick() {
    const beat = this.position();
    if (this.audio.state !== "running") {
      this.error = "Audio paused by the browser. Press Play to resume.";
      return this.halt("paused", beat);
    }
    if (beat >= this.plan.endBeat) return this.halt("ended", this.plan.endBeat);
    const horizon = beat + 0.2 * this.tempo / 60;
    while (this.next < this.plan.events.length && this.plan.events[this.next].beat < horizon) {
      const event = this.plan.events[this.next++];
      const seconds = 60 / this.tempo;
      const start = this.anchorTime + (Math.max(this.anchorBeat, event.beat) - this.anchorBeat) * seconds;
      const end = this.anchorTime + (event.beat + event.duration - this.anchorBeat) * seconds;
      scheduleTabTone(this.audio, event.midi, start, end, this.voices);
    }
    this.onUpdate(this);
  }

  halt(state, beat) {
    ++this.revision; // A pending resume must never restart a stopped/changed tab.
    clearInterval(this.timer);
    for (const voice of this.voices) { try { voice.stop(); } catch {} }
    this.voices.clear();
    this.beat = beat;
    this.state = state;
    this.onUpdate(this);
  }

  pause() {
    if (["playing", "starting"].includes(this.state)) this.halt("paused", this.position());
  }

  stop() {
    this.halt("stopped", this.plan.startBeat);
  }

  seek(beat) {
    if (!Number.isFinite(beat)) return;
    const resume = ["playing", "starting"].includes(this.state);
    this.halt("paused", Math.max(this.plan.startBeat, Math.min(this.plan.endBeat, beat)));
    if (resume && this.beat < this.plan.endBeat) this.play();
  }

  setTempo(tempo) {
    if (!Number.isFinite(tempo) || tempo < 20 || tempo > 400) return false;
    const beat = this.position();
    const resume = ["playing", "starting"].includes(this.state);
    this.halt(this.state === "stopped" ? "stopped" : "paused", beat);
    this.tempo = tempo;
    if (resume) this.play();
    return true;
  }

  dispose() {
    this.stop();
    this.audio?.close().catch(() => {});
  }
}

function updateTabRow(row, beat, playing) {
  const start = Number(row.dataset.start), end = Number(row.dataset.end);
  const current = beat >= start && beat < end;
  const cursor = row.querySelector(".tab-playhead");
  cursor.style.display = current ? "" : "none";
  if (current) {
    const x = tabPosition(beat, row.tabPositions ??= JSON.parse(row.dataset.positions));
    cursor.setAttribute("x1", x);
    cursor.setAttribute("x2", x);
  }
  for (const note of row.querySelectorAll(".tab-note")) {
    const onset = Number(note.dataset.beat);
    note.classList.toggle("tab-note-playing", playing && current && beat >= onset && beat < onset + Number(note.dataset.duration));
  }
}

function updateTabControls(section, player) {
  const beat = player.position();
  const beatUnit = 4 / player.plan.meter[1];
  const barLength = player.plan.meter[0] * beatUnit;
  const bar = player.plan.startBar + Math.floor(beat / barLength);
  const beatInBar = 1 + (beat % barLength) / beatUnit;
  const label = beat >= player.plan.endBeat ? "End" : `Bar ${bar} · beat ${(Math.floor(beatInBar * 10) / 10).toFixed(1)}`;
  const playing = ["playing", "starting"].includes(player.state);
  const play = section.querySelector(".tab-play");
  play.textContent = playing ? "Pause" : "Play";
  play.setAttribute("aria-label", playing ? "Pause tab" : "Play tab");
  const seek = section.querySelector(".tab-seek");
  seek.value = beat;
  seek.setAttribute("aria-valuetext", label);
  section.querySelector(".tab-position").textContent = label;
  const status = section.querySelector(".tab-playback-status");
  const message = player.error || ({ stopped: "Ready", starting: "Starting…", playing: "Playing", paused: "Paused", ended: "Finished" })[player.state];
  if (status.textContent !== message) status.textContent = message;
  section.dataset.playbackState = player.state;
  section.querySelectorAll(".tab-system").forEach((row) => updateTabRow(row, beat, player.state === "playing"));
}

function attachTabPlayer(section, activate) {
  const player = new TabPlayer(JSON.parse(section.dataset.playback), (state) => updateTabControls(section, state));
  section.querySelector(".tab-play").addEventListener("click", () => {
    if (["playing", "starting"].includes(player.state)) player.pause();
    else { activate(player); player.play(); }
  });
  section.querySelector(".tab-stop").addEventListener("click", () => player.stop());
  section.querySelector(".tab-seek").addEventListener("input", (event) => player.seek(event.target.valueAsNumber));
  section.querySelector(".tab-tempo").addEventListener("change", (event) => {
    if (!player.setTempo(event.target.valueAsNumber)) event.target.value = player.tempo;
  });
  updateTabControls(section, player);
  return { section, player };
}

function attachTabPlayers() {
  let active;
  const activate = (player) => { if (active !== player) active?.pause(); active = player; };
  const tabs = [...document.querySelectorAll(".tablature[data-playback]")].map((section) => attachTabPlayer(section, activate));
  const pause = () => tabs.forEach(({ player }) => player.pause());
  addEventListener("beforeprint", pause);
  addEventListener("pagehide", () => tabs.forEach(({ player }) => player.dispose()));
  addEventListener("message", (event) => { if (event.source === parent && event.data?.type === "crest-sheet-pause") pause(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
  document.addEventListener("toggle", (event) => {
    if (event.target.tagName === "DETAILS" && !event.target.open)
      tabs.filter(({ section }) => event.target.contains(section)).forEach(({ player }) => player.pause());
  }, true);
}

// Inline the same tested implementation into the opaque-origin sheet. It needs
// no imports, network permission, or access to the parent application's storage.
export function tabPlaybackScript() {
  const definitions = [tabPosition, scheduleTabTone, TabPlayer, updateTabRow, updateTabControls, attachTabPlayer, attachTabPlayers];
  return definitions.map((definition) => `const ${definition.name} = ${definition.toString()};`).join("\n") + '\naddEventListener("DOMContentLoaded", attachTabPlayers);';
}
