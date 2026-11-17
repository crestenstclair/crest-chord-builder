import test from "node:test";
import assert from "node:assert/strict";
import { createProject } from "../web/project.js";
import { ReferenceBridge } from "../web/reference-bridge.js";
import { referencePreferences, parseReferenceSnapshot, referencePayload } from "../web/reference-state.js";

test("reference state defaults to intervals, clamps view settings and validates the embedded project", () => {
  const project = createProject();
  const snapshot = parseReferenceSnapshot({ generation: 2, projectJSON: JSON.stringify(project), ui: { labels: "bad", zoom: 999, start: -8, partId: "missing" } });
  assert.deepEqual(snapshot.project, project);
  assert.deepEqual(snapshot.ui, { theme: "dark", labels: "intervals", zoom: 150, start: 0, partId: project.parts[0].id });
  assert.equal(referencePreferences().labels, "intervals");
  assert.equal(parseReferenceSnapshot({ generation: 1, projectJSON: "" }).project, null);
  for (const generation of [0, -1, 1.5, "1", undefined])
    assert.throws(() => parseReferenceSnapshot({ generation, projectJSON: "" }));
  assert.throws(() => parseReferenceSnapshot({ generation: 1, projectJSON: "{broken" }));
});

test("reference payload preserves the full portable project without retaining input references", () => {
  const project = createProject();
  project.parts[0].sheet = { format: "markdown", layout: "replace", source: "# Embedded", files: [{ name: "cue.json", mime: "application/json", encoding: "utf8", content: '{"cue":"hold"}' }] };
  const payload = referencePayload(project, { labels: "intervals", partId: project.parts[0].id }, 5);
  assert.equal(payload.generation, 5);
  assert.deepEqual(JSON.parse(payload.projectJSON), project);
  project.title = "Changed elsewhere";
  assert.notEqual(JSON.parse(payload.projectJSON).title, project.title);
});

test("native bridge matches asynchronous replies and rejects a missing host without touching storage", async () => {
  const listeners = new Map();
  const calls = [];
  const juce = { initialisationData: { crestReference: [true] }, backend: {
    addEventListener: (name, listener) => listeners.set(name, listener),
    emitEvent: (name, request) => {
      calls.push({ name, request });
      queueMicrotask(() => listeners.get("__juce__complete")({ promiseId: request.resultId, result: request.name === "crestReferenceGetState" ? { generation: 1, projectJSON: "" } : { ok: true } }));
    },
  } };
  const bridge = new ReferenceBridge(juce);
  assert.equal((await bridge.read()).generation, 1);
  assert.equal((await bridge.write({ generation: 1, projectJSON: "" })).ok, true);
  assert.equal(calls[1].request.name, "crestReferenceSetState");
  assert.equal(bridge.pending.size, 0);
  let recalled;
  bridge.onRestore = (snapshot) => { recalled = snapshot; };
  listeners.get("crestReferenceRestore")({ generation: 3 });
  assert.equal(recalled.generation, 3);
  assert.throws(() => new ReferenceBridge(undefined));
});
