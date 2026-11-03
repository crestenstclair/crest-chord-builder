# Custom practice sheets

Open **Play & Print → Edit sheet**. Write Markdown or HTML, attach files, and check the preview. **Save sheet** applies the draft to the current part. Cancel leaves the saved sheet unchanged. **Use standard sheet** restores the regular scale/chord display; Undo can restore the custom sheet.

Each part has its own sheet. The layout can replace the standard display or appear after its scale and chord diagrams. Fullscreen, theme, display size, and Print sheet work with custom sheets. Printing targets the complete sheet document, including content below the screen. CSS can add page breaks with `break-before: page` and keep figures together with `break-inside: avoid`.

## Markdown and components

Markdown supports headings, lists, tables, links, code fences, and embedded HTML. Component tags need explicit closing tags and blank lines around them.

```html
# Practice plan

Count **1 · 2 · 3** and sustain through each written duration.

<guitar-tab src="melody.json" bars-per-row="4"></guitar-tab>

<scale-map start="5" labels="intervals"></scale-map>

<chord-sheet></chord-sheet>

<file-content src="notes.md"></file-content>
```

| Component | Behavior |
| --- | --- |
| `guitar-tab` | Loads an attached `crest-tab` JSON file. `bars-per-row` is 1–8 (default 4). Optional `from-bar` and `bars` select an absolute bar range. Always shows every string, treble first; the legacy `strings` attribute is ignored. |
| `scale-map` | Uses the current part's scale and guitar tuning. `start` is fret 0–12. `labels` is `intervals` (default) or `notes`. |
| `chord-sheet` | Displays all saved chord fingerings in the current part, using the selected guitar. Use the previous/next arrows to browse voicings. Each choice saves to the current tuning and supports Undo. Editor previews show disabled arrows; save the sheet to change fingerings. |
| `file-content` | Includes an attached Markdown, HTML, image, or text file. JSON and other text are shown as code. Includes can nest four levels. |

Tab notation is engraved with bundled VexFlow (MIT), including its music glyphs. It works without a font CDN or external notation service.

### Tab playback

Every `guitar-tab` has **Play/Pause**, **Stop**, a **Tempo** field (20–400 BPM), and a position slider. The moving cursor follows the current bar and beat; sounding fret numbers are highlighted. Use the slider to start at a particular phrase, including after a leading rest. Stop returns to the first displayed bar. Playback finishes at the end of the displayed range, including trailing rests.

The browser synth plays the tab's MIDI pitches and exact quarter-note durations. Chords sound together, held notes continue across rows, and `from-bar`/`bars` limit playback to the visible excerpt. A declared `pitchShift` is applied to the sound once, without changing fret labels. Tempo changes affect playback speed without transposing notes or changing the saved tab file. This is a built-in synth, not a connection to Ableton or an external MIDI device.

Only one tab plays at a time within a sheet. Playback pauses when the sheet editor opens, the browser tab becomes hidden, or a containing details panel closes. Leaving or replacing the sheet releases its audio. Controls and the cursor are excluded from print. Existing tab JSON needs no changes, and playback requires no external samples, account, or network service.

Images can also use Markdown, for example `![Picking pattern](picking.png)`. HTML `<img src="picking.png">`, `<link rel="stylesheet" href="layout.css">`, and `<script src="components.js"></script>` resolve attached files by exact filename. Files are embedded in the project JSON; no paths to files on your computer are retained. Reattaching the same filename replaces that file in the editor draft. Text attachments can be edited by clicking their name.

## Full HTML and your own components

HTML mode accepts a fragment or the content of a complete HTML document, including inline CSS, SVG and JavaScript. The renderer supplies the outer document and theme, so put body styling in CSS rather than attributes on the original `<html>` or `<body>` tags. Markdown also permits embedded HTML and scripts. Native web components need no build step:

```html
<style>
  practice-cue { display: block; padding: 1rem; border: 2px solid teal; }
</style>
<practice-cue src="cue.json"></practice-cue>
<script>
  customElements.define("practice-cue", class extends HTMLElement {
    connectedCallback() {
      this.textContent = crest.readJSON(this.getAttribute("src")).cue;
    }
  });
</script>
```

The attached `cue.json` might contain `{"cue":"Hold the last note through bar 4."}`.

Every sheet receives this browser API:

| API | Result |
| --- | --- |
| `crest.readText("notes.md")` | The text of an attached UTF-8 file. Throws for a missing or binary file. |
| `crest.readJSON("melody.json")` | Parses an attached text file as JSON. |
| `crest.fileURL("picking.png")` | A data URL for an attachment, usable in images or CSS. |
| `crest.filenames` | Attached filenames. |
| `crest.guitar` | The selected guitar's name, ID, and tuning MIDI pitches, bass to treble. |
| `crest.part` | The selected part's scale and chords, without its sheet source/files. |

Sheets run in an iframe with an opaque origin. Their scripts cannot access the parent application, browser project storage, or arbitrary local files. Inline scripts and attached JavaScript run inside that sheet. The content policy blocks `fetch`, remote scripts, remote stylesheets, and external asset loads; links or scripts can still navigate the isolated sheet itself. Use `crest` to read attached files. This is browser HTML/JavaScript, not MDX or a React compiler. Import any files a component needs through **Add files**.

The project remains browser-only and portable. Limits: 200,000 source characters; 32 attachments; 512 KiB per attachment; 2 MiB for the complete formatted project JSON. Supported text types are JSON, Markdown, HTML, CSS, JavaScript, plain text, and SVG; raster images are PNG, JPEG, and WebP.

## Tab file format

```json
{
  "format": "crest-tab",
  "version": 1,
  "title": "Melody",
  "source": "Ableton Live — track and clip identifiers",
  "tuning": [40, 45, 50, 55, 59, 64],
  "tempo": 90,
  "meter": [3, 4],
  "startBar": 17,
  "bars": 4,
  "pitchShift": 0,
  "events": [
    { "beat": 0, "duration": 3, "string": 1, "fret": 5, "midi": 69 },
    { "beat": 3, "duration": 1.75, "string": 1, "fret": 10, "midi": 74 },
    { "beat": 4.75, "duration": 1.25, "string": 1, "fret": 7, "midi": 71 },
    { "beat": 9, "duration": 3, "string": 1, "fret": 5, "midi": 69 }
  ]
}
```

- `tuning` is an exact snapshot, bass side to treble side, with 1–8 absolute MIDI pitches. Middle C is MIDI 60; this site calls it C4. Producer Pal/Ableton calls that same pitch C3.
- `string` is the player's string number: **1 is the treble string**. `fret` is 0–24. The written pitch is `tuning[tuning.length - string] + fret`; optional `midi` must match it.
- `beat` is a zero-based offset from this tab's start, in **quarter notes**. `duration` uses the same unit. A 3/4 bar lasts 3; a 6/8 bar also lasts 3. Preserve fractional timing instead of rounding it to a grid.
- `startBar` gives the first absolute arrangement bar, default 1. `bars` is 1–256. All events must fit inside that range. Events on one string cannot overlap. Different strings may sound together.
- Empty time is a rest. Tabs use conventional fret numbers, rhythmic stems/flags, dots, beams, barlines, and ties. Sustains split at barlines or rhythmic boundaries with ties, without extra playback attacks. Binary rhythms through 128th notes and triplets are supported. Finer timing is rounded for engraving with an explicit notice; MIDI playback keeps the original timing. Notes too short to engrave report an error.
- `pitchShift` documents an external guitar output shift in semitones (default 0). It does not change fret labels. To match source MIDI through a −2-semitone shifter, choose frets that produce source MIDI + 2.
- Tabs preserve their original tuning when the guitar changes. A tuning mismatch is shown explicitly; frets are never silently reinterpreted.

## Instructions for an LLM

Export the user's project with **Save JSON**, then provide that JSON and this document to the LLM. Ask it to preserve the existing guitars, parts, IDs, chord formulas, and fingering snapshots, and add or update only the intended part's `sheet`.

```json
{
  "format": "markdown",
  "layout": "replace",
  "source": "# Practice\n\n<guitar-tab src=\"melody.json\"></guitar-tab>\n",
  "files": [
    {
      "name": "melody.json",
      "mime": "application/json",
      "encoding": "utf8",
      "content": "THE TAB JSON SERIALIZED AS A STRING"
    }
  ]
}
```

This object belongs at `parts[i].sheet` in a `crest-chord-builder` **version 3** project. Other valid sheet formats are `html`; other layouts are `append`. Text file content is UTF-8 text. Raster image content is base64 without a data-URL prefix and uses `encoding: "base64"` with the matching image MIME type. Filenames have no directories.

For music-derived sheets, include source track/clip identifiers, tempo, meter, bar offsets, tuning, and any deliberate transposition. Verify every fret against its MIDI pitch and retain source rests and durations. When producing a guitar reduction instead of all source notes, label that reduction explicitly.

An LLM can alternatively return a `.md`/`.html` document and separate attachments. Open the source in **Edit sheet**, add those files, and save. No backend, API key, or model connection is needed by the website.
