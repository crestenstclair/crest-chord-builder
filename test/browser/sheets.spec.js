import { test, expect } from "@playwright/test";

const key = "crest-chord-builder.project.v3";
const phrase = { format: "crest-tab", version: 1, title: "A minor phrase", tuning: [40,45,50,55,59,64], tempo: 90, meter: [3,4], startBar: 17, bars: 8, events: [
  { beat: 0, duration: 6, string: 1, fret: 7, midi: 71 },
  { beat: 12, duration: 1.75, string: 1, fret: 10, midi: 74 },
  { beat: 13.75, duration: 1.25, string: 1, fret: 7, midi: 71 },
] };
const upload = (name, content, mimeType = "text/plain") => ({ name, mimeType, buffer: Buffer.from(content) });
async function openEditor(page) {
  await page.goto("./");
  await page.locator('.nav-item[data-view="display"]').click();
  await page.getByRole("button", { name: "Edit sheet", exact: true }).click();
}

test("Markdown file components preview, save, print and survive export/reload", async ({ page }, testInfo) => {
  await openEditor(page);
  await page.locator("#sheet-attachments").setInputFiles([
    upload("phrase.json", JSON.stringify(phrase), "application/json"),
    upload("notes.md", "## Count slowly\n\n**Three beats** per bar.", "text/markdown"),
  ]);
  await page.getByRole("textbox", { name: "Sheet source", exact: true }).fill('# Melody\n\n<guitar-tab src="phrase.json" strings="1,2,3"></guitar-tab>\n\n<file-content src="notes.md"></file-content>');
  const preview = page.frameLocator('#sheet-editor iframe');
  await expect(preview.locator('.tab-note')).toHaveCount(3);
  await expect(preview.getByRole('heading', { name: 'Count slowly' })).toBeVisible();
  await page.getByRole('button', { name: 'Save sheet', exact: true }).click();
  await expect(page.locator('#sheet-editor')).not.toBeVisible();
  const sheet = page.frameLocator('main iframe');
  await expect(sheet.locator('.tab-note[data-beat="13.75"]')).toHaveAttribute('data-duration', '1.25');
  await expect(page.locator('main iframe')).toHaveAttribute('data-ready', 'true');
  const frame = await page.locator('main iframe').contentFrame();
  await frame.locator('body').evaluate(() => { window.print = () => { window.printCalled = true; }; });
  await page.getByRole('button', { name: 'Print sheet', exact: true }).click();
  await expect.poll(() => frame.locator('body').evaluate(() => window.printCalled)).toBe(true);
  const doc = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
  expect(doc.version).toBe(3);
  expect(doc.parts[0].sheet.files).toHaveLength(2);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save JSON', exact: true }).click();
  const path = testInfo.outputPath('custom-sheet.json');
  await (await download).saveAs(path);
  await page.reload();
  await page.locator('.nav-item[data-view="display"]').click();
  await expect(page.frameLocator('main iframe').locator('.tab-note')).toHaveCount(3);
  await page.locator('#import-file').setInputFiles(path);
  await expect(page.frameLocator('main iframe').locator('.tab-note')).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath('custom-sheet.png') });
});

test("full HTML and custom elements read attached files while isolated from the app", async ({ page }) => {
  await openEditor(page);
  await page.locator('#sheet-attachments').setInputFiles(upload('cue.json', '{"cue":"Hold through bar 4"}', 'application/json'));
  await page.getByLabel('Sheet format', { exact: true }).selectOption('html');
  const html = `<!doctype html><html><head><style>practice-cue{display:block;color:rgb(0,128,80)}</style></head><body><h1>HTML sheet</h1><practice-cue></practice-cue><script>
    customElements.define('practice-cue', class extends HTMLElement { connectedCallback() { this.textContent = crest.readJSON('cue.json').cue; } });
    try { parent.localStorage.setItem('escaped', 'yes'); } catch { document.body.dataset.isolated = 'yes'; }
    try { localStorage.setItem('unsafe', 'yes'); } catch { document.body.dataset.opaque = 'yes'; }
    fetch('https://example.invalid/leak').catch(() => { document.body.dataset.networkBlocked = 'yes'; });
  </script></body></html>`;
  await page.getByRole('textbox', { name: 'Sheet source', exact: true }).fill(html);
  const preview = page.frameLocator('#sheet-editor iframe');
  await expect(preview.locator('practice-cue')).toHaveText('Hold through bar 4');
  await expect(preview.locator('body')).toHaveAttribute('data-isolated', 'yes');
  await expect(preview.locator('body')).toHaveAttribute('data-opaque', 'yes');
  await expect(preview.locator('body')).toHaveAttribute('data-network-blocked', 'yes');
  expect(await page.evaluate(() => localStorage.getItem('escaped'))).toBeNull();
  await page.getByRole('button', { name: 'Save sheet', exact: true }).click();
  await expect(page.frameLocator('main iframe').locator('practice-cue')).toHaveCSS('color', 'rgb(0, 128, 80)');
});

test("missing files report an error; Cancel preserves the saved sheet", async ({ page }) => {
  await openEditor(page);
  const before = await page.evaluate((key) => localStorage.getItem(key), key);
  await page.getByRole('textbox', { name: 'Sheet source', exact: true }).fill('<guitar-tab src="missing.json"></guitar-tab>');
  await page.getByRole('button', { name: 'Save sheet', exact: true }).click();
  await expect(page.locator('.sheet-editor-status')).toContainText('Attach the file');
  await expect(page.locator('#sheet-editor')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(before);
});

test("v2 browser saves migrate to v3 without changing the old slot", async ({ page }) => {
  await page.goto('./');
  const old = await page.evaluate((key) => {
    const doc = JSON.parse(localStorage.getItem(key)); doc.version = 2;
    localStorage.setItem('crest-chord-builder.project.v2', JSON.stringify(doc));
    localStorage.removeItem(key); return doc;
  }, key);
  await page.reload();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key)).toEqual({ ...old, version: 3 });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('crest-chord-builder.project.v2')))).toEqual(old);
});

test("tab playback produces audio, follows its cursor, seeks and pauses other tabs", async ({ page }) => {
  // Observe the real Web Audio graph, including actual nonzero output samples.
  await page.addInitScript(() => {
    const NativeAudio = window.AudioContext;
    window.AudioContext = class extends NativeAudio {
      constructor(...args) {
        super(...args);
        const analyser = this.createAnalyser();
        analyser.connect(this.destination);
        const voices = [];
        window.tabAudio = { audio: this, analyser, voices };
        const oscillator = this.createOscillator.bind(this);
        this.createOscillator = () => {
          const node = oscillator();
          voices.push(node);
          return node;
        };
        const gain = this.createGain.bind(this);
        this.createGain = () => {
          const node = gain(), connect = node.connect.bind(node);
          node.connect = (target) => connect(target === this.destination ? analyser : target);
          return node;
        };
      }
    };
  });
  await openEditor(page);
  await page.locator('#sheet-attachments').setInputFiles(upload('phrase.json', JSON.stringify(phrase), 'application/json'));
  await page.getByRole('textbox', { name: 'Sheet source', exact: true }).fill('<guitar-tab src="phrase.json" strings="1,2,3"></guitar-tab>\n\n<guitar-tab src="phrase.json" from-bar="21" bars="2" strings="1,2,3"></guitar-tab>');
  await page.getByRole('button', { name: 'Save sheet', exact: true }).click();
  const frame = page.frameLocator('main iframe');
  const first = frame.locator('.tablature').nth(0), second = frame.locator('.tablature').nth(1);
  await first.getByRole('button', { name: 'Play tab', exact: true }).click();
  await expect(first).toHaveAttribute('data-playback-state', 'playing');
  await expect(first.locator('.tab-note-playing')).toHaveCount(1);
  await expect.poll(() => frame.locator('body').evaluate(() => {
    const samples = new Float32Array(window.tabAudio.analyser.fftSize);
    window.tabAudio.analyser.getFloatTimeDomainData(samples);
    return Math.max(...samples.map(Math.abs));
  })).toBeGreaterThan(0.001);
  const x = await first.locator('.tab-playhead').first().getAttribute('x1');
  await expect.poll(() => first.locator('.tab-playhead').first().getAttribute('x1')).not.toBe(x);
  await first.getByRole('button', { name: 'Pause tab', exact: true }).click();
  await expect(first).toHaveAttribute('data-playback-state', 'paused');
  await expect(first.locator('.tab-note-playing')).toHaveCount(0);
  await first.getByLabel('Playback tempo', { exact: true }).fill('120');
  await first.getByLabel('Playback tempo', { exact: true }).press('Tab');
  await first.getByLabel('Playback position', { exact: true }).evaluate((input) => {
    input.value = '12.5'; input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await first.getByRole('button', { name: 'Play tab', exact: true }).click();
  await expect(first.locator('.tab-note-playing[data-midi="74"]')).toHaveCount(1);
  expect(await frame.locator('body').evaluate(() => window.tabAudio.voices.at(-1).frequency.value)).toBeCloseTo(587.3295, 2);
  await second.getByRole('button', { name: 'Play tab', exact: true }).click();
  await expect(second).toHaveAttribute('data-playback-state', 'playing');
  await expect(first).toHaveAttribute('data-playback-state', 'paused');
  await second.getByRole('button', { name: 'Stop tab', exact: true }).click();
  await expect(second.getByLabel('Playback position', { exact: true })).toHaveValue('12');
  await first.getByRole('button', { name: 'Play tab', exact: true }).click();
  await page.getByRole('button', { name: 'Edit sheet', exact: true }).click();
  await expect(first).toHaveAttribute('data-playback-state', 'paused');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.emulateMedia({ media: 'print' });
  await expect(first.locator('.tab-transport')).not.toBeVisible();
  await expect(first.locator('.tab-playhead').first()).not.toBeVisible();
});
