import { test, expect } from "@playwright/test";
import { createProject, makeChord, setFingering } from "../../web/project.js";
import { makeSheet } from "../../web/sheet-data.js";

const key = "crest-chord-builder.project.v3";
const original = [-1, 0, 2, 0, 1, 0];
const readProject = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
const display = (page) => page.locator('.nav-item[data-view="display"]').click();
const readFrets = (text) => text.trim().split(/\s+/).map((value) => value === "×" ? -1 : Number(value));
const within = (frets, min, max) => frets.some((fret) => fret > 0) && frets.every((fret) => fret === -1 || (fret >= min && fret <= max));

async function loadProject(page, project) {
  await page.goto("./");
  await page.locator("#import-file").setInputFiles({ name: "capo-test.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)) });
  await expect(page.getByLabel("Project title", { exact: true })).toHaveValue(project.title);
  await display(page);
}

function fixture(custom = false) {
  const project = createProject();
  project.title = "Capo and position test";
  const chord = makeChord(9, "min7");
  setFingering(chord, project.guitars[0].strings, original);
  project.parts[0].chords.push(chord);
  if (custom) project.parts[0].sheet = makeSheet();
  return project;
}

async function chooseStrictCapo(page) {
  await page.getByLabel("Capo", { exact: true }).selectOption("2");
  await page.getByLabel("Hand position", { exact: true }).selectOption("5");
  await page.getByLabel("Allow open strings", { exact: true }).uncheck();
}

test("capo and exact-position filters generate concert-pitch grips, cycle, persist and restore no-capo shapes", async ({ page }, testInfo) => {
  await loadProject(page, fixture());
  await chooseStrictCapo(page);
  const values = page.locator(".screen-only .fret-values");
  await expect.poll(async () => within(readFrets(await values.textContent()), 5, 8)).toBe(true);
  await expect(page.locator(".screen-only .capo-caption")).toHaveText("Capo at fret 2 · absolute frets");
  await expect(page.locator(".screen-only .chord-card header small").first()).toContainText("Am7");
  await expect(page.locator('.scale-map [title="String 6"]')).toHaveText("F♯2");
  const before = await values.textContent();
  await page.locator('.screen-only [data-direction="1"][data-action="cycle-voicing"]').click();
  await expect(values).not.toHaveText(before);
  expect(within(readFrets(await values.textContent()), 5, 8)).toBe(true);
  let project = await readProject(page);
  expect(project.parts[0].chords[0].root).toBe(9);
  expect(project.parts[0].chords[0].intervals).toEqual([0, 3, 7, 10]);
  expect(project.parts[0].chords[0].fingerings["40,45,50,55,59,64"]).toEqual(original);
  await page.reload();
  await display(page);
  await expect(page.getByLabel("Capo", { exact: true })).toHaveValue("2");
  await expect(page.getByLabel("Hand position", { exact: true })).toHaveValue("5");
  await expect(page.getByLabel("Allow open strings", { exact: true })).not.toBeChecked();
  await page.screenshot({ path: testInfo.outputPath("capo-position.png") });
  await page.getByLabel("Hand position", { exact: true }).selectOption("any");
  await page.getByLabel("Allow open strings", { exact: true }).check();
  await page.getByLabel("Capo", { exact: true }).selectOption("0");
  await expect(values).toHaveText("× 0 2 0 1 0");
  project = await readProject(page);
  expect(project.parts[0].chords[0].fingerings["42,47,52,57,61,66"]).toBeDefined();
});

test("custom-sheet components and arrows obey the same filters; moving the scale map never revoices a chord", async ({ page }) => {
  await loadProject(page, fixture(true));
  await chooseStrictCapo(page);
  const frame = page.frameLocator("main iframe");
  const values = frame.locator(".fret-values");
  await expect.poll(async () => within(readFrets(await values.textContent()), 5, 8)).toBe(true);
  await expect(frame.locator(".playing-setup")).toContainText("Capo at fret 2");
  const before = await values.textContent();
  await frame.locator('[data-sheet-voicing="1"]').click();
  await expect(values).not.toHaveText(before);
  expect(within(readFrets(await values.textContent()), 5, 8)).toBe(true);
  const chosen = await values.textContent();
  await page.locator('[data-field="display-start"]').selectOption("5");
  await expect(values).toHaveText(chosen);
  await expect(frame.locator('.fret[title^="String 1, fret 5:"]').first()).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".fingering-settings")).toBeHidden();
  await expect(frame.locator(".playing-setup")).toBeVisible();
});

test("an impossible region shows no out-of-range fallback and preserves the original saved grip", async ({ page }) => {
  const project = createProject();
  project.title = "One-string boundary";
  project.guitars[0].strings = [40];
  const chord = { ...makeChord(4), intervals: [0] };
  setFingering(chord, [40], [0]);
  project.parts[0].chords.push(chord);
  await loadProject(page, project);
  await page.getByLabel("Hand position", { exact: true }).selectOption("5");
  await page.getByLabel("Allow open strings", { exact: true }).uncheck();
  await expect(page.locator(".screen-only .diagram-placeholder")).toContainText("No fingering matches");
  await expect(page.locator(".screen-only .chord-box")).toHaveCount(0);
  expect((await readProject(page)).parts[0].chords[0].fingerings["40"]).toEqual([0]);
  await page.getByLabel("Allow open strings", { exact: true }).check();
  await expect(page.locator(".screen-only .fret-values")).toHaveText("0");
});

test("high capos clamp the physical neck and workshop searches inherit the saved filters", async ({ page }) => {
  await loadProject(page, fixture());
  await page.getByLabel("Hand position", { exact: true }).selectOption("21");
  await page.getByLabel("Capo", { exact: true }).selectOption("12");
  await expect(page.getByLabel("Hand position", { exact: true })).toHaveValue("21");
  await expect(page.locator('[data-field="display-start"] option')).toHaveCount(1);
  await expect(page.locator('[data-field="display-start"]')).toHaveValue("12");
  await page.getByLabel("Hand position", { exact: true }).selectOption("15");
  await page.getByLabel("Allow open strings", { exact: true }).uncheck();
  await expect.poll(async () => within(readFrets(await page.locator(".screen-only .fret-values").textContent()), 15, 18)).toBe(true);
  await page.locator('.screen-only [data-action="edit-chord"]').first().click();
  const editor = page.locator("#editor");
  await expect(editor.locator('[data-editor="position"]')).toHaveValue("15");
  await expect(editor.locator('[data-editor="allow-open"]')).not.toBeChecked();
  await expect(editor.locator('[data-fret="11"]')).toHaveCount(0);
  await expect(editor.locator('[data-fret="24"]')).toHaveCount(6);
  await editor.locator('[data-editor="position"]').selectOption("17");
  await expect(editor.locator(".voicing-results")).toHaveAttribute("aria-busy", "false");
  const results = await editor.locator(".voicing-choice").evaluateAll((nodes) => nodes.map((node) => node.dataset.frets.split(",").map(Number)));
  expect(results.length).toBeGreaterThan(0);
  expect(results.every((frets) => within(frets, 17, 20))).toBe(true);
  await editor.getByRole("button", { name: "Save chord", exact: true }).click();
  await expect(page.getByLabel("Hand position", { exact: true })).toHaveValue("17");
  expect((await readProject(page)).guitars[0]).toMatchObject({ capo: 12, position: 5, allowOpen: false });
});

test("existing capo saves display absolute frets and manual edits translate without changing pitches", async ({ page }) => {
  const project = fixture();
  project.guitars[0].capo = 2;
  const shape = [3, 1, 0, 0, 3, 1];
  setFingering(project.parts[0].chords[0], [42, 47, 52, 57, 61, 66], shape);
  await loadProject(page, project);
  await expect(page.locator(".screen-only .fret-values")).toHaveText("5 3 2 2 5 3");
  await page.locator('.screen-only [data-action="edit-chord"]').first().click();
  const editor = page.locator("#editor");
  await expect(editor.locator('[data-string="2"][data-fret="2"]')).toHaveAttribute("aria-pressed", "true");
  await expect(editor.locator('[data-fret="0"], [data-fret="1"]')).toHaveCount(0);
  await editor.locator('[data-string="0"][data-fret="7"]').click();
  await expect(editor.locator(".voice-row").last()).toContainText("Fret 7 · B2");
  await expect(editor.getByRole("button", { name: "Remove required note: string 6, fret 7", exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Save chord", exact: true }).click();
  expect((await readProject(page)).parts[0].chords[0].fingerings["42,47,52,57,61,66"][0]).toBe(5);
  await expect(page.locator(".screen-only .fret-values")).toHaveText("7 3 2 2 5 3");
});
