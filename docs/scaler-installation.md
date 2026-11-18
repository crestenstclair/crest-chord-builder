# Installed Scaler banks: what the composer can use

**Both installed plug-ins contain readable note-event templates.** Scaler 3.4.0 has **1,334**, including **233 Performances**; Scaler 2.8.1 has **1,039**, including **151 Performances** under the older folder name `Grooves`. Both contain the same **113 Common Progressions chord-set records** (16 Roman-numeral progressions with multiple voicings). Load the owner's copy locally. No DAW, network, factory-bank redistribution, MIDI capture, or Scaler process is required to read those records.

The stored pitches, voicings, timing and velocities are exact source data. Playing a template against *a different chord*, using an articulation such as Divisi, or rendering with Scaler's playback modifiers involves additional behavior. A composer playback rule should be identified as its own adaptation; the user's Scaler MIDI export is the reference for exact rendered output.

## What was inspected

Read-only inspection on macOS, 2026-11-17. `N` below is `Scaler 3` or `Scaler2`; the executable is `/Library/Audio/Plug-Ins/VST3/N.vst3/Contents/MacOS/N`. REA `open_bundle_resources` + `inspect_plist` identified the bundles; `open_binary` + `list_architectures` identified the executable in each. Sessions were closed. Separate Python stdlib ZIP/JSON parsing produced the musical counts below; those counts are not claims from the plist or a disassembler. Both Mach-O files have x86_64 and arm64 slices.

| Evidence | Scaler 3 | Scaler 2 |
|---|---|---|
| Bundle ID; version | `com.scalermusic.scaler3`; `3.4.0` | `com.pluginboutique.Scaler2`; `2.8.1` |
| REA plist evidence (resource-only) | `ev_0b00134d81a12f3b542a29290203000a83c96fc9c0620e73e717018a8a441b48` | `ev_70a921f032c6a9cf13d973ab8fea500d8439ecbb91022ca351f33b6c42431c63` |
| REA architecture evidence | `ev_141a71868d32aad4845e6c2e31f0633b4e5cdbe9e01e7e99344980ebcef8e22b` | `ev_2afe0bcd0665166daafda0d1fa6f802d88ffd8428fac5c7ffe98a8d52bc132ac` |
| Executable SHA-256 | `ee469bd2458668d7740c38df51f3caca97f2b4b48111b3a4ec80a4a3cfef8fb0` | `225097845ed9603d13c23538598e75bc4f22cf15541568a4d68d2e9bdd84544d` |
| ZIP file range, `[start,end)` in the whole executable | `[40524144,41759872)` | `[40710640,41538117)` |
| Byte-identical ZIP in second slice, start | `100250588` | `91231044` |
| ZIP SHA-256 | `9777160c94eab903e13980748135e3e007c546ac9585e9970c0767a23f03720a` | `1371758f462205af12e979ba0fd7dcb25dfcbe302c87a3f4bdc9ac3f2e06cf16` |
| Chord-bank JSON file range, excludes NUL | `[43244048,44018196)` | `[41932944,42290395)` |
| Chord-bank JSON SHA-256 | `f5f23aa5553fd0f410f7a2e359ba2e8690ab76b5ed5f6a0758c779c19d3d0d65` | `e1e01dbdb4de6fd34b8583d0e7503312b7421e2809f30cf2af90e1a21fa572a8` |

Scaler 3's loose bundle resources are an icon and `moduleinfo.json` (Instrument class, VST 3.7.8); Scaler2 has no `Contents/Resources`. Each corresponding shared `Sounds` tree contains 1,184 FLAC files. The factory event bank is in the executable. The Scaler 3 arm64 symbol table names `Scaler::Assets::MusicData::{ExpressionsData_zip,chordsets_json,chords_json,explorechords_json,tagging_json,scales_json}`. This investigation did not inspect individual user sessions, preferences, the shared opaque cache's contents, or account/license material. Neither plug-in nor host was run or modified. No bundled bank, MIDI, PDF or screenshot is included here.

**Installed original manuals** (numbers below are PDF page numbers):

- **S3**: `/Users/Shared/Scaler Music/Scaler 3/Scaler 3 User Guide.pdf`, 117 pp., SHA-256 `173f400a37d6602de083bb13f4ef0498b84657a40e80ca1db451ba586bca8a6a`.
- **S2**: `/Users/Shared/Plugin Boutique/Scaler2/Documents/PLUGINBOUTIQUE_Scaler2_Manual.pdf`, 59 pp., SHA-256 `d370a820f32a66abfcd225895b5ac743630d3947dd585f7915bbd801e9e78bef`.

## Performance and motion coverage

Counts are parsed musical members in **one** ZIP per build, grouped by directory. They are not a count of items observed in a running browser.

| Member family | S3 templates | S2 templates | S3 note events |
|---|---:|---:|---:|
| Performances (`Grooves` in S2) | 233 | 151 | 6,985 |
| Bass | 294 | 208 | 6,644 |
| Melody | 299 | 295 | 6,638 |
| Phrases | 282 | 183 | 11,235 |
| Rhythms | 102 | 102 | 5,786 |
| Sequences | 70 | 70 | 946 |
| StrummedSequences | 30 | 30 | 352 |
| Passages | 24 | — | 208 |
| **Total** | **1,334** | **1,039** | **38,794** |

- S3: 1,493 ZIP entries including directories and macOS sidecars. All 1,334 non-sidecar `.json` files contain `expressionsData`; the 11 other `.json` filenames are under `__MACOSX/`. S3 has no equivalent top-level expression manifest in this ZIP. 82 Performance records lack `type` (Jazz Soft 26, Uptempo Swing 19, Jazz Swing Feel 14, Dynamic 13, Jazz Movements 10). An adapter that requires `type == "performances"` silently loses them.
- S2: 1,148 ZIP entries; 1,039 templates with **31,846** events, plus `expressions.json`. That manifest references **1,037** real members. `Sequences/Common Sequences/Basic-19.json` and `Basic-20.json` are present, parse as musical templates, and are absent from its list. Offer an inventory vs manifest distinction if matching a presumed menu. Actual UI visibility was not tested.
- Join on `uuid`, not display name (names collide). Neither bank has duplicate template UUIDs. **1,038** UUIDs occur in both and **all 1,038** have identical parsed `expressionsData`; this includes all 151 S2 Grooves. S3 adds 296 UUIDs: 100 Phrases, 86 Bass, 82 Performances, 24 Passages, 4 Melody. `Phrases/Con Amore/Cavatina.json` is the only S2 UUID not in S3. The installed union is **1,335 distinct UUIDs**. The ordinary default for a two-install reader is prefer S3 on a shared UUID.
- S3's separate tag table (1,969 rows, file offset `41848288`) has `Type`, `Name`, `Sub Category`, `Genre`, `Style (Scale)`, `Feel/Mood`, `Key Feel`, `Complexity`, `Scale Mode`, `Function`, `Tempo` and two ancillary fields. These are display-level tags, not MIDI or a UUID index. It has 234 `Performance` but only 17 `Passages` tag rows; it is not a reliable way to count playable templates. S3 pp. 75–76 describes browser filtering by category, mood, genre and favourites.

### Source schema and mapping

`ExpressionsData/<family>/<optional subdirectory>/<name>.json` in S3; omit `ExpressionsData/` in S2. Use the record's `uuid`, `name`, `cleanName`, `category`, `source`, `folder`, `subfolder`, optional `type`, and `octaveDiff`. `expressionsData` has two children:

| Field | Meaning/evidence relevant to an adapter |
|---|---|
| `metaData.ticksPerBeat` | Integer PPQ: 480 for 1,117 S3 records and 96 for 217; 480 for every S2 record. Divide ticks by the **record's** PPQ to get quarter-note units. |
| `timeSignature.{numerator,denominator}`, `lastPosition` | Source meter and cycle end tick. S3 contains 3/4, 4/4, 5/4, 7/4, 9/4, 6/8 and 12/8. Cycles are 2–64 quarter notes. Do not infer duration from the final sounding note or assume one 4/4 bar. |
| `microsecondsPerBeat`, `allNotesNumber` | Tempo is optional (absent on the 217 S3 96-PPQ records). Pitch palette is indexed as stored. One palette in each bank is not in ascending order. |
| `events[]` | Every inspected event has `noteId`, `noteIndex`, `noteNumber`, `velocity`, `position`, `position_offset`, `duration`, `duration_offset`. Position and duration are ticks; all observed offsets are zero. For **every event**, `allNotesNumber[noteIndex] == noteNumber`. This is a source pitch index; it does not identify a destination guitar string, scale degree or a new chord's root. |

Example: S3 `ExpressionsData/Passages/Passage-21.json` has PPQ 96, cycle 768 ticks, meter 4/4, palette `[43,48,52,55]`. Event 0 starts at 0, index 1, note 48, velocity 61, duration 767. Literal source playback: pitch 48 at beat 0 lasting `767/96` beats; the clip lasts 8 beats. The first note need not be the tonic. Preserve intentional simultaneity and human timing. Across S3 there are 132 zero-duration events and seven records whose events are not sorted by onset (S2: 128 and five); all other durations are positive. All event ends fall within the recorded cycle. If a MIDI representation requires a positive gate, use a documented minimum or skip rule rather than failing the entire preset.

**What the template cannot say on its own.** S2 pp. 15–16 describes Performance as using the current chord's notes; Rhythm plays the chord on a preset rhythm, while Phrase/Bass/Melody may follow the scale or chord. Strummed sequences also have direction, variation and profile. S3 pp. 38, 75–79, 99–102 describes Follow vs Retrigger, motion tracks, global motion, speed, humanization and voice grouping. S3 calls Arpeggios, Passages, Strumming, Chord Follow, Bass Follow and Divisi *articulations*: only Passages has a namesake event-file family here. The separate [pitch-mapping investigation](scaler-performance-mapping.md) identifies the native S3 Performance and Rhythm selectors, including the role of source order and octave offset. Those two families have the additional MIDI metadata specified below. End-to-end rendered parity and the native mappings for the other families remain unverified.

## Progressions and harmonic shapes

In both chord banks the root is an object with array-valued categories. Records use `uuid`, `name`, `category`, `source`, `folder`, `subfolder`, `voicings`; `type` is present except on S3 `Uncommon`. `voicings` is an **ordered list of chord slots**; each `intervals` array contains signed semitones. Do not discard octave, repeated pitch classes or inversion by normalizing modulo 12. These records do not encode the timed expression events above.

| Array | S3 | S2 |
|---|---:|---:|
| `Voicings` | 14 | 14 |
| `Song Sets` (includes Common Progressions) | 707 | 557 |
| `Artist Sets` | 298 | 283 |
| `Community` | 30 | 30 |
| `Uncommon` | 20 | — |

Filter `bank["Song Sets"]` by **`subfolder == "Common Progressions"`**. The resulting lists compare equal in both builds. There are 113 unique UUIDs, 112 distinct exact voicing sequences, and these 16 title families (spelling preserved):

| | | | |
|---|---|---|---|
| `I-IV-I-V` | `I-IV-V-I` | `I-IV-V-IV` | `I-IV-ii-V` |
| `I-IV-vi-V` | `I-V-vi-IV` | `I-VII-I` | `I-ii-iii-IV-V` |
| `I-iii7-vi-IV` | `I-vi-IV-V` | `i-V-i-iv` | `i-VI-III-VII` |
| `ii7-V7-I7` | `ii-V-I-vi` | `vi-IV-I-V` | `vi-V-IV-V` |

Each has Triads, Coloured 1–3, Thickened 1–2 and Simple or Simple 1. `I-V-vi-IV` has **both** Simple and Simple 1, hence eight instead of seven. The duplicate note sequence is Coloured 1 vs Simple of `I-IV-vi-V`. The S3 `Uncommon` families are `I-#II-#VI-#V`, `I-#V-IV-bVII`, `I-VI-ii-V`, `v-IV-ii-I`, `vi-I-bIII-bVII`; each has Coloured, Simple, Thickened and Triads. Two variants have five actual chord slots despite their four-symbol titles. S3 pp. 43–44 distinguishes Common, Uncommon, Genre, Artist and User views; XML user-set management is independent of these factory records.

**Use content rather than reinterpreting the title.** The `Triads (I-V-vi-IV)` arrays are `[-12,-8,-5]`, `[-5,-1,2]`, `[-3,0,4]`, `[-7,-3,0]`. Adding 60 renders C, G, Am, F with the stored spacing. This is a reproducible reference transposition, not a claim about the plug-in's default octave. The two lower-case-tonic `Triads` sequences start on A minor in that reference. In `Triads (I-VII-I)` the middle pitches are B♭–D–F, not a leading-tone diminished chord; `Triads (ii7-V7-I7)` ends on a **major** seventh and `Triads (ii-V-I-vi)` begins with pitch classes D–G–C. Parsing Roman text alone would change the music.

## Colors and Sketch

**Colors is five independently selectable rows of harmonic choices for the selected scale.** S3 pp. 21, 69–70 explains choosing a color per row, row octave, audition and bind. Its p. 69 menu screenshot gives the first row of the table below; the other names are corroborated by strings prefixed `VOI:`, `VAR:`, `SUB:`, `INV:` at x86-slice file offsets near `47853111`. These are identified choices, not 41 universally available output chords.

| Category | Identified choices |
|---|---|
| Extensions | Triads; 7ths; 9ths; 11ths; 13ths; Suspended; 6ths & 7ths; Minor 7ths & 9ths; Suspended 4ths, 7ths & 9ths. The final item is one menu choice. |
| Voicings (11) | Voicing 1–7, Octaves & 3rds, Open 1–3 |
| Variations (7) | Tonic, Supertonic, Mediant, Subdominant, Dominant, Submediant, Leading Tone |
| Substitutions (9) | Parallel, Negative Harmony, Dominant, Subdominant, Dorian, Phrygian, Lydian, Mixolydian, Locrian |
| Inversions (5) | 1st Inversion, 2nd Inversion, 7ths Inverted, Octaves & Inverted 3rds, Triads Inverted |

The chord bank's 14 `Voicings` records contain 104 actual pitch arrays (7 or 8 each): Voicing 1–7, 6ths and 7ths, 7ths Inverted, Minor 7th,9ths, Octaves and 3rds, Octaves and Inverted 3rds, Suspended 4th,7th,9ths, Triads Inverted. The chord dictionary in S3 (253 keys; 255 in S2) includes name, degree formula, optional degrees, notation and UUID; the scales table has 77 vs 76 keys. S3 also has 81 `Explore` records in a separate table. These are not 81 additional Colors choices. Native symbols include `getVariationChords`, `getInversionChords`, `getOpenVoicingChords`, `getModalChords` and `getNegativeHarmonyChords`. A complete per-scale, per-setting rendered Colors matrix was not found in these parsed JSON resources or established by runtime observation. The UI's *color coding* is a separate rule: chords with zero, one, or at least two out-of-scale notes are blue, light blue, or grey respectively (S3 p. 110).

**Sketch is editable state, not a preset bank.** S3 pp. 19–20, 38, 50–52, 54, 71: seven lanes of up to eight ordered chord slots; append or replace, accept the first chords that fit, preserve gaps when copying to Main Track. Each lane auditions with the shared Chord Duration (default one bar), not per-slot Main Track lengths. Per-lane octave changes affect the chords already present, not future additions. Section C shows Main Track or a lane; showing one does not by itself bind it. Only one of Main Track and the seven Sketch lanes can be bound. Suggest can replace all or fill empty slots. These are documented behaviors; no user project or native serialized Sketch state was needed to establish them.

## Build and use the local bank

From the repo root run `python3 composer/tools/index_scaler.py`. It checks the two standard VST3 installation paths; either supported build or both may be present. It verifies the full executable SHA-256 **before** reading that build's ranges. An unrecognized installed build fails with the measured and expected hashes before any output is published. Use `--output '/path/to/new/local/directory'` to choose another destination outside the repository.

**Default populated and verified:** `~/Library/Application Support/Crest Composer/Local Bank/index.json` plus `motions/<uuid>.mid`. On the two builds above the index has **1,335 motions** (including 233 Performances), **113 common progressions** (445 slots), and **14 voiced color sets** (104 slots). The index is 404,929 bytes, SHA-256 `cc3f9bdebd454d5d94049a7add8a72a697bec10d001d2662e5197216f654b0c1`. MIDI files including selector metadata total **517,517 bytes**. All 335 files upgraded in place matched the previous plain writer byte-for-byte and were listed in the index covered by `.crest-scaler-index.sha256`. The remaining 1,000 MIDI files and index stayed byte-identical. Reruns reuse identical files; differing user edits are refused before publication.

**Schema for the composer** (IDs are canonical source UUIDs):

```text
{version:1,
 motions:[{id,name,family,group,midi:"motions/<uuid>.mid"}],
 progressions:[{id,name,group,tonic,slots:[{root,name,notes}]}],
 colors:[{name,slots:[{root,name,notes}]}]}
```

- **Motions:** source `folder` → `family`, with S2 `Grooves` → `Performances`; source `subfolder` → `group`; prefer S3 on shared UUIDs. Each MIDI is standard format 0 with its own PPQ, meter, tempo if supplied, actual pitches/velocities, and end-of-track at `lastPosition`. A zero-tick duration gets a one-tick gate in the playable track. Overlapping attacks on the same pitch use additional pitched channels (not GM percussion channel 10) for independent releases. A DAW that ignores the optional metadata still plays the source notes. For exact *Scaler-rendered* output, use Scaler MIDI Export (S3 p. 35) or Capture MIDI/Save (p. 32).
- **Progressions:** only the Common Progressions bank is indexed. `name` is the unmodified source title; `group` is its Roman title; `tonic` is reference pitch class 0 for C major or 9 for the two lower-case `i` families (A minor). `notes` are exactly `60 + intervals`, including inversion and octave. `root` is an inference: the matching scale degree from the title when present in that family's Triads reference, otherwise the first pitch class of that reference (B♭ for `I-VII-I`). Roots are not taken from the bass of each variant. Chord labels describe recognized exact pitch-class formulas with slash bass when inverted; a pitch-name/degree label is used when the formula is ambiguous. The UI may rename/transplant these chords without changing the source notes.
- **Colors:** the 14 entries are the bank's `Voicings` arrays, not the complete Colors matrix. The same C4=60 reference applies. Degree roots are inferred by slot order over C major or C natural minor (octave tonic for an eighth slot), choosing the scale with fewer out-of-scale note occurrences. **`colors[].tonic` is absent on all 14 rows.** `LocalBank.cpp::readSet` defaults it to 0, correctly treating all as C-rooted. `Voicing 6` and `Minor 7th,9ths` fit **C minor**, not A minor: do not assign tonic 9 to these rows. The other twelve fit C major. The UI's transposition is chromatic; it does not convert minor shapes to major shapes. `colors[].group` is also absent and reads as an empty string.

**UI contract audit:** compared against [`LocalBank.cpp`](../composer/LocalBank.cpp) and checked the populated index. All names are nonempty; 41 excess motion names are duplicates, so use UUID or `midi` path as identity. The 24 Passages have an empty `group`. Every `midi` path is exactly `motions/<uuid>.mid` and resolves to its file. Progressions have 3–5 slots with 3–7 source notes (MIDI 24–95); colors have 7–8 slots with 4–6 notes (MIDI 36–84). Every root is an integer in 0–11; all chords have already-sorted, unique absolute pitches. `readSet` adds 48 to the root for its runtime `Chord`, sorts the sounding pitches, and recomputes the name on transposition. All item counts, note ranges and file sizes fit the checked UI reader limits.

### `CRESTMAP1` wire format

Exactly **one** SMF sequencer-specific meta event at tick 0 (`00 FF 7F <VLQ byte length> <payload>`) is emitted for each of the 233 Performances and 102 Rhythms. All other families omit it. The payload is packed with no padding:

```text
9 bytes "CRESTMAP1" | u8 family (1=Performances/Grooves, 2=Rhythms) | i8 octaveDiff
u8 paletteCount (1..127) | paletteCount × u8 pitch in original allNotesNumber order
u32be recordCount | recordCount × [u32be startTick, u32be rawDuration, u8 rawNoteIndex, u8 velocity]
```

All **12,771 raw records** (6,985 Performance, 5,786 Rhythm) retain source order. Three Performance records have nonmonotonic event order; one Performance has a nonascending pitch palette. The 20 zero-duration Performance events retain zero in the raw metadata even though the ordinary SMF note track gives them a one-tick gate. All 102 Rhythms have `octaveDiff=-1` and no zero durations here. S3 Performance values span −3 through +1; a signed field is required. The S2 copy of all 151 Grooves shares event data with S3, but the selector recovery itself was for S3. Global velocity blending, downstream modifiers, and other families are outside this metadata.

**Recheck all MIDI and chord slots:** `CREST_VERIFY_SCALER_BANK="$HOME/Library/Application Support/Crest Composer/Local Bank" python3 -B composer/tests/test_index_scaler.py -v`. The independent SMF reader checks playable notes, timing, meter, optional tempo and EOT. It checks the metadata's tick, payload, palette and raw event order against every eligible source record and verifies omission elsewhere. The same test compares all chord slots with the source and validates the UI constraints. Without the environment variable only the standalone tests run.

## Reproduce the counts without writing files

The offsets below deliberately identify **these builds**. Check `shasum -a 256` against the table before interpreting another installation. The ZIP bytes were located using an EOCD with single-disk fields, central directory start = `EOCD offset - central-directory size`, ZIP start = `central directory start - central-directory offset`, and a valid local header there. Each archive's `testzip()` succeeds. The JSON ranges are complete NUL-terminated data, not `strings` hit counts.

```sh
python3 - <<'PY'
from collections import Counter
from pathlib import Path
import hashlib, io, json, mmap, zipfile
root = Path('/Library/Audio/Plug-Ins/VST3')
previous = None
for name, a, b, c, d in [('Scaler 3',40524144,41759872,43244048,44018196),
                          ('Scaler2',40710640,41538117,41932944,42290395)]:
    path = root / (name+'.vst3') / 'Contents' / 'MacOS' / name
    with path.open('rb') as f, mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ) as data:
        blob = data[a:b]
        print(name, hashlib.sha256(data).hexdigest(), hashlib.sha256(blob).hexdigest())
        print('identical second ZIP at', data.find(blob,b))
        bank = json.loads(data[c:d])
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        assert z.testzip() is None
        presets = [json.loads(z.read(k)) for k in z.namelist()
                   if k.endswith('.json') and not k.startswith('__MACOSX/')]
    presets = [r for r in presets if 'expressionsData' in r]
    events = {r['uuid']:r['expressionsData'] for r in presets}
    assert len(events) == len(presets)
    print('families:', Counter(r['folder'] for r in presets))
    print('templates/events:', len(events), sum(len(r['events']) for r in events.values()))
    common = [s for s in bank['Song Sets'] if s['subfolder']=='Common Progressions']
    print('chord sets:', {k:len(v) for k,v in bank.items()})
    print('common:', len(common), Counter(s['name'].split('(')[1][:-1] for s in common))
    if previous is not None:
        prior_events, prior_common = previous
        overlap = events.keys() & prior_events.keys()
        print('shared IDs / identical event containers / identical common bank:',
              len(overlap), sum(events[i]==prior_events[i] for i in overlap), common==prior_common)
    previous = events, common
PY
```

For the documentation evidence, e.g. `pdftotext -layout -f 71 -l 71 '/Users/Shared/Scaler Music/Scaler 3/Scaler 3 User Guide.pdf' -`; view p. 69 itself for the screenshot's labels. To check the corroborating names without running the target: `nm -arch arm64 '/Library/Audio/Plug-Ins/VST3/Scaler 3.vst3/Contents/MacOS/Scaler 3' | c++filt | grep -E 'Scaler::Assets::MusicData|Performances::Transform::apply|State::Utils::getNegativeHarmonyChords'`.
