import test from "node:test";
import assert from "node:assert/strict";
import { parseTab, tabPlaybackPlan, tabPosition } from "../web/tablature.js";
import { TabPlayer } from "../web/tab-playback.js";

function audioClock() {
  const calls = [];
  const audio = {
    currentTime: 100, state: "running", destination: {}, calls,
    resume: async () => {}, close: async () => {},
    createGain: () => ({ gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} }),
    createOscillator() {
      const voice = { frequency: {}, connect: (gain) => gain, disconnect() {},
        start(time) { this.started = time; }, stop(time) { if (time === undefined) this.cancelled = true; else this.ended = time; } };
      calls.push(voice);
      return voice;
    },
  };
  return audio;
}

const plan = () => ({ startBeat: 0, endBeat: 6, startBar: 17, meter: [3, 4], tempo: 120,
  events: [{ beat: 1, duration: 3, midi: 69 }] });

test("visible tab playback clips held notes, preserves rests and applies output shift once", () => {
  const tab = parseTab({ format: "crest-tab", version: 1, title: "Excerpt", tuning: [64],
    tempo: 90, meter: [6, 8], startBar: 17, bars: 4, pitchShift: -2,
    events: [{ beat: 0, duration: 1, string: 1, fret: 0 }, { beat: 2, duration: 2, string: 1, fret: 5 },
      { beat: 5.75, duration: 3, string: 1, fret: 7 }, { beat: 9, duration: 1, string: 1, fret: 3 }] });
  const before = structuredClone(tab);
  const excerpt = tabPlaybackPlan(tab, { first: 18, bars: 1 });
  assert.deepEqual(excerpt, { startBeat: 3, endBeat: 6, startBar: 17, meter: [6, 8], tempo: 90,
    events: [{ beat: 3, duration: 1, midi: 67 }, { beat: 5.75, duration: 0.25, midi: 69 }] });
  assert.deepEqual(tab, before);
  assert.equal(tabPlaybackPlan(tab, { first: 17, bars: 4 }).events.length, 4);
  assert.equal(tabPosition(3, [[0, 80], [2, 240], [4, 480]]), 360);
  assert.equal(tabPosition(-1, [[0, 80], [2, 240]]), 80);
  assert.equal(tabPosition(3, [[0, 80], [2, 240]]), 240);
});

test("audio clock preserves leading/trailing rests, exact pitch and note-off time", async (t) => {
  const audio = audioClock();
  const player = new TabPlayer(plan(), () => {}, () => audio);
  t.after(() => player.dispose());
  await player.play();
  assert.equal(audio.calls.length, 0, "leading rest must be silent");
  audio.currentTime = 100.4; player.tick();
  assert.equal(audio.calls.length, 1);
  assert.equal(audio.calls[0].frequency.value, 440);
  assert.equal(audio.calls[0].started, 100.525);
  assert.equal(audio.calls[0].ended, 102.025);
  audio.currentTime = 102.5; player.tick();
  assert.equal(player.state, "playing", "trailing rest remains in the timeline");
  audio.currentTime = 103.025; player.tick();
  assert.equal(player.state, "ended");
  assert.equal(player.position(), 6);
});

test("pause, seek and tempo changes cancel voices and resume only the remaining sustain", async (t) => {
  const audio = audioClock();
  const source = plan();
  const player = new TabPlayer(source, () => {}, () => audio);
  t.after(() => player.dispose());
  player.seek(2);
  await player.play();
  assert.equal(audio.calls[0].ended - audio.calls[0].started, 1);
  audio.currentTime = 100.275;
  player.pause();
  assert.equal(player.position(), 2.5);
  assert.equal(audio.calls[0].cancelled, true);
  assert.equal(player.setTempo(60), true);
  assert.equal(source.tempo, 120);
  assert.equal(player.setTempo(NaN), false);
  await player.play();
  const resumed = audio.calls.at(-1);
  assert.equal(resumed.ended - resumed.started, 1.5);
  assert.equal(resumed.frequency.value, 440);
  player.stop();
  assert.equal(resumed.cancelled, true);
  assert.equal(player.position(), 0);
});

test("Stop during audio unlock cannot restart playback; audio errors stay recoverable", async () => {
  const audio = audioClock();
  let unlock;
  audio.resume = () => new Promise((resolve) => { unlock = resolve; });
  const player = new TabPlayer(plan(), () => {}, () => audio);
  const pending = player.play();
  player.stop();
  unlock();
  await pending;
  assert.equal(player.state, "stopped");
  assert.equal(audio.calls.length, 0);
  audio.resume = async () => { throw new Error("Audio disabled"); };
  await player.play();
  assert.equal(player.state, "paused");
  assert.match(player.error, /Audio disabled/);
  player.dispose();
});

test("browser audio interruptions pause the transport instead of silently losing notes", async (t) => {
  const audio = audioClock();
  const player = new TabPlayer(plan(), () => {}, () => audio);
  t.after(() => player.dispose());
  await player.play();
  audio.currentTime = 100.525;
  audio.state = "suspended";
  player.tick();
  assert.equal(player.position(), 1);
  assert.equal(player.state, "paused");
  assert.match(player.error, /Press Play/);
});
