# Harmonic Atlas: Circle, Modulation and Explore

The Atlas lets you audition a chord before writing it to the selected sketch slot. Click a chord to hear it; double-click or use **Insert chord** to keep its sounding pitches. Only **Apply scale** changes the song scale. Register, inversion, and semitone controls operate on the preview. Explore remembers each node’s edits while that preset is open.

| Page | Try it |
|---|---|
| Circle of Fifths | In A minor, pick **G** on the outer ring; the circle row now offers G-rooted voicings. The first row still suggests song-scale triads and sevenths ranked by notes shared with the selected slot. Select pitch classes to require those notes. Search **G7/B** to audition a G dominant seventh with B in the bass. Page through longer result sets. |
| Modulation | Choose a major or relative-minor destination on the wheel, or change its mode. The first row shows origin triads whose pitches belong to both scales. The cadence row shows a predominant, dominant seventh and landing chord for the selected destination degree. **Play path** auditions origin, a distinct shared pivot if available, then the cadence. The bottom row contains the actual destination triads. |
| Explore | Start with **Ambient / Bright**. The lower-middle node is A♭ major and the top node F minor. Click F minor: the suggested scale and node colours update but the composition stays in A minor. Toggle **Dynamic scale** for fixed song-scale colouring; **Match song tonic** chromatically transposes the entire constellation to the song tonic. The preset’s semitone control shifts all 16 chords; the footer edits only the selected chord. |

## Load the owner's Scaler 3 data

```sh
python3 -B composer/tools/index_atlas.py
CREST_VERIFY_ATLAS=1 python3 -B composer/tests/test_index_atlas.py -v
```

The tool verifies the entire installed Scaler 3.4.0 binary before reading two musical resources. It produces `~/Library/Application Support/Crest Composer/Local Bank/atlas-v1.json`: **81 presets, 1,296 ordered voiced chords and 253 search formulas**. `--output <directory>` publishes to another local directory outside this repo. Identical files are reused; a different file or symlink at the destination is refused. The main `index.json`, motion MIDI files and Scaler installation are untouched. Reopen the editor after indexing. When the sidecar is missing, Circle still searches Crest’s smaller formula library, Modulation works, and Explore displays setup instructions.

The verified sidecar is 88,069 bytes, SHA-256 `c27942c69069790347840263165b8d1bc330b2f7af0076e4510f11bfe82e6c06`. The main index still has SHA-256 `cc3f9bdebd454d5d94049a7add8a72a697bec10d001d2662e5197216f654b0c1`.

## Evidence and reconstruction boundaries

* **Layout and behaviour:** [Prior image descriptions](scaler-workflow.md), plus visual and text inspection of the [installed guide](scaler-installation.md), pp. 60–68, 110. Page 60 separates slot/note-based suggestions, selected-wheel-key suggestions and name search. Pages 61–63 document destination-scale, pivot-path and secondary-dominant audition. Pages 64–66 document three additional presets (Modal Interchange, Mediants, Neo-Riemannian); the Atlas implements the destination/pivot/cadence workflow, not these other presets. Pages 67–68 show the actual 16-node layout, the location of the tonal centre and relative key, the genre/mood controls, fixed/dynamic distinction and transposition. The preview/keep separation also appears in the earlier [sketch workflow](https://www.figma.com/board/n8j5NcIqGPhbUK5pTZAOSH).
* **Artifact identity:** REA range evidence `ev_7cac46ef551e606e2d1e5bf46acedcae7c5409be3524f3b2acf34c70debb7c6e` identified the 117,428,864-byte `Scaler 3` executable, SHA-256 `ee469bd2458668d7740c38df51f3caca97f2b4b48111b3a4ec80a4a3cfef8fb0`, and the 96,860-byte Explore window. The earlier architecture evidence is linked in [installation notes](scaler-installation.md). The counts and musical fields below come from separate JSON parsing, not entropy or architecture analysis.
* **Exact pitches:** whole-file ranges `[43144448,43244032)` (chord dictionary) and `[44018208,44115068)` (Explore JSON, SHA-256 `4bb6a42dbae701c61f2638b921300799073f16a11a0cb492c2a75cf31169060e`; byte-identical second copy at 103744565). Every genre has Bright, Neutral and Dark; every record has a distinct UUID and 16 ordered interval arrays. Adding 60 to *each signed interval* retains the original voicing, including octave doublings and bass. The 60 anchor is a Crest reference register. There are 2–9 notes per chord; source intervals span −35 through +22. No factory bank is included in the repository.
* **Diagram mapping (inference corroborated against p. 67):** slots 0–4 form the inner pentagon, starting at lower centre then moving through the lower left, upper left, upper right, lower right. Slots 5–15 follow the outer ring clockwise from twelve o’clock. In Ambient Bright slot 0 sounds `[48,51,56,63]` (A♭ major with C bass); slot 5 sounds `[48,56,60,65]` (F minor with C bass); slot 15 sounds B♭ minor. The drawing joins each ring and its adjacent regions. Edges do not impose a progression.
* **Names and ranking:** the Explore resource has no chord-name, root, coordinate or per-node-scale field. Its stored pitches are authoritative. The importer matches pitch classes against dictionary formulas, including allowed omissions, and prefers fewer omissions, simpler symbols, then the bass root. E.g. a minor seventh can have the same classes as a major sixth; a displayed label can differ from Scaler. A `voicing` label means no exact compatible formula. Circle ranks shared tones and actually filters requested notes. Modulation computes scale intersection and cadential function; paths are not a copy of Scaler’s native list.
* **Dynamic scale (bounded static evidence):** arm64 `otool -tV` for `ExploreComponent::updateDynamicScale` (`0x541880`) shows a call to `Chord::getInternalChord` at `0x541990`, `Analyse::setChords` at `0x541a80`, `Analyse::run` at `0x541b20` and `Analyse::getResults` at `0x541b2c`. This supports recomputation from chord content. It does not establish the analyser’s ranking. Crest compares the chord's distinct pitch classes against its eight supported modes on the inferred harmonic root, preferring familiar major/minor modes on a tie. Colour uses zero, one, or two-or-more foreign pitch classes. No Scaler process, project or MIDI capture was used to claim rendering parity.

## Integration and tests

Compile `composer/HarmonicAtlas.cpp` with the existing `Harmony` and `LocalBank` modules. `HarmonicAtlasMusic.h` is a private header. The public `setView`, `setScale`, and optional `setContextChord(std::optional<harmony::Chord>)` setters are silent. `onChoose` carries preview/focus; `onInsert` carries the edited chord for the destination; `onScale` fires only on the explicit button. All callbacks run on the JUCE message thread. No editing occurs on the audio thread.

For integration tests, recursively find visible components by JUCE ID (all prefixed `atlas.`):

| ID suffix | Control |
|---|---|
| `wheel.0`…`wheel.11`, `wheel.12`…`wheel.23` | Outer C–G–D… keys; corresponding inner Am–Em–Bm… keys |
| `row.R.C`, `row.R.prev`, `row.R.next` | Visible result pad or page control; 0-indexed rows 0–2 and columns 0–6 |
| `search`, `note.0`…`note.11` | TextEditor, note filter buttons C through B |
| `mode`, `degree`, `path` | Destination mode, cadence landing degree, start/stop path |
| `genre`, `mood`, `node.0`…`node.15` | Preset selectors and audible constellation nodes |
| `dynamic`, `lock`, `transpose` | Dynamic/fixed colour toggle, match song tonic, preset semitones |
| `octave`, `inversion`, `semi`, `audition`, `insert`, `apply` | Shared editing and explicit actions; combo IDs are 1-based starting at the minimum value |

`composer/tests/atlas.cpp` is a JUCE console test source (link as for `workflow_tests`); run the resulting executable with `--installed` to check all 81 presets, or without flags for Circle/Modulation only. An optional second argument is an absolute output directory for **Crest** component snapshots. The checks distinguish audition, insert and apply; verify slash-bass, octave and per-node inversion pitches; and exercise the default and 800×300 layouts. `test_index_atlas.py` independently compares every local note vector with the installed source, plus refusal to overwrite an edited destination.
