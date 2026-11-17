import { test, expect } from "@playwright/test";
import { createProject, makeChord, makePart, setFingering } from "../../web/project.js";

function referenceProject(title = "Embedded guitar parts") {
  const project = createProject();
  project.title = title;
  project.parts[0].name = "Verse";
  const chord = makeChord(9, "min7");
  setFingering(chord, project.guitars[0].strings, [-1, 0, 2, 0, 1, 0]);
  project.parts[0].chords.push(chord);
  project.parts.push({ ...makePart(project.guitars[0].id, 2), name: "Chorus" });
  return project;
}

async function mockNativeHost(page, project = null) {
  let snapshot = { generation: 1, projectJSON: project ? JSON.stringify(project) : "", ui: {} };
  let writes = 0;
  await page.exposeBinding("referenceNativeCall", (_source, request) => {
    if (request.name === "crestReferenceGetState") return structuredClone(snapshot);
    const incoming = JSON.parse(request.params[0]);
    if (incoming.generation !== snapshot.generation) return { ok: false, error: "Host state changed", snapshot: structuredClone(snapshot) };
    snapshot = structuredClone(incoming);
    writes++;
    return { ok: true };
  });
  await page.addInitScript(() => {
    if (window !== window.top) return;
    const listeners = new Map();
    window.restoreReferenceSnapshot = (value) => listeners.get("crestReferenceRestore")?.(value);
    window.__JUCE__ = { initialisationData: { crestReference: [true] }, backend: {
      addEventListener: (name, callback) => listeners.set(name, callback),
      emitEvent: (_event, request) => window.referenceNativeCall(request).then((result) => listeners.get("__juce__complete")({ promiseId: request.resultId, result })),
    } };
  });
  return {
    snapshot: () => structuredClone(snapshot), writes: () => writes,
    restore: async (project) => {
      snapshot = { generation: snapshot.generation + 1, projectJSON: JSON.stringify(project), ui: {} };
      await page.evaluate((value) => window.restoreReferenceSnapshot(value), snapshot);
    },
  };
}

test("paste JSON once, reference intervals, and recall the selected part and preferences after reopening", async ({ page }) => {
  const host = await mockNativeHost(page);
  const project = referenceProject();
  await page.goto("./reference.html");
  await page.getByRole("button", { name: "Paste project JSON", exact: true }).click();
  await page.getByLabel("Project JSON blob").fill(JSON.stringify(project));
  await page.getByRole("button", { name: "Apply JSON", exact: true }).click();
  await expect(page.locator(".reference-header h1")).toHaveText(project.title);
  await expect(page.frameLocator("iframe").locator(".fret.is-root span").first()).toHaveText("1");
  await expect(page.locator(".reference-status")).toContainText("Stored in plug-in");
  expect(JSON.parse(host.snapshot().projectJSON)).toEqual(project);
  await page.getByLabel("Part", { exact: true }).selectOption(project.parts[1].id);
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await page.getByRole("button", { name: "Light theme", exact: true }).click();
  await expect(page.locator(".reference-status")).toContainText("Stored in plug-in");
  await page.reload();
  await expect(page.getByLabel("Part", { exact: true })).toHaveValue(project.parts[1].id);
  await expect(page.getByRole("button", { name: "Notes", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("invalid JSON never replaces the embedded project, and host recall wins over an open config editor", async ({ page }) => {
  const project = referenceProject();
  const host = await mockNativeHost(page, project);
  await page.goto("./reference.html");
  await expect(page.locator("iframe")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Project JSON", exact: true }).click();
  await page.getByLabel("Project JSON blob").fill("{broken");
  await page.getByRole("button", { name: "Apply JSON", exact: true }).press("Enter");
  await expect(page.getByRole("alert")).toContainText("previous project is unchanged");
  expect(host.writes()).toBe(0);
  expect(JSON.parse(host.snapshot().projectJSON)).toEqual(project);
  await host.restore(referenceProject("Recalled from Live set"));
  await expect(page.locator(".reference-header h1")).toHaveText("Recalled from Live set");
  await expect(page.locator("#reference-config")).not.toBeVisible();
});

test("two instances at the same origin keep independent documents and never modify browser project storage", async ({ page, context }) => {
  await page.goto("./");
  const browserSave = await page.evaluate(() => localStorage.getItem("crest-chord-builder.project.v3"));
  const first = await mockNativeHost(page, referenceProject("Instance one"));
  const secondPage = await context.newPage();
  const second = await mockNativeHost(secondPage, referenceProject("Instance two"));
  await Promise.all([page.goto("./reference.html"), secondPage.goto("./reference.html")]);
  await expect(page.locator(".reference-header h1")).toHaveText("Instance one");
  await expect(secondPage.locator(".reference-header h1")).toHaveText("Instance two");
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await expect(page.locator(".reference-status")).toContainText("Stored in plug-in");
  expect(first.snapshot().ui.labels).toBe("notes");
  expect(second.snapshot().ui.labels).toBeUndefined();
  expect(await page.evaluate(() => localStorage.getItem("crest-chord-builder.project.v3"))).toBe(browserSave);
  expect(await page.frameLocator("iframe").locator("body").evaluate(() => typeof window.__JUCE__)).toBe("undefined");
});

test("reference sheets retain absolute capo frets and attachments without playback or voicing controls", async ({ page }, testInfo) => {
  const project = referenceProject();
  project.guitars[0].capo = 2;
  setFingering(project.parts[0].chords[0], [42, 47, 52, 57, 61, 66], [3, 1, 0, 0, 3, 1]);
  const phrase = { format: "crest-tab", version: 1, title: "Reference phrase", tuning: [40, 45, 50, 55, 59, 64], tempo: 90, meter: [4, 4], bars: 1, events: [{ beat: 0, duration: 1, string: 1, fret: 7, midi: 71 }] };
  project.parts[0].sheet = { format: "html", layout: "replace", source: '<h1>Guitar cue</h1><p id="cue"></p><scale-map labels="notes"></scale-map><chord-sheet></chord-sheet><guitar-tab src="phrase.json"></guitar-tab><script>document.querySelector("#cue").textContent = crest.readJSON("cue.json").cue;</script>', files: [
    { name: "cue.json", mime: "application/json", encoding: "utf8", content: '{"cue":"Hold through bar 4"}' },
    { name: "phrase.json", mime: "application/json", encoding: "utf8", content: JSON.stringify(phrase) },
  ] };
  await mockNativeHost(page, project);
  await page.goto("./reference.html");
  const frame = page.frameLocator("iframe");
  await expect(page.locator("iframe")).toHaveAttribute("data-ready", "true");
  await expect(frame.locator("#cue")).toHaveText("Hold through bar 4");
  await expect(frame.locator(".fret-values")).toHaveText("5 3 2 2 5 3");
  await expect(frame.locator(".scale-map .fret.is-root span").first()).toHaveText("1");
  await expect(frame.locator(".sheet-voicing-controls")).toBeHidden();
  await expect(frame.locator(".tab-transport")).toBeHidden();
  await expect(frame.locator(".tab-note[data-attack=true]")).toHaveCount(1);
  await page.getByLabel("Frets", { exact: true }).selectOption("5");
  await expect(frame.locator('.fret[title^="String 1, fret 5:"]').first()).toBeVisible();
  await expect(frame.locator(".fret-values")).toHaveText("5 3 2 2 5 3");
  await page.screenshot({ path: testInfo.outputPath("reference-capo-sheet.png"), fullPage: true });
});

test("a JSON file is embedded once and recalled without its source file", async ({ page }) => {
  const host = await mockNativeHost(page);
  const project = referenceProject("Imported file");
  await page.goto("./reference.html");
  await page.getByRole("button", { name: "Project JSON", exact: true }).click();
  await page.locator("#reference-file").setInputFiles({ name: "project.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)) });
  await expect(page.locator(".reference-header h1")).toHaveText("Imported file");
  await expect(page.locator(".reference-status")).toContainText("Stored in plug-in");
  expect(JSON.parse(host.snapshot().projectJSON)).toEqual(project);
  await page.reload();
  await expect(page.locator(".reference-header h1")).toHaveText("Imported file");
});
