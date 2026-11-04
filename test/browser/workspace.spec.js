import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const key = "crest-chord-builder.project.v3";
const saved = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
const addChord = async (page, name = "Am", extension = "7") => {
  await page
    .getByRole("button", { name: `Open ${name} chord workshop`, exact: true })
    .click();
  if (extension) {
    await page.getByRole("tab", { name: "Scale", exact: true }).click();
    await page
      .getByRole("button", {
        name: `Chord interval ${["F", "C"].includes(name) ? "7" : "♭7"}`,
        exact: true,
      })
      .click();
  }
  await page.getByRole("button", { name: "Add to part", exact: true }).click();
  await expect(page.locator("#editor")).not.toBeVisible();
};
const addAm7 = (page) => addChord(page);
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
  await page.getByRole("tab", { name: "Scale", exact: true }).click();
  await page
    .getByRole("button", { name: "String 5 up one octave", exact: true })
    .click();
  await expect(page.locator("#editor-title")).toHaveText("Am7/E");
  await page.getByRole("button", { name: "Save chord", exact: true }).click();
  expect(
    (await saved(page)).parts[0].chords[0].fingerings["40,45,50,55,59,64"][1],
  ).toBe(12);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Open Am7/E workshop", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".diagram-placeholder")).toHaveCount(0);
  expect(errors).toEqual([]);
});

const showView = (page, name) => page.getByRole('tab', { name, exact: true }).click();
const fretAt = (page, string, fret) => page.locator(`#editor [data-string="${string}"][data-fret="${fret}"]`);
const currentGrip = (page) => page.locator('#editor .fret.chosen').evaluateAll(nodes =>
  nodes.map(node => [Number(node.dataset.string), Number(node.dataset.fret)]).sort((a, b) => a[0] - b[0]));
const placeGrip = async (page, positions) => {
  await showView(page, 'Fretboard');
  await page.getByRole('button', { name: 'Clear grip', exact: true }).click();
  for (const [string, fret] of positions) await fretAt(page, string, fret).click();
};

test('saved grips accept any fret without clearing other strings and name follows sounding notes', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Open Am chord workshop', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Fretboard', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Draw / remove', exact: true })).toHaveCount(0);
  await placeGrip(page, [[2,3],[3,2],[4,1],[5,0]]);
  await expect(page.locator('#editor-title')).toHaveText('Am(♭13)/F');
  await page.getByRole('button', { name: 'Add to part', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Am(♭13)/F', exact: true }).click();
  await fretAt(page, 1, 0).click();
  await expect.poll(() => currentGrip(page)).toEqual([[1,0],[2,3],[3,2],[4,1],[5,0]]);
  await expect(page.locator('#editor-title')).toHaveText('Am(♭13)');
  await page.getByRole('button', { name: 'Close voicing search', exact: true }).click();
  await fretAt(page, 5, 2).click(); // F♯, outside A natural minor, remains editable.
  await expect.poll(() => currentGrip(page)).toEqual([[1,0],[2,3],[3,2],[4,1],[5,2]]);
  await expect(page.locator('.workshop-formula')).toContainText('6');
  await fretAt(page, 5, 2).click();
  await expect.poll(() => currentGrip(page)).toEqual([[1,0],[2,3],[3,2],[4,1]]);
  await expect(page.locator('#editor-title')).toHaveText('Am(♭13,no5)');
  await showView(page, 'Scale');
  await expect(page.getByRole('button', { name: 'Chord interval ♭6', exact: true })).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button', { name: 'Chord interval 5', exact: true })).toHaveAttribute('aria-pressed','false');
  await page.screenshot({path: testInfo.outputPath('scale-view.png')});
  await showView(page, 'Fretboard');
  await page.screenshot({path: testInfo.outputPath('fretboard-view.png')});
  await page.getByRole('button', { name: 'Save chord', exact: true }).click();
  await page.reload();
  expect((await saved(page)).parts[0].chords[0].fingerings['40,45,50,55,59,64']).toEqual([-1,0,3,2,1,-1]);
  expect((await saved(page)).parts[0].chords[0].intervals).toEqual([0,3,8]);
});

test('Fretboard and Scale share notes, allow an empty draft, and switch with keyboard', async ({ page }) => {
  await page.getByRole('button', { name: 'Open Am chord workshop', exact: true }).click();
  await placeGrip(page, [[3,2],[4,1],[5,0]]);
  const before = await currentGrip(page);
  await page.getByRole('tab', { name: 'Fretboard', exact: true }).press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Scale', exact: true })).toBeFocused();
  await expect(page.locator('.interval-matrix')).toBeVisible();
  await expect(page.locator('#editor .fretboard')).not.toBeVisible();
  expect(await currentGrip(page)).toEqual(before);
  await page.getByRole('button', { name: 'Chord interval ♭7', exact: true }).click();
  await expect(page.locator('.editor-status')).not.toContainText('Finding');
  await expect(page.locator('#editor-title')).toHaveText('Am7/G');
  await expect(page.getByLabel('Detected inversion',{exact:true})).toHaveText('Current: ♭7 in bass');
  await showView(page, 'Fretboard');
  await expect(page.locator('.editor-preview p')).toHaveText('Sounding: 1 · ♭3 · 5 · ♭7');
  await page.getByRole('button', { name: 'Clear grip', exact: true }).click();
  await showView(page, 'Scale');
  await expect(page.locator('#editor-title')).toHaveText('No notes selected');
  await expect(page.getByRole('button', { name: 'Add to part', exact: true })).toBeDisabled();
  await expect(page.locator('.interval-choice[aria-pressed="true"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Chord interval 1', exact: true }).click();
  await expect(page.locator('.editor-status')).not.toContainText('Finding');
  await page.getByRole('button', { name: 'Chord interval 1', exact: true }).click();
  await expect(page.locator('#editor-title')).toHaveText('No notes selected');
});

test('nearby suggestions remain grouped, reversible and subordinate to direct fret edits', async ({ page }) => {
  await page.getByRole('button', { name: 'Open Am chord workshop', exact: true }).click();
  await placeGrip(page, [[1,0],[2,2],[3,0],[4,1],[5,0]]);
  await page.getByRole('button', { name: 'Close voicing search', exact: true }).click();
  await fretAt(page, 0, 0).click();
  const original = await currentGrip(page);
  await expect(page.locator('.voicing-results')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('.voicing-choice')).not.toHaveCount(0);
  await expect(page.getByRole('group', {name:'Voicings by inversion'})).toBeVisible();
  const card = page.locator('.voicing-choice').first();
  await card.click();
  await expect(card).toHaveAttribute('aria-pressed','true');
  await card.click();
  await expect.poll(() => currentGrip(page)).toEqual(original);
  await card.click();
  const chosen = await currentGrip(page);
  const [string, fret] = chosen.at(-1);
  await fretAt(page, string, fret).click();
  await expect.poll(() => currentGrip(page)).toEqual(chosen.filter(([s]) => s !== string));
  await expect(page.locator('.voicing-results')).toHaveAttribute('aria-busy','false');
  await expect.poll(() => currentGrip(page)).toEqual(chosen.filter(([s]) => s !== string));
});

test('eight-string direct edits preserve other strings and detect the sounding bass', async ({ page }) => {
  await page.locator('.nav-item[data-view="guitars"]').click();
  await page.getByLabel('Tuning preset').selectOption('eightDropE');
  await page.locator('.nav-item[data-view="parts"]').click();
  await page.getByRole('button', { name: 'Open Am chord workshop', exact: true }).click();
  await placeGrip(page, [[3,0],[5,2],[6,1],[7,0]]);
  await fretAt(page,0,1).press('Enter');
  await expect.poll(() => currentGrip(page)).toEqual([[0,1],[3,0],[5,2],[6,1],[7,0]]);
  await expect(page.getByLabel('Detected inversion', {exact:true})).toHaveText('Current: ♭6 in bass');
  await showView(page,'Scale');
  await expect(page.getByRole('button',{name:'Chord interval ♭6',exact:true})).toHaveAttribute('aria-pressed','true');
  await showView(page,'Fretboard');
  await fretAt(page,0,1).press('Enter');
  await expect(page.getByLabel('Detected inversion', {exact:true})).toContainText('Root position');
});

test('closing a pending note search keeps the grip and discards stale results', async ({ page }) => {
  let download;
  await page.route('**/chords*.wasm', route => { download = route; });
  await page.getByRole('button', {name:'Open Am chord workshop',exact:true}).click();
  await expect.poll(() => Boolean(download)).toBe(true);
  await placeGrip(page, [[3,2],[4,1]]);
  await showView(page,'Scale');
  await expect(page.getByRole('button',{name:'Chord interval ♭3',exact:true})).toHaveAttribute('aria-pressed','true');
  await showView(page,'Fretboard');
  await page.getByRole('button',{name:'Close voicing search',exact:true}).click();
  await download.continue();
  await expect.poll(() => currentGrip(page)).toEqual([[3,2],[4,1]]);
  await expect(page.locator('.voicing-results')).toHaveCount(0);
  await fretAt(page,5,0).click();
  await expect(page.locator('#editor-title')).toHaveText('Am');
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
  await expect(page.locator(".string-editor").first()).toHaveAttribute(
    "data-string-number",
    "1",
  );
  await expect(page.getByLabel("Tuning preset").locator("option")).toHaveCount(
    21,
  );
  await page.getByLabel("String 8 note", { exact: true }).selectOption("4");
  await page.getByLabel("String 8 octave", { exact: true }).selectOption("1");
  await expect(page.locator(".string-editor").last()).toContainText("E1");
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
    .getByRole("combobox", { name: "Scale root", exact: true })
    .selectOption("0");
  await expect(
    page.getByRole("button", { name: "Open E♭ chord workshop", exact: true }),
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
    page.getByRole("button", { name: "Open Am7 workshop", exact: true }),
  ).toBeVisible();
  expect(await saved(page)).toEqual(original);
  await page.locator("#import-file").setInputFiles({
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
  for (const name of ["Am", "F", "C", "G", "Dm", "Em", "Am"])
    await addChord(page, name);
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
  await expect(page.locator(".part-switcher")).toBeVisible();
  await page
    .locator(".part-switcher")
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

test("a failed engine download still allows manual chord editing", async ({
  page,
}) => {
  await page.route("**/chords*.wasm", (route) => route.abort());
  await page
    .getByRole("button", { name: "Open Am chord workshop", exact: true })
    .click();
  await page.getByRole("tab", { name: "Scale", exact: true }).click();
  await expect(page.locator(".editor-status")).toContainText("add or remove notes");
  await expect(
    page.getByRole("button", { name: "Find a grip", exact: true }),
  ).toBeEnabled();
  await page.getByRole("tab", { name: "Fretboard", exact: true }).click();
  await page.getByRole("button", { name: "Clear grip", exact: true }).click();
  for (const [string, fret] of [
    [1, 0],
    [2, 2],
    [3, 0],
    [4, 1],
  ]) {
    await page
      .locator(`#editor [data-string="${string}"][data-fret="${fret}"]`)
      .click();
  }
  await expect(page.locator("#editor-title")).toHaveText("Am7");
  await page.getByRole("button", { name: "Add to part", exact: true }).click();
  expect(
    (await saved(page)).parts[0].chords[0].fingerings["40,45,50,55,59,64"],
  ).toEqual([-1, 0, 2, 0, 1, -1]);
});

test("custom scale, named parts and nested progressions survive export and reload", async ({
  page,
}) => {
  await page.getByLabel("Part name", { exact: true }).fill("Verse");
  await page.getByLabel("Part name", { exact: true }).press("Tab");
  await addAm7(page);
  await page
    .locator(".part-switcher")
    .getByRole("button", { name: "Add Part", exact: true })
    .click();
  await page.getByLabel("Part name", { exact: true }).fill("Chorus");
  await page.getByLabel("Part name", { exact: true }).press("Tab");
  await page.getByRole("combobox", { name: "Scale", exact: true }).selectOption("custom");
  await page.getByLabel("Custom scale name").fill("Minor pentatonic");
  await page.getByLabel("Custom scale name").press("Tab");
  await page
    .getByRole("button", { name: "Scale interval 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Scale interval ♭6", exact: true })
    .click();
  await addChord(page, "Am", null);
  const doc = await saved(page);
  expect(doc.parts.map((p) => p.name)).toEqual(["Verse", "Chorus"]);
  expect(doc.parts[1].customScale).toEqual({
    name: "Minor pentatonic",
    intervals: [0, 3, 5, 7, 10],
  });
  await expect(page.locator(".part-children button")).toHaveCount(1);
  await page.locator('.nav-item[data-view="display"]').click();
  await expect(page.locator(".sheet-heading h1")).toHaveText("Chorus");
  await page.getByLabel("Part", { exact: true }).selectOption(doc.parts[0].id);
  await expect(page.locator(".sheet-heading h1")).toHaveText("Verse");
  await page.reload();
  expect(await saved(page)).toEqual(doc);
});

test("interval workshop previews changes, preserves extensions, and sets inversion", async ({
  page,
}, testInfo) => {
  await page.evaluate(() => {
    window.previewCount = 0;
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (...args) {
      window.previewCount++;
      return create.apply(this, args);
    };
  });
  await page
    .getByRole("button", { name: "Open Am chord workshop", exact: true })
    .click();
  await page.getByRole("tab", { name: "Scale", exact: true }).click();
  await page
    .getByRole("button", { name: "Chord interval ♭7", exact: true })
    .click();
  await expect(page.locator("#editor-title")).toHaveText("Am7");
  await expect
    .poll(() => page.evaluate(() => window.previewCount))
    .toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Chord interval 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Chord interval 6", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Chord interval 5", exact: true })
    .click();
  await page.getByRole("button", { name: "♭3 in bass", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add to part", exact: true }),
  ).toBeEnabled();
  await expect(page.locator("#editor-title")).toHaveText("Am13(no5)/C");
  await expect(page.locator("#editor .outside-key")).not.toHaveCount(0);
  await expect(page.locator("#editor .in-key")).not.toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("workshop-dark.png") });
  await page
    .locator("#editor")
    .getByRole("button", { name: "Light theme", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.screenshot({ path: testInfo.outputPath("workshop-light.png") });
  await page.getByRole("button", { name: "Add to part", exact: true }).click();
  const chord = (await saved(page)).parts[0].chords[0];
  expect(chord.intervals).toEqual([0, 2, 3, 9, 10]);
  expect(chord.bass).toBe(0);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page
    .getByRole("button", { name: "Edit Am13(no5)/C", exact: true })
    .click();
  await page.getByRole("tab", { name: "Scale", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Chord interval 6", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("hand-position searches obey range and cancellation does not add chords", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Open Am chord workshop", exact: true })
    .click();
  await page.getByRole("tab", { name: "Scale", exact: true }).click();
  await showView(page, "Fretboard");
  await page.locator('[data-editor="position"]').selectOption("5");
  await expect(
    page.getByRole("button", { name: "Add to part", exact: true }),
  ).toBeEnabled();
  const frets = await page
    .locator("#editor .fret.chosen")
    .evaluateAll((nodes) => nodes.map((n) => Number(n.dataset.fret)));
  expect(frets.length).toBeGreaterThan(2);
  expect(frets.every((n) => n === 0 || (n >= 5 && n <= 8))).toBeTruthy();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await saved(page)).parts[0].chords).toHaveLength(0);
});

test("legacy browser saves migrate once without overwriting the original slot", async ({
  page,
}) => {
  const legacy = JSON.parse(
    await readFile(
      new URL("../../examples/first-idea.json", import.meta.url),
      "utf8",
    ),
  );
  await page.evaluate(
    ({ legacy, key }) => {
      localStorage.removeItem(key);
      localStorage.setItem(
        "crest-chord-builder.project.v1",
        JSON.stringify(legacy),
      );
    },
    { legacy, key },
  );
  await page.reload();
  const migrated = await saved(page);
  expect(migrated).toEqual({ ...legacy, version: 3 });
  await page.getByLabel("Project title", { exact: true }).fill("Migrated edit");
  await page.getByLabel("Project title", { exact: true }).press("Tab");
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("crest-chord-builder.project.v1")),
    ),
  ).toEqual(legacy);
  await page.reload();
  expect((await saved(page)).title).toBe("Migrated edit");
});

test("both workshop themes keep readable text contrast; eight-string controls stay reachable", async ({
  page,
}, testInfo) => {
  await page.locator('.nav-item[data-view="guitars"]').click();
  await page.getByLabel("Tuning preset").selectOption("sevenOpenC");
  expect((await saved(page)).guitars[0].strings).toEqual([
    31, 36, 43, 48, 55, 60, 64,
  ]);
  await page.getByLabel("Tuning preset").selectOption("eightDropE");
  await page.locator('.nav-item[data-view="parts"]').click();
  await page
    .getByRole("button", { name: "Open Am chord workshop", exact: true })
    .click();
  await page.getByRole("tab", { name: "Scale", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add to part", exact: true }),
  ).toBeEnabled();
  for (const theme of ["dark", "light"]) {
    if (theme === "light")
      await page.locator('#editor [data-action="theme"]').click();
    const contrasts = await page.evaluate(() => {
      const luminance = (hex) => {
        const c = hex
          .trim()
          .slice(1)
          .match(/../g)
          .map((n) => parseInt(n, 16) / 255)
          .map((n) =>
            n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4,
          );
        return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
      };
      const style = getComputedStyle(document.documentElement);
      const contrast = (a, b) => {
        const x = luminance(style.getPropertyValue(a)),
          y = luminance(style.getPropertyValue(b));
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
      };
      return [
        ["--ink", "--surface"],
        ["--muted", "--surface"],
        ["--ink", "--raised"],
        ["--accent-ink", "--accent"],
        ["--tone-ink", "--tone"],
        ["--outside", "--surface"],
      ].map(([a, b]) => contrast(a, b));
    });
    expect(Math.min(...contrasts)).toBeGreaterThanOrEqual(4.5);
    const visibleLayout = await page.evaluate(() => {
      const footer = document
        .querySelector(".editor-footer")
        .getBoundingClientRect();
      const neck = document
        .querySelector("#editor .fretboard")
        .getBoundingClientRect();
      const grid = document
        .querySelector(".interval-matrix")
        .getBoundingClientRect();
      const status = document
        .querySelector(".editor-status")
        .getBoundingClientRect();
      return (
        grid.top >= 0 &&
        neck.bottom <= footer.top &&
        status.bottom <= footer.top &&
        footer.bottom <= innerHeight
      );
    });
    expect(visibleLayout).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`eight-string-${theme}.png`),
    });
  }
  await expect(page.locator("#editor .voice-row")).toHaveCount(8);
  await page
    .getByRole("button", { name: "Chord interval 1", exact: true })
    .click();
  await page.getByRole("button", { name: "Add to part", exact: true }).click();
  expect((await saved(page)).parts[0].chords[0].intervals).toEqual([3, 7]);
});

test("invalid v3 browser data blocks autosave and does not silently replace it with v1", async ({
  page,
}) => {
  await page.evaluate((key) => {
    localStorage.setItem(
      "crest-chord-builder.project.v1",
      localStorage.getItem(key),
    );
    localStorage.setItem(key, "{broken");
  }, key);
  await page.reload();
  await expect(page.locator(".save-state")).toHaveText("Not saved locally");
  await page.getByLabel("Project title", { exact: true }).fill("Unsaved work");
  await page.getByLabel("Project title", { exact: true }).press("Tab");
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
    "{broken",
  );
});

test("grouped presets set string count directly and leave the tuning editor ready", async ({
  page,
}, testInfo) => {
  await page.evaluate((key) => {
    const doc = JSON.parse(localStorage.getItem(key));
    doc.guitars[0].name = "Standard six";
    localStorage.setItem(key, JSON.stringify(doc));
  }, key);
  await page.reload();
  await page.locator('.nav-item[data-view="guitars"]').click();
  const selector = page.getByLabel("Tuning preset", { exact: true });
  expect(
    await selector
      .locator("optgroup")
      .evaluateAll((nodes) => nodes.map((n) => n.label)),
  ).toEqual(["6 strings", "7 strings", "8 strings"]);
  await expect(page.getByLabel("String count", { exact: true })).toHaveCount(0);
  for (const [preset, count] of [
    ["eightDropE", 8],
    ["sevenOpenC", 7],
    ["dropd", 6],
  ]) {
    await selector.selectOption(preset);
    await expect(page.locator(".string-editor")).toHaveCount(count);
    expect((await saved(page)).guitars[0].strings).toHaveLength(count);
  }
  expect((await saved(page)).guitars[0].name).toBe("Guitar 1");
  await page.locator(".guitar-details summary").click();
  await page.getByLabel("Guitar name", { exact: true }).fill("Baritone");
  await page.getByLabel("Guitar name", { exact: true }).press("Tab");
  await selector.selectOption("eight");
  expect((await saved(page)).guitars[0].name).toBe("Baritone");
  await page.screenshot({ path: testInfo.outputPath("grouped-presets.png") });
});

test("interval grid supports reversible alterations and separate bass choices without implied tones", async ({
  page,
}, testInfo) => {
  await expect(page.locator('[data-action="custom-chord"]')).toHaveCount(0);
  await page
    .getByRole("button", { name: "Open Am chord workshop", exact: true })
    .click();
  await page.getByRole("tab", { name: "Scale", exact: true }).click();
  await expect(page.getByLabel("Chord menu")).toHaveCount(0);
  await expect(page.locator(".interval-matrix")).toBeVisible();
  const tone = (label) =>
    page.getByRole("button", { name: `Chord interval ${label}`, exact: true });
  await expect(tone("♭3").locator("small")).toHaveText("In key");
  await expect(tone("3").locator("small")).toHaveText("Out of key");
  await tone("3").click();
  await expect(tone("3")).toHaveAttribute("aria-pressed", "true");
  await expect(tone("3").locator("small")).toHaveText("Out of key");
  await expect(tone("♭3")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#editor-title")).toHaveText("A");
  await tone("♭3").click();
  await expect(page.locator("#editor-title")).toHaveText("Am");
  await tone("2").click();
  await expect(tone("♭7")).toHaveAttribute("aria-pressed", "false");
  await expect(tone("7")).toHaveAttribute("aria-pressed", "false");
  await tone("♭2").click();
  await expect(tone("2")).toHaveAttribute("aria-pressed", "false");
  await tone("♭2").click();
  await expect(page.locator(".workshop-formula")).toHaveText("1 · ♭3 · 5");
  await tone("♭7").click();
  await tone("7").click();
  await expect(tone("♭7")).toHaveAttribute("aria-pressed", "false");
  await tone("♭7").click();
  await tone("♯4").click();
  await expect(tone("5")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "♭3 in bass", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add to part", exact: true }),
  ).toBeEnabled();
  await expect(page.locator("#editor-title")).toHaveText("Am7(♯11)/C");
  await page.screenshot({ path: testInfo.outputPath("interval-grid.png") });
  await page.getByRole("button", { name: "Add to part", exact: true }).click();
  expect((await saved(page)).parts[0].chords[0].formula).toEqual([
    "1",
    "♭3",
    "5",
    "♭7",
    "♯11",
  ]);
  await page.reload();
  await page
    .getByRole("button", { name: "Edit Am7(♯11)/C", exact: true })
    .click();
  await page.getByRole("tab", { name: "Scale", exact: true }).click();
  await expect(tone("♯4")).toHaveAttribute("aria-pressed", "true");
  await expect(tone("♭5")).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { name: "Any inversion", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Detected inversion", { exact: true }))
    .toHaveText("Current: ♭3 in bass");
});

test("inversion filters audition the exact adjusted grip and constrain alternatives", async ({ page }) => {
  await page.evaluate(() => {
    window.playedMidi = [];
    const create = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (...args) {
      const oscillator = create.apply(this, args);
      const start = oscillator.start;
      oscillator.start = function (...times) {
        window.playedMidi.push(Math.round(69 + 12 * Math.log2(this.frequency.value / 440)));
        return start.apply(this, times);
      };
      return oscillator;
    };
  });
  await page.getByRole("button", { name: "Open Am chord workshop", exact: true }).click();
  await page.getByRole("tab", { name: "Scale", exact: true }).click();
  await page.getByRole("button", { name: "Chord interval ♭7", exact: true }).click();
  await expect(page.locator(".editor-status")).not.toContainText("Finding");
  let previous = [];
  for (const [label, bass] of [["1", 9], ["♭3", 0], ["5", 4], ["♭7", 7]]) {
    await page.evaluate(() => { window.playedMidi = []; });
    await page.getByRole("button", { name: `${label} in bass`, exact: true }).click();
    await expect(page.locator(".editor-status")).not.toContainText("Finding");
    const expected = await page.locator("#editor .fret.chosen").evaluateAll((nodes) =>
      nodes.map((node) => [Number(node.dataset.string), Number(node.dataset.fret)])
        .sort((a, b) => a[0] - b[0])
        .map(([string, fret]) => [40, 45, 50, 55, 59, 64][string] + fret),
    );
    expect(Math.min(...expected) % 12).toBe(bass);
    expect(expected).not.toEqual(previous);
    await expect.poll(() => page.evaluate(() => window.playedMidi)).toEqual(expected);
    await expect(page.getByLabel("Detected inversion", { exact: true }))
      .toContainText(label === "1" ? "Root position" : `${label} in bass`);
    // Explicit Preview must play exactly what the filter change auditioned.
    await page.evaluate(() => { window.playedMidi = []; });
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.playedMidi)).toEqual(expected);
    previous = expected;
  }
  await page.evaluate(() => { window.playedMidi = []; });
  await page.getByRole("button", { name: "Next grip", exact: true }).click();
  await expect.poll(() => page.evaluate(() =>
    window.playedMidi.length ? Math.min(...window.playedMidi) % 12 : -1,
  )).toBe(7);
  await expect(page.getByRole("button", { name: "♭7 in bass", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => { window.playedMidi = []; });
  await page.getByRole("tab", { name: "Fretboard", exact: true }).click();
  const selectedNote = page.locator('#editor [data-string="4"][data-fret="1"]');
  if (await selectedNote.getAttribute('aria-pressed') === 'true') await selectedNote.click();
  await page.evaluate(() => { window.playedMidi = []; });
  await selectedNote.click();
  await expect(page.locator(".voicing-results")).toHaveAttribute("aria-busy", "false");
  const directPitches = (await currentGrip(page)).map(([string, fret]) => [40,45,50,55,59,64][string] + fret);
  await expect.poll(() => page.evaluate(() => window.playedMidi)).toEqual(directPitches);
  await page.evaluate(() => { window.playedMidi = []; });
  const card = page.locator(".voicing-choice").first();
  const frets = (await card.getAttribute("data-frets")).split(",").map(Number);
  const pitches = frets.flatMap((f, i) => f < 0 ? [] : [[40, 45, 50, 55, 59, 64][i] + f]);
  await card.click();
  await expect.poll(() => page.evaluate(() => window.playedMidi)).toEqual(pitches);
  await page.evaluate(() => { window.playedMidi = []; });
  await page.getByRole("button", { name: "5 in bass", exact: true }).click();
  await expect(page.locator(".voicing-results")).toHaveAttribute("aria-busy", "false");
  const filtered = (await page.locator('.voicing-choice[aria-pressed="true"]')
    .getAttribute("data-frets")).split(",").map(Number);
  const adjusted = filtered.flatMap((f, i) => f < 0 ? [] : [[40, 45, 50, 55, 59, 64][i] + f]);
  expect(filtered[4]).toBe(1);
  expect(Math.min(...adjusted) % 12).toBe(4);
  expect(adjusted).not.toEqual(pitches);
  await expect.poll(() => page.evaluate(() => window.playedMidi)).toEqual(adjusted);
});

test("direct editing detects inversion by sounding pitch and clears the grip filter", async ({ page }, testInfo) => {
  await page.locator('.nav-item[data-view="guitars"]').click();
  // Re-entrant tuning: the bass-side string is now E4, above inner strings.
  await page.getByLabel("String 6 octave", { exact: true }).selectOption("4");
  await page.locator('.nav-item[data-view="parts"]').click();
  await page.getByRole("button", { name: "Open Am chord workshop", exact: true }).click();
  await page.getByRole("tab", { name: "Scale", exact: true }).click();
  await page.getByRole("button", { name: "Chord interval ♭7", exact: true }).click();
  await page.getByRole("button", { name: "1 in bass", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add to part", exact: true })).toBeEnabled();
  const fret = (string, position) =>
    page.locator(`#editor [data-string="${string}"][data-fret="${position}"]`);
  const detected = page.getByLabel("Detected inversion", { exact: true });
  await page.getByRole("tab", { name: "Fretboard", exact: true }).click();
  await page.getByRole("button", { name: "Clear grip", exact: true }).click();
  await fret(0, 0).click(); // E4
  await expect(detected).toHaveText("Current: 5 in bass");
  await expect(page.getByRole("button", { name: "Any inversion", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  await fret(1, 3).click(); // C3 is below E4 despite being a later string.
  await fret(2, 7).click(); // A3
  await fret(5, 3).click(); // G4
  await expect(detected).toHaveText("Current: ♭3 in bass");
  await expect(page.locator("#editor-title")).toHaveText("Am7/C");
  await page.screenshot({ path: testInfo.outputPath("detected-inversion.png") });
  await page.getByRole("button", { name: "Add to part", exact: true }).click();
  expect((await saved(page)).parts[0].chords[0].bass).toBe(0);
  await page.reload();
  await page.getByRole("button", { name: "Edit Am7/C", exact: true }).click();
  await page.getByRole("tab", { name: "Scale", exact: true }).click();
  await expect(detected).toHaveText("Current: ♭3 in bass");
  await expect(page.getByRole("button", { name: "Any inversion", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "String 5 up one octave", exact: true }).click();
  await expect(detected).toHaveText("Current: Root position · 1 in bass");
  await page.getByRole("button", { name: "Mute string 4", exact: true }).click();
  await expect(detected).toHaveText("Current: ♭3 in bass");
  await page.getByRole("button", { name: "Clear grip", exact: true }).click();
  await expect(detected).toHaveText("Current: No notes selected");
});

test("interval key hints follow the chord root within the part scale", async ({ page }) => {
  await page.getByRole("button", { name: "Open Am chord workshop", exact: true }).click();
  await page.getByRole("tab", { name: "Scale", exact: true }).click();
  const tone = (label) => page.getByRole("button", { name: `Chord interval ${label}`, exact: true });
  await expect(tone("3")).toHaveAccessibleDescription("Out of key");
  await expect(tone("♭3")).toHaveAccessibleDescription("In key");
  await page.getByRole("button", { name: "Root C", exact: true }).click();
  await expect(tone("3")).toHaveAccessibleDescription("In key");
  await expect(tone("♭3")).toHaveAccessibleDescription("Out of key");
  await page.getByRole("button", { name: "Root B", exact: true }).click();
  await expect(tone("♭2")).toHaveAccessibleDescription("In key");
  await expect(tone("2")).toHaveAccessibleDescription("Out of key");
});

test("a custom scale without triads can start a chord from its intervals", async ({ page }) => {
  await page.getByRole("combobox", { name: "Scale", exact: true }).selectOption("custom");
  for (const interval of ["2", "♭3", "4", "5", "♭6", "♭7"])
    await page.getByRole("button", { name: `Scale interval ${interval}`, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Intervals in scale" })).toBeVisible();
  await page.getByRole("button", { name: "Build chord from interval 1", exact: true }).click();
  await showView(page,"Scale");
  await expect(page.locator(".workshop-formula")).toHaveText("1");
  await expect(page.getByRole("button", { name: "Chord interval 1", exact: true })).toHaveAccessibleDescription("In key");
  await expect(page.getByRole("button", { name: "Chord interval 3", exact: true })).toHaveAccessibleDescription("Out of key");
  await page.getByRole("button", { name: "Chord interval 3", exact: true }).click();
  await page.getByRole("button", { name: "Add to part", exact: true }).click();
  expect((await saved(page)).parts[0].chords[0].intervals).toEqual([0, 4]);
});

test('simple intervals lead the grid and 2, 4, 6 add independently of the third', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Open Am chord workshop', exact: true }).click();
  await page.getByRole("tab", { name: "Scale", exact: true }).click();
  const tone = (interval) => page.getByRole('button', { name: `Chord interval ${interval}`, exact: true });
  await expect(page.locator('.interval-matrix thead th')).toHaveText(['Degree', '1', '2 (9th)', '3', '4 (11th)', '5', '6 (13th)', '7']);
  for (const [interval, alias] of [['2', '9th'], ['4', '11th'], ['6', '13th']]) {
    await expect(tone(interval)).toContainText(`${interval} (${alias})`);
    await tone(interval).click();
    await expect(tone(interval)).toHaveAttribute('aria-pressed', 'true');
    await expect(tone('♭3')).toHaveAttribute('aria-pressed', 'true');
  }
  await expect(page.locator('.workshop-formula')).toHaveText('1 · 2 · ♭3 · 4 · 5 · 6');
  // Return to a playable minor sixth, then save and reopen its simple labels.
  await tone('2').click();
  await tone('4').click();
  await expect(page.locator('#editor-title')).toHaveText('Am6');
  await page.getByRole('button', { name: 'Add to part', exact: true }).click();
  expect((await saved(page)).parts[0].chords[0].intervals).toEqual([0, 3, 7, 9]);
  await page.reload();
  await page.getByRole('button', { name: 'Edit Am6', exact: true }).click();
  await page.getByRole("tab", { name: "Scale", exact: true }).click();
  await expect(tone('6')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.workshop-formula')).toHaveText('1 · ♭3 · 5 · 6');
  await page.screenshot({ path: testInfo.outputPath('simple-interval-grid.png') });
  await page.getByRole('button', { name: 'Quality Suspended 2nd', exact: true }).click();
  await expect(tone('2')).toHaveAttribute('aria-pressed', 'true');
  await tone('2').click();
  await expect(tone('2')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.workshop-formula')).toHaveText('1 · 5');
});

test('fret clicks add, replace and remove sounding notes without choosing a suggestion', async ({ page }) => {
  await page.getByRole('button', { name: 'Open Am chord workshop', exact: true }).click();
  await page.getByRole("tab", { name: "Scale", exact: true }).click();
  await showView(page,'Fretboard');
  await page.getByRole('button',{name:'Clear grip',exact:true}).click();
  const fret = (string, position) => page.locator(`#editor [data-string="${string}"][data-fret="${position}"]`);
  const detected = page.getByLabel('Detected inversion', { exact: true });
  const grip = () => page.locator('#editor .fret.chosen').evaluateAll(nodes =>
    nodes.map(node => [Number(node.dataset.string), Number(node.dataset.fret)]).sort((a, b) => a[0] - b[0]));
  await fret(4, 1).click();
  await expect.poll(grip).toEqual([[4, 1]]);
  await expect(detected).toHaveText('Current: ♭3 in bass');
  await expect(page.getByRole('button', { name: 'Add to part', exact: true })).toBeEnabled();
  await fret(3, 2).click();
  await expect.poll(grip).toEqual([[3, 2], [4, 1]]);
  await expect(detected).toHaveText('Current: Root position · 1 in bass');
  await fret(5, 0).click();
  await expect.poll(grip).toEqual([[3, 2], [4, 1], [5, 0]]);
  await expect(page.locator('.editor-preview p')).toHaveText('Sounding: 1 · ♭3 · 5');
  await fret(5, 5).click();
  await expect(fret(5, 0)).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(grip).toEqual([[3, 2], [4, 1], [5, 5]]);
  await fret(5, 5).click();
  await expect.poll(grip).toEqual([[3, 2], [4, 1]]);
  await expect(page.locator('.voicing-results')).toHaveAttribute('aria-busy', 'false');
  await expect.poll(grip).toEqual([[3, 2], [4, 1]]); // Search completion never replaces the selection.
  await page.getByRole('button', { name: 'Add to part', exact: true }).click();
  const chord = (await saved(page)).parts[0].chords[0];
  expect(chord.fingerings['40,45,50,55,59,64']).toEqual([-1,-1,-1,2,1,-1]);
  expect(chord.intervals).toEqual([0,3]);
  await page.reload();
  await page.getByRole('button', { name: 'Edit Am(no5)', exact: true }).click();
  await page.getByRole("tab", { name: "Scale", exact: true }).click();
  await expect.poll(grip).toEqual([[3, 2], [4, 1]]);
});

for (const asset of ['**/chords*.wasm', '**/wasm_exec*.js']) test(`complete required notes survive ${asset} failure and Retry recovers`, async ({ page }) => {
  let unavailable = true;
  await page.route(asset, route => unavailable ? route.abort() : route.continue());
  await page.getByRole('button', { name: 'Open Am chord workshop', exact: true }).click();
  await page.getByRole("tab", { name: "Scale", exact: true }).click();
  await showView(page,'Fretboard');
  await page.getByRole('button',{name:'Clear grip',exact:true}).click();
  for (const [string, fret] of [[2,3], [3,2], [4,1]]) {
    await page.locator(`#editor [data-string="${string}"][data-fret="${fret}"]`).click();
    await expect(page.locator('.voicing-results')).toHaveAttribute('aria-busy', 'false');
  }
  await expect(page.getByRole('button', { name: 'Add to part', exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: "Fretboard", exact: true }).click();
  await page.locator('#editor [data-string="5"][data-fret="0"]').click();
  await expect(page.locator('.voicing-results')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.voicing-empty')).toContainText('Voicing search unavailable');
  await expect(page.locator('.voicing-empty')).not.toContainText('No matching voicings');
  await expect(page.locator('.required-note')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Add to part', exact: true })).toBeEnabled();
  unavailable = false;
  await page.getByRole('button', { name: 'Retry search', exact: true }).click();
  await expect(page.locator('.voicing-results')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.voicing-choice')).not.toHaveCount(0);
  await expect(page.locator('.required-note')).toHaveCount(4);
  // The real engine also offers the exact four-note grip, in the F-bass group.
  await page.locator('.voicing-groups [data-bass="5"]').click();
  await expect(page.locator('.voicing-choice[data-frets="-1,-1,3,2,1,0"]')).toBeVisible();
  await expect(page.getByLabel('Detected inversion', { exact: true })).toHaveText('Current: ♭6 in bass');
  await page.getByRole('button', { name: 'Add to part', exact: true }).click();
  expect((await saved(page)).parts[0].chords[0].fingerings['40,45,50,55,59,64']).toEqual([-1,-1,3,2,1,0]);
});

test('clicked notes save while search is pending and survive a late engine failure', async ({ page }) => {
  let download;
  await page.route('**/chords*.wasm', route => { download = route; });
  await page.getByRole('button', { name: 'Open Am chord workshop', exact: true }).click();
  await page.getByRole("tab", { name: "Scale", exact: true }).click();
  await expect.poll(() => Boolean(download)).toBe(true);
  await showView(page,'Fretboard');
  await page.getByRole('button',{name:'Clear grip',exact:true}).click();
  for (const [string, fret] of [[2,3], [3,2], [4,1], [5,0]]) {
    await page.locator(`#editor [data-string="${string}"][data-fret="${fret}"]`).click();
  }
  await expect(page.locator('.voicing-results')).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('button', { name: 'Add to part', exact: true })).toBeEnabled();
  await expect(page.locator('#editor .fret.chosen')).toHaveCount(4);
  await page.getByRole('button', { name: 'Add to part', exact: true }).click();
  const stopped = new Promise(resolve => page.workers()[0].on('close', resolve));
  await download.abort();
  await stopped;
  const chord = (await saved(page)).parts[0].chords[0];
  expect(chord.fingerings['40,45,50,55,59,64']).toEqual([-1,-1,3,2,1,0]);
  expect(chord.intervals).toEqual([0,3,7,8]);
  expect(chord.bass).toBe(5);
  await page.reload();
  await page.getByRole('button', { name: 'Edit Am(♭13)/F', exact: true }).click();
  await page.getByRole("tab", { name: "Scale", exact: true }).click();
  await expect(page.getByLabel('Detected inversion', { exact: true })).toHaveText('Current: ♭6 in bass');
  await expect(page.locator('.editor-status')).not.toContainText('failed');
});

test('name from fretboard offers alternate roots and saves the chosen name with the exact grip', async ({ page }, testInfo) => {
  await page.getByRole('button', {name:'Name from fretboard',exact:true}).click();
  await expect(page.locator('#editor .fret.chosen')).toHaveCount(0);
  await expect(page.locator('.name-empty')).toBeVisible();
  await expect(page.getByRole('button',{name:'Add to part',exact:true})).toBeDisabled();
  for(const [string,fret] of [[2,3],[3,2],[4,1],[5,0]]) await fretAt(page,string,fret).click();
  await expect(page.locator('.chord-name-choice').first()).toContainText('Fmaj7');
  await expect(page.getByRole('button',{name:'Use Fmaj7',exact:true})).toContainText('In key');
  await expect(page.getByRole('button',{name:'Use Am(♭13)/F',exact:true})).toContainText('In key');
  const original = await currentGrip(page);
  await page.getByRole('button',{name:'Use Am(♭13)/F',exact:true}).click();
  await expect(page.locator('#editor-title')).toHaveText('Am(♭13)/F');
  await page.getByRole('button',{name:'Use Fmaj7',exact:true}).click();
  await expect(page.locator('#editor-title')).toHaveText('Fmaj7');
  expect(await currentGrip(page)).toEqual(original);
  await page.screenshot({path:testInfo.outputPath('chord-names.png')});
  await page.getByRole('button',{name:'Add to part',exact:true}).click();
  await page.reload();
  const chord = (await saved(page)).parts[0].chords[0];
  expect(chord.root).toBe(5);
  expect(chord.intervals).toEqual([0,4,7,11]);
  expect(chord.fingerings['40,45,50,55,59,64']).toEqual([-1,-1,3,2,1,0]);
  await expect(page.getByRole('button',{name:'Edit Fmaj7',exact:true})).toBeVisible();
});

test('naming works without the voicing engine and never recommends an unplayed root', async ({ page }) => {
  await page.route('**/chords*.wasm', route => route.abort());
  await page.getByRole('button',{name:'Name from fretboard',exact:true}).click();
  for(const [string,fret] of [[0,0],[3,0],[4,0]]) await fretAt(page,string,fret).click();
  await expect(page.getByRole('button',{name:'Use Em',exact:true})).toContainText('In key');
  await expect(page.getByRole('button',{name:/^Use .*no1/})).toHaveCount(0);
  await page.getByRole('button',{name:'Use Em',exact:true}).click();
  await fretAt(page,4,1).click();
  await expect(page.getByRole('button',{name:'Add to part',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Use Em',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Use C/E',exact:true})).toContainText('In key');
  await page.getByRole('button',{name:'Use C/E',exact:true}).click();
  await page.getByRole('button',{name:'Add to part',exact:true}).click();
  expect((await saved(page)).parts[0].chords[0].root).toBe(0);
});

test('D C F E recommends Dm9 without rootless A minor and saves the exact grip', async ({ page }) => {
  await page.getByRole('button',{name:'Name from fretboard',exact:true}).click();
  for (const [string,fret] of [[2,0],[3,5],[4,6],[5,0]]) await fretAt(page,string,fret).click();
  await expect(page.locator('.chord-name-choice').first()).toContainText('Dm9(no5)');
  await expect(page.getByRole('button',{name:/^Use .*no1/})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Use Dm9(no5)',exact:true})).toContainText('In key');
  await page.getByRole('button',{name:'Use Dm9(no5)',exact:true}).click();
  await page.getByRole('button',{name:'Add to part',exact:true}).click();
  await page.reload();
  const chord = (await saved(page)).parts[0].chords[0];
  expect(chord.root).toBe(2);
  expect(chord.intervals).toEqual([0,2,3,10]);
  expect(chord.fingerings['40,45,50,55,59,64']).toEqual([-1,-1,0,5,6,0]);
  await expect(page.getByRole('button',{name:'Edit Dm9(no5)',exact:true})).toBeVisible();
});
