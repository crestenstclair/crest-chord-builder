import { test, expect } from "@playwright/test";
import { createProject, makeChord, makePart, setFingering } from "../../web/project.js";
import { makeSheet } from "../../web/sheet-data.js";

const key = "crest-chord-builder.project.v3";
const readProject = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
const card = (page, id) => page.locator(`[data-reorder-chord="${id}"]`);
const handle = (page, id) => page.locator(`[data-reorder-handle="${id}"]`);
const order = (page) => page.locator("[data-reorder-chord]").evaluateAll((cards) => cards.map((card) => card.dataset.reorderChord));

async function loadFixture(page, count = 5) {
  const project = createProject();
  project.title = "Drag order test";
  project.parts[0].id = "progression";
  project.parts[0].sheet = makeSheet();
  project.parts[0].chords = Array.from({ length: count }, (_, index) => {
    const chord = { ...makeChord(9, "min7"), id: String.fromCharCode(97 + index), label: `Chord ${index + 1}` };
    setFingering(chord, project.guitars[0].strings, [-1, 0, 2, 0, 1, 0]);
    return chord;
  });
  project.parts.push({ ...makePart(project.guitars[0].id, 2), id: "other" });
  await page.goto("./");
  await page.locator("#import-file").setInputFiles({ name: "drag-order.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)) });
  await expect(page.locator("[data-reorder-chord]")).toHaveCount(count);
  return project;
}

test("dragging a card reorders the progression, sidebar and custom sheet, with persistence and Undo", async ({ page }, testInfo) => {
  const original = await loadFixture(page);
  const target = await card(page, "c").boundingBox();
  await card(page, "a").locator(".chord-box").dragTo(card(page, "c"), { targetPosition: { x: target.width - 10, y: 100 } });
  await expect.poll(() => order(page)).toEqual(["b", "c", "a", "d", "e"]);
  expect((await readProject(page)).parts[0].chords).toEqual([original.parts[0].chords[1], original.parts[0].chords[2], original.parts[0].chords[0], ...original.parts[0].chords.slice(3)]);
  expect(await page.locator(".part-children button").evaluateAll((buttons) => buttons.map((button) => button.dataset.id))).toEqual(["b", "c", "a", "d", "e"]);
  await expect(handle(page, "a")).toBeFocused();
  await expect(handle(page, "a").locator("span")).toHaveText("03");
  await page.getByRole("button", { name: "Undo last change", exact: true }).click();
  await expect.poll(() => order(page)).toEqual(["a", "b", "c", "d", "e"]);
  await handle(page, "a").dragTo(card(page, "c"), { targetPosition: { x: target.width - 10, y: 100 } });
  await expect.poll(() => order(page)).toEqual(["b", "c", "a", "d", "e"]);
  await page.reload();
  await expect.poll(() => order(page)).toEqual(["b", "c", "a", "d", "e"]);
  await page.screenshot({ path: testInfo.outputPath("reordered-cards.png") });
  await page.locator('.nav-item[data-view="display"]').click();
  await expect(page.frameLocator("main iframe").locator(".sheet-component-chord h3")).toHaveText(["Chord 2", "Chord 3", "Chord 1", "Chord 4", "Chord 5"]);
});

test("numbered drag handles support keyboard ordering and retain focus; arrows still work", async ({ page }) => {
  const original = await loadFixture(page);
  await handle(page, "a").focus();
  await handle(page, "a").press("End");
  await expect.poll(() => order(page)).toEqual(["b", "c", "d", "e", "a"]);
  await expect(handle(page, "a")).toBeFocused();
  await handle(page, "a").press("Home");
  await expect.poll(() => order(page)).toEqual(["a", "b", "c", "d", "e"]);
  await handle(page, "a").press("ArrowRight");
  await expect.poll(() => order(page)).toEqual(["b", "a", "c", "d", "e"]);
  await card(page, "a").locator('[data-action="move-chord"][data-direction="-1"]').click();
  await expect.poll(() => order(page)).toEqual(["a", "b", "c", "d", "e"]);
  expect((await readProject(page)).parts[1]).toEqual(original.parts[1]);
  await expect(card(page, "a").locator('[data-action="move-chord"][data-direction="-1"]')).toBeDisabled();
});

test("cancelled and external drags never change the saved order or open the editor", async ({ page }) => {
  await loadFixture(page);
  const before = await readProject(page);
  await card(page, "a").scrollIntoViewIfNeeded();
  const source = await card(page, "a").locator(".chord-box").boundingBox();
  const target = await card(page, "d").boundingBox();
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 15, source.y + source.height / 2, { steps: 5 });
  await page.mouse.move(target.x + target.width - 10, target.y + 100, { steps: 10 });
  await expect(page.locator("[data-drop-side]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator(".is-dragging,[data-drop-side]")).toHaveCount(0);
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await card(page, "d").dispatchEvent("drop", { dataTransfer });
  await card(page, "a").locator('[data-action="play-chord"]').dispatchEvent("pointerdown");
  await card(page, "a").dispatchEvent("dragstart", { dataTransfer });
  await card(page, "d").dispatchEvent("drop", { dataTransfer });
  await expect(page.locator(".is-dragging")).toHaveCount(0);
  expect(await readProject(page)).toEqual(before);
  await expect(page.locator("#editor")).not.toBeVisible();
  await card(page, "a").getByRole("button", { name: "Edit Am7", exact: true }).click();
  await expect(page.locator("#editor")).toBeVisible();
});

test("dropping onto the source card is a no-op and does not add an Undo entry", async ({ page }) => {
  await loadFixture(page);
  const before = await readProject(page);
  await card(page, "a").locator(".chord-box").dragTo(card(page, "a"), { targetPosition: { x: 100, y: 100 } });
  expect(await readProject(page)).toEqual(before);
  await expect(page.locator(".is-dragging,[data-drop-side]")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo last change", exact: true }).click();
  await expect(page.getByLabel("Project title", { exact: true })).toHaveValue("Untitled session");
});

test("dragging between wrapped rows can move the last chord before the first", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 2400 });
  await loadFixture(page, 8);
  const first = await card(page, "a").boundingBox();
  const last = await card(page, "h").boundingBox();
  expect(last.y).toBeGreaterThan(first.y);
  await card(page, "h").locator(".chord-box").dragTo(card(page, "a"), { targetPosition: { x: 10, y: 100 } });
  await expect.poll(() => order(page)).toEqual(["h", "a", "b", "c", "d", "e", "f", "g"]);
});
