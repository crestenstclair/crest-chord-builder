# Crest Chord Builder

A browser-only guitar workspace: configure your instrument, build harmony for each part, edit individual chord fingerings, and play from a large scale map and printable chord sheet.

The website has no backend, accounts, runtime package dependencies, analytics, or external font/CDN requests. GitHub Pages serves the static files. A Go WebAssembly worker runs the ergonomic chord engine locally; your project stays in browser storage until you download it as JSON.

## Run locally

Install Go 1.26 and Node.js 20 or newer, then run:

```sh
npm run build
npm start
```

Open <http://127.0.0.1:4173/crest-chord-builder/>. The preview server also serves the site at `/`. Rebuild and reload after source changes. `npm ci` is only needed for the optional browser tests; building the site uses the standard libraries in Go and Node.

## Publish on GitHub Pages

1. Push this repository to `crestenstclair/crest-chord-builder`, using the `main` branch.
2. Open **Settings → Pages → Build and deployment** and choose **GitHub Actions** as the source.
3. Run **Actions → Deploy GitHub Pages → Run workflow**, or push another commit to `main`.

The included workflow runs the unit tests, builds WebAssembly, and deploys `dist/` using GitHub's Pages artifact. The expected URL is <https://crestenstclair.github.io/crest-chord-builder/> once the workflow succeeds. The code is prepared for deployment; creating these files does not itself publish the site.

All asset URLs are relative. The same `dist/` works at a repository subpath, a custom domain, or another static host that serves `.wasm` files. Serve it over HTTP(S), rather than opening `index.html` with `file://`. HTTPS is supplied by GitHub Pages. No paid hosting service or server process is required in production.

## Use the workspace

- **Your guitars:** add guitars with 1–8 strings. Choose a preset or set every string's pitch class and octave. Strings are stored in physical order from bass side to treble side, including re-entrant tunings. The interval column includes octave distance and direction; the smaller interval under each pitch is relative to the selected part's scale root. Middle C is C4 (MIDI 60).
- **Build parts:** add a part, select its guitar and scale, then add chords from triads, sevenths, ninths, or first inversions. Each part has its own harmony and ordered chord list. A scale change updates the palette; it does not rewrite existing chords. Arrows beneath chord diagrams cycle through generated grips. Small bottom arrows reorder chords.
- **Chord workshop:** click **Edit**, or **Build a chord**. Choose a root and quality; **Find a grip** runs the search. In **Move notes**, select a sounding note, then click a matching fret. Solid rings indicate the exact pitch; dashed rings indicate the same note in another octave. Occupied destination strings must be muted first. **Draw / remove** sets any fret and can change the chord's harmony. Per-string octave buttons shift by 12 frets on the same string, within frets 0–24. The detected name and slash bass follow the sounding pitches. Save applies the edit; Cancel or Escape discards it.
- **Play & print:** shows the selected part's scale and six chord boxes at a time. Choose note names or intervals, select a fret window, increase size, and enter fullscreen/focus view. The default focus layout fits an eight-string scale and six chords at 1920×1080. Larger size settings intentionally use more space. Longer parts have chord-page arrows. **Print sheet** prints the scale and every chord in the selected part, including chords outside the current screen page. Browser “Save as PDF” also works; landscape and background graphics are recommended.
- **Save JSON / Open JSON:** move projects between browsers and keep backups. Opening a project validates the complete document before replacing the current session. Undo restores the previous session. Browser storage is per origin; local preview and GitHub Pages have separate saved sessions. Private browsing or clearing site data can remove browser saves, so download JSON for durable storage.

Retuning does not delete saved fingerings. Each chord stores a grip for each exact tuning it has used. Returning to that tuning restores the grip. Names are computed from the actual sounding notes, including older saved grips. If two tabs edit the same browser session, the receiving tab pauses autosave rather than overwriting the other version; download its JSON before reloading.

## JSON format

See [`examples/first-idea.json`](examples/first-idea.json) for a complete portable project. The format is versioned, with no YAML parser required:

```json
{
  "format": "crest-chord-builder",
  "version": 1,
  "title": "First idea",
  "guitars": [
    { "id": "standard", "name": "Standard six", "strings": [40, 45, 50, 55, 59, 64] }
  ],
  "parts": [
    {
      "id": "verse",
      "name": "Verse",
      "guitarId": "standard",
      "root": 9,
      "scale": "minor",
      "chords": [
        {
          "id": "am7",
          "root": 9,
          "intervals": [0, 3, 7, 10],
          "bass": -1,
          "label": "",
          "fingerings": { "40,45,50,55,59,64": [-1, 0, 2, 0, 1, 0] }
        }
      ]
    }
  ]
}
```

`strings` contains absolute MIDI pitches (0–103). Root and bass are pitch classes (C=0, A=9); bass `-1` allows any inversion. Chord intervals are unique semitone offsets from the root within an octave, including `0`. Frets are absolute: `-1` is muted, `0` is open, and `1`–`24` are fretted. Fingering keys are comma-separated tuning MIDI pitches, and arrays must match their key's string count. An empty `fingerings` object requests automatic generation when that part is opened.

Scale IDs are `major`, `minor`, `dorian`, `phrygian`, `lydian`, `mixolydian`, `locrian`, `harmonic`, and `melodic` (ascending melodic minor). IDs contain letters, numbers, underscores, or hyphens. Limits are 16 guitars, 100 parts, 64 chords per part, 32 saved tunings per chord, and 2 MiB per formatted JSON project. Imports reject unknown versions, missing guitar references, invalid pitches, duplicate IDs, or malformed fret arrays. Extra fields are discarded. The schema differs from the original `chordgen` song-sheet format; that older format is not directly imported.

## Engine and design

- `engine/` is the reusable Go voicing library, extracted from the existing `ableton-mcp/chordgen` engine. `engine.Generate` is the validated public entry point.
- `cmd/wasm/` exposes that library to a dedicated browser worker. Search is bounded to a four-fret hand span within frets 0–24, with twelve ranked alternatives. Ninth chords may omit their perfect fifth. Search results are suggestions; some tunings or chords need manual fingering. Re-entrant bass is determined by the lowest sounding MIDI pitch, not string position.
- `web/music.js` owns scale spelling, harmonization, note matching, and chord naming. Ambiguous note sets prefer the selected root. Unrecognized chords display their explicit interval set instead of an invented name. Playback is a simple Web Audio audition, not a sampled guitar.
- `web/project.js` validates JSON and owns tuning-specific fingering snapshots. `web/voicings.js` manages worker requests and caching. UI modules render the workspace, diagrams, and editor.
- `scripts/build.mjs` copies static assets and compiles WebAssembly. `scripts/serve.mjs` is a development preview only.

The ergonomic rules and their original sources are preserved in [`engine/RESEARCH-voicing-sources.md`](engine/RESEARCH-voicing-sources.md). Core source was extracted from `ableton-mcp/chordgen` at commit `d678b1d`; the browser adapter, validation, and re-entrant bass correction are new. The generated WebAssembly binary is about 3.3 MB before HTTP compression.

## Verify

```sh
npm test
npm run build
npm ci
npm run test:browser
```

Browser tests use an installed Google Chrome in an isolated headless profile. They exercise the actual WebAssembly worker, eight-string tuning, octave edits, note relocation, JSON round trips, concurrent-tab protection, mobile part navigation, 1080p focus layout, and print output. Screenshots and a print PDF are written to ignored `test-results/` folders. Unit tests cover music rules, malformed input, tuning snapshots, and the original ergonomic engine.
