import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const key = "crest-chord-builder.project.v1";
const saved = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
const addAm7 = async (page) => {
  await page
    .getByRole("button", { name: "Add Am7 (Sevenths)", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Play Am7", exact: true }),
  ).toBeEnabled();
};
test.beforeEach(async ({ page }) => {
  await page.goto("./");
});

test("real WASM generation, octave editing, adapted name, save and reload", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await addAm7(page);
  await page.getByRole("button", { name: "Edit Am7", exact: true }).click();
  await page
    .getByRole("button", { name: "String 2 up one octave", exact: true })
    .click();
  await expect(page.locator("#editor-title")).toHaveText("Am7/E");
  await page.getByRole("button", { name: "Save chord", exact: true }).click();
  expect(
    (await saved(page)).parts[0].chords[0].fingerings["40,45,50,55,59,64"][1],
  ).toBe(12);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Am7/E", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".diagram-placeholder")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("same-note relocation protects occupied strings and preserves exact pitch", async ({
  page,
}) => {
  await addAm7(page);
  await page.getByRole("button", { name: "Edit Am7", exact: true }).click();
  await page.locator('#editor [data-string="3"][data-fret="0"]').click();
  await expect(
    page.locator('#editor [data-string="2"][data-fret="5"]'),
  ).toHaveClass(/exact/);
  await page.locator('#editor [data-string="2"][data-fret="5"]').click();
  await expect(page.locator(".editor-status")).toContainText(
    "already has a note",
  );
  await page
    .getByRole("button", { name: "Mute string 3", exact: true })
    .click();
  await page.locator('#editor [data-string="3"][data-fret="0"]').click();
  await page.locator('#editor [data-string="2"][data-fret="5"]').click();
  await expect(page.locator("#editor-title")).toHaveText("Am7");
  await page.getByRole("button", { name: "Save chord", exact: true }).click();
  expect(
    (await saved(page)).parts[0].chords[0].fingerings["40,45,50,55,59,64"],
  ).toEqual([-1, 0, 5, -1, 1, 0]);
});

test("eight-string tuning, multiple parts and tuning-specific grip recovery", async ({
  page,
}) => {
  await addAm7(page);
  const original = (await saved(page)).parts[0].chords[0].fingerings[
    "40,45,50,55,59,64"
  ];
  await page.locator('[data-view="guitars"]').click();
  await page.getByLabel("Tuning preset").selectOption("eight");
  await expect(page.locator(".string-editor")).toHaveCount(8);
  await expect(
    page.getByRole("button", { name: "Add string", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("String 1 note", { exact: true }).selectOption("4");
  await page.getByLabel("String 1 octave", { exact: true }).selectOption("1");
  await expect(page.locator(".string-editor").first()).toContainText("E1");
  await page.locator('.nav-item[data-view="parts"]').click();
  await expect(page.locator(".diagram-placeholder")).toHaveCount(0);
  expect(
    Object.keys((await saved(page)).parts[0].chords[0].fingerings),
  ).toHaveLength(2);
  await page
    .getByRole("button", { name: "Add Part", exact: true })
    .first()
    .click();
  await page
    .getByRole("combobox", { name: "Root", exact: true })
    .selectOption("0");
  await expect(
    page.getByRole("button", { name: "Add E♭ (Triads)", exact: true }),
  ).toBeVisible();
  await page.locator(".part-nav").first().click();
  await page.locator('[data-view="guitars"]').click();
  await page.getByLabel("Tuning preset").selectOption("standard");
  await page.locator('.nav-item[data-view="parts"]').click();
  expect(
    (await saved(page)).parts[0].chords[0].fingerings["40,45,50,55,59,64"],
  ).toEqual(original);
});

test("JSON download/import round trip and invalid input leave the session intact", async ({
  page,
}, testInfo) => {
  await addAm7(page);
  const original = await saved(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save JSON", exact: true }).click();
  const download = await downloadPromise;
  const path = testInfo.outputPath("session.json");
  await download.saveAs(path);
  expect(JSON.parse(await readFile(path, "utf8"))).toEqual(original);
  await page.getByRole("button", { name: "Remove Am7", exact: true }).click();
  await page.locator("#import-file").setInputFiles(path);
  await expect(
    page.getByRole("heading", { name: "Am7", exact: true }),
  ).toBeVisible();
  expect(await saved(page)).toEqual(original);
  await page
    .locator("#import-file")
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":99}'),
    });
  await expect(page.locator("#toast")).toContainText(
    "Your current session is unchanged",
  );
  expect(await saved(page)).toEqual(original);
});

test("1080p focus display fits eight strings and six chords; print includes all pages", async ({
  page,
}, testInfo) => {
  await page.locator('[data-view="guitars"]').click();
  await page.getByLabel("Tuning preset").selectOption("eight");
  await page.locator('.nav-item[data-view="parts"]').click();
  for (const name of ["Am7", "Fmaj7", "Cmaj7", "G7", "Dm7", "Em7", "Am7"]) {
    await page
      .getByRole("button", { name: `Add ${name} (Sevenths)`, exact: true })
      .click();
  }
  await expect(page.locator(".diagram-placeholder")).toHaveCount(0, {
    timeout: 20000,
  });
  await page.locator('.nav-item[data-view="display"]').click();
  await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBeTruthy();
  await expect(page.locator(".screen-only .chord-card")).toHaveCount(6);
  await page.screenshot({ path: testInfo.outputPath("display-1080p.png") });
  await page
    .getByRole("button", { name: "Next chord page", exact: true })
    .click();
  await expect(page.locator(".screen-only .chord-card")).toHaveCount(1);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-only .chord-card")).toHaveCount(7);
  await expect(page.locator(".print-only")).toBeVisible();
  await expect(page.locator(".display-toolbar")).toBeHidden();
  await page.pdf({
    path: testInfo.outputPath("chord-sheet.pdf"),
    preferCSSPageSize: true,
    printBackground: true,
  });
});

test("mobile setup keeps part creation and navigation reachable without page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".mobile-parts")).toBeVisible();
  await page
    .locator(".mobile-parts")
    .getByRole("button", { name: "Add Part", exact: true })
    .click();
  expect((await saved(page)).parts).toHaveLength(2);
  await page.locator('[data-field="active-part"]').selectOption({ index: 0 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("concurrent tab changes pause autosave instead of overwriting another session", async ({
  page,
  context,
}) => {
  const other = await context.newPage();
  await other.goto("./");
  await other
    .getByLabel("Project title", { exact: true })
    .fill("Other tab session");
  await other.getByLabel("Project title", { exact: true }).press("Tab");
  await expect(page.locator(".save-state")).toHaveText("Not saved locally");
  await page
    .getByLabel("Project title", { exact: true })
    .fill("Local unsaved version");
  await page.getByLabel("Project title", { exact: true }).press("Tab");
  expect((await saved(page)).title).toBe("Other tab session");
});

test("a failed engine download still allows manual chord editing", async ({ page }) => {
  await page.route('**/chords.wasm', route => route.abort());
  await page.getByRole('button', {name: 'Add Am7 (Sevenths)', exact: true}).click();
  await expect(page.locator('.diagram-placeholder')).toContainText('Search unavailable');
  await page.getByRole('button', {name: 'Edit Am7', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Find a grip', exact: true})).toBeEnabled();
  await page.getByRole('button', {name: 'Clear grip', exact: true}).click();
  for (const [string, fret] of [[1, 0], [2, 2], [3, 0], [4, 1]]) {
    await page.locator(`#editor [data-string="${string}"][data-fret="${fret}"]`).click();
  }
  await expect(page.locator('#editor-title')).toHaveText('Am7');
  await page.getByRole('button', {name: 'Save chord', exact: true}).click();
  expect((await saved(page)).parts[0].chords[0].fingerings['40,45,50,55,59,64']).toEqual([-1, 0, 2, 0, 1, -1]);
});
