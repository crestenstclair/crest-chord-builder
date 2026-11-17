# Crest Chord Reference — macOS VST3

A reference-only plug-in for keeping guitar parts inside Ableton Live sets.
It bundles a WKWebView viewer and all required assets. No server, browser session,
network connection, or external JSON file is needed after configuration.

## Install and use

The installer copies the built bundle to:

```text
~/Library/Audio/Plug-Ins/VST3/Crest Chord Reference.vst3
```

1. In Ableton Live, enable **Use VST3 Plug-In System Folders** under **Settings → Plug-ins**, then **Rescan**. If it was already open, restarting Live may be necessary.
2. Find **Crest → Crest Chord Reference** under VST3 and add it to an audio track (or after an instrument). Audio passes through unchanged, with zero added latency.
3. Open the plug-in, click **Project JSON**, paste a project exported using Crest Chord Builder's **Save JSON**, then click **Apply JSON**. **Open JSON file…** is an alternative; the file is read once, not linked.
4. Wait for **Stored in plug-in**, then save your Live set. The project, sheets, attachments, selected part, theme, zoom, labels, and fret window are stored in that instance's host state.

Each instance has its own independent copy. Replacing JSON in one instance does
not update other instances or browser projects. To update the reference later,
paste a new export and save the Live set again. Keep the exported JSON as a backup.

Intervals are the default. All displayed fret numbers are physical, absolute frets
from the nut, including with a capo. The window is resizable.

## Scope and limitations

- Accepts the existing Crest project format, versions 1–3, up to 2 MiB, including per-part custom sheets and attachments. It is not an arbitrary JSON viewer.
- Shows **saved fingerings**; it does not generate missing grips, edit chords, or change voicings. Save the desired shapes in the browser app before exporting. Missing compatible grips remain unavailable.
- Generated tablature playback controls are disabled. This is not an instrument, transport-synced player, or MIDI generator.
- Custom HTML/JavaScript sheets run in an isolated sandbox without the native bridge or parent storage. Their arbitrary runtime state is not saved; their source and attachments are saved.
- Targets macOS 13 or later; universal `arm64` and `x86_64` (runtime-tested on macOS 26). Only VST3 is packaged. Windows/Linux, AU, AAX, and notarized distribution installers are not included.
- The local bundle is ad-hoc signed, not Developer ID signed or notarized. A Live set still needs the plug-in installed on the Mac that opens it, but does not need this repository or the original project JSON file.

## Build from source

Requires Node.js 20+, Go 1.26, Python 3, CMake 3.22+, and Apple's Command Line Tools.
The build fetches pinned JUCE 8.0.12 unless `CREST_JUCE_SOURCE` points to an existing
checkout. Review [third-party licensing](THIRD_PARTY.md) before redistribution.

```sh
npm ci
npm run build:plugin
ctest --test-dir plugin/build --output-on-failure
npm run install:plugin
```

An existing installation is backed up under `output/plugin-backups/` first.
The built bundle is at
`plugin/build/CrestChordReference_artefacts/Release/VST3/Crest Chord Reference.vst3`.
`CREST_BUILD_JOBS` optionally controls build parallelism (default 4).

## Verification

```sh
npm test
PORT=4174 npx playwright test test/browser/reference.spec.js
ctest --test-dir plugin/build --output-on-failure
# Requires a logged-in macOS desktop; opens temporary integration-test windows:
plugin/build/reference_native_tests_artefacts/Release/reference_native_tests --web "$PWD/examples/first-idea.json"
```

The native WebKit test exercises actual JSON configuration, rendered diagrams,
invalid-input preservation, preferences, editor close/reopen, state restoration
while the editor is open, and recall into a newly created processor. This is not
an Ableton Live-set round-trip test and does not alter any open DAW set.

The processor owns a versioned state blob independent of editor lifetime. A
generation token prevents delayed frontend writes from replacing a host restore.
No locks, allocation, or web code run in the audio callback.
