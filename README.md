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

The included workflow runs the unit tests, builds WebAssembly, and deploys `dist/` using GitHub's Pages artifact. The expected URL is <https://crestenstclair.github.io/crest-chord-builder/> once the workflow succeeds. The site is published from `main`; each push triggers this workflow.

All asset URLs are relative. The same `dist/` works at a repository subpath, a custom domain, or another static host that serves `.wasm` files. Serve it over HTTP(S), rather than opening `index.html` with `file://`. HTTPS is supplied by GitHub Pages. No paid hosting service or server process is required in production.

## Use the workspace

- **Guitars:** choose a tuning preset from the groups for 6, 7, and 8 strings, then customize pitch and octave in the editor below. The preset sets the string count and pitches together. New guitars use names such as “Guitar 1”; optional names and guitar selection are under **Saved guitars & name**. Treble string 1 appears at the top; physical storage order remains bass to treble, including re-entrant tunings. The interval column includes octave distance and direction; the smaller interval under each pitch is relative to the selected part’s root. Middle C is C4 (MIDI 60). [Tuning presets and sources](docs/tunings.md) document all 20 presets. Legacy imports with fewer strings remain supported.
- **Parts:** name each part, select its guitar, root, and scale, then select a triad to open the workshop. The catalog includes 23 scales: modes, harmonic and melodic minor, pentatonic, blues, symmetric, and other collections. **Custom scale** lets you name an interval collection. Triads stay inside the selected scale; changing a scale does not rewrite saved chords. Start new chords from the interval palette; scales without standard triads offer their individual intervals as starting notes. Each named part contains its own ordered progression, visible in the sidebar and selectable in Play & Print.
- **Chord workshop:** choose root and quality with the visible buttons, then edit the interval grid. Columns group each degree’s variants: for example, 3 / ♭3 and ♯5 / 5 / ♭5. Each interval shows **In key** or **Out of key** against the part’s scale, including when selected. In-key choices have solid green borders; out-of-key choices have dashed amber borders and remain selectable. The hints update when the chord root changes. Selecting another variant replaces that degree; clicking an active interval removes it. Extensions change only the selected tone: 9 does not add a seventh. Each change regenerates and auditions the resulting grip. **Inversion** filters suggested grips by their lowest tone; **Current** reports the actual inversion of the displayed fingering. Manual note selection, muting, and octave changes clear the filter and detect inversion from the lowest sounding pitch, including in re-entrant tunings. Select a hand position to constrain fretted notes; open strings remain available. The side panel shows the chord box, alternative grips, and per-string octave controls. [Workshop design and references](docs/workshop-design.md) explain the interaction choices.
- **Manual fingering:** **Select voicing** starts a new grip when you click any chord tone. Continue clicking chord tones to build the voicing: one fret per string, click a selected note to remove it, or click another fret on that string to replace it. Rings show the selected positions; the status lists chord tones not yet voiced. The formula stays fixed, including when you save a partial voicing. **Draw / remove** sets any fret and updates the chord intervals and name. The fretboard distinguishes chord tones, scale notes, and outside-scale notes (dashed borders). Per-string octave buttons shift 12 frets on the same string, within frets 0–24. Save uses the selected grip in the progression and Play & Print; Cancel or Escape discards edits. A new chord is added only after **Add to part**.
- **Themes and labels:** high-contrast light and dark themes work throughout the workspace and workshop. Intervals are the default; Play & Print also offers note names. Theme and label choices persist separately from project JSON.
- **Play & print:** shows the selected part's scale and six chord boxes at a time. Choose note names or intervals, select a fret window, increase size, and enter fullscreen/focus view. The default focus layout fits an eight-string scale and six chords at 1920×1080. Larger size settings intentionally use more space. Longer parts have chord-page arrows. **Print sheet** prints the scale and every chord in the selected part, including chords outside the current screen page. Browser “Save as PDF” also works; landscape and background graphics are recommended.
- **Save JSON / Open JSON:** move projects between browsers and keep backups. Opening a project validates the complete document before replacing the current session. Undo restores the previous session. Browser storage is per origin; local preview and GitHub Pages have separate saved sessions. Private browsing or clearing site data can remove browser saves, so download JSON for durable storage.

Retuning does not delete saved fingerings. Each chord stores a grip for each exact tuning it has used. Returning to that tuning restores the grip. Drawing notes updates harmonic intervals; voicing selection and automatic generation keep the selected harmony when tones are omitted. An older tuning snapshot with pitches outside the current chord is displayed using its actual harmony. Slash-bass labels follow the lowest sounding pitch. If two tabs edit the same browser session, the receiving tab pauses autosave rather than overwriting the other version; download its JSON before reloading.

## JSON format

See [`examples/first-idea.json`](examples/first-idea.json) for a complete portable project. The format is versioned, with no YAML parser required:

```json
{
  "format": "crest-chord-builder",
  "version": 2,
  "title": "First idea",
  "guitars": [
    { "id": "guitar1", "name": "Guitar 1", "strings": [40, 45, 50, 55, 59, 64] }
  ],
  "parts": [
    {
      "id": "verse",
      "name": "Verse",
      "guitarId": "guitar1",
      "root": 9,
      "scale": "minor",
      "chords": [
        {
          "id": "am7",
          "root": 9,
          "intervals": [0, 3, 7, 10],
          "formula": ["1", "♭3", "5", "♭7"],
          "bass": -1,
          "label": "",
          "fingerings": { "40,45,50,55,59,64": [-1, 0, 2, 0, 1, 0] }
        }
      ]
    }
  ]
}
```

`strings` contains absolute MIDI pitches (0–103). Root and bass are pitch classes (C=0, A=9); bass `-1` allows any inversion. The workshop saves the actual bass of the selected grip. Its inversion filter is temporary and opens at **Any**; it is not part of JSON. Chord intervals are unique semitone offsets from the root within an octave (0–11). Root interval `0` may be omitted for rootless chords; the harmonic root remains the reference. The optional `formula` stores explicit interval spellings, such as `♯11` versus `♭5`. Its labels must match `intervals` exactly, without duplicate pitches. Files without it infer spelling from their harmony; existing v2 readers can ignore it without changing the pitches. Frets are absolute: `-1` is muted, `0` is open, and `1`–`24` are fretted. Fingering keys are comma-separated tuning MIDI pitches, and arrays must match their key's string count. An empty `fingerings` object requests automatic generation when that part is opened.

Preset scale IDs and interval collections are defined in [`web/music.js`](web/music.js). A custom scale uses `"scale": "custom"` and `"customScale": {"name": "My scale", "intervals": [0, 2, 3, 7, 10]}` on the part. Scale intervals must include `0` and have no duplicates. IDs contain letters, numbers, underscores, or hyphens. Limits are 16 guitars, 100 parts, 64 chords per part, 32 saved tunings per chord, and 2 MiB per formatted JSON project. Imports reject unknown versions, missing guitar references, invalid pitches, duplicate IDs, or malformed fret arrays. Extra fields are discarded. The schema differs from the original `chordgen` song-sheet format; that older format is not directly imported.

Version 2 adds custom scales and rootless harmony. Imports accept versions 1 and 2 and export version 2. On startup, the browser reads `crest-chord-builder.project.v2`; when absent, it migrates the v1 slot into v2 and leaves the original slot untouched. An invalid v2 save never falls back silently or overwrites either slot. For rollback, the old site can still read its original v1 slot; v2 changes require exporting JSON and are not automatically copied backward. Keep the v1 example as a compatibility fixture. Storage changes to either slot pause autosave in other open tabs.

## Engine and design

- `engine/` is the reusable Go voicing library, extracted from the existing `ableton-mcp/chordgen` engine. `engine.Generate` is the validated public entry point.
- `cmd/wasm/` exposes that library to a dedicated browser worker. Search is bounded to a four-fret hand span within the chosen region of frets 0–24, with twelve ranked alternatives. Extended chords with five or more tones may omit their perfect fifth. Search results are suggestions; some tunings or chords need manual fingering. Re-entrant bass is determined by the lowest sounding MIDI pitch, not string position.
- `web/music.js` owns scale spelling, harmonization, note matching, and chord naming. Ambiguous note sets prefer the selected root. Unrecognized chords display their explicit interval set instead of an invented name. Playback is a simple Web Audio audition, not a sampled guitar.
- `web/chord-formula.js` owns interval spellings, degree variants, and their validation. Manual fretboard edits retain the spellings of unchanged tones.
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

Browser tests use an installed Google Chrome in an isolated headless profile. They exercise the actual WebAssembly worker, 6/7/8-string tuning controls, interval previews and extensions, inversion, hand positions, themes, custom scales, named parts, octave edits, voicing selection and persistence, JSON migration and round trips, concurrent-tab protection, mobile navigation, 1080p focus layout, and print output. Screenshots and a print PDF are written to ignored `test-results/` folders. Unit tests cover music rules, malformed input, tuning snapshots, and the original ergonomic engine.
