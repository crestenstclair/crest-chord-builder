# Scaler 3.4.0: where a Performance `noteIndex` lands

**Performances uses `noteIndex` to select from a newly built, pitch-sorted palette.** Scaler takes the source template's octave pattern and substitutes the destination chord's pitch classes in first-appearance order. **Rhythms uses `noteIndex` to select directly from the incoming chord notes**, extending the template first if it has fewer pitch entries than the chord has notes. Neither is a proportional low-to-high rank mapping.

For the renderer: preserve `family`, the **stored order** of `metaData.allNotesNumber`, each event's **raw** `noteIndex`, and the record's signed `octaveDiff`. Supply the ordered, absolute MIDI pitches of the played voicing. `pitchCount` + `pitchRank` in [`Performance.h`](../composer/Performance.h) alone lose information. These are high-confidence **static findings for the two transforms**. The examples predict transform output given specified inputs; they are not captured MIDI exports.

## Performances: walk through a factory example

`ExpressionsData/Performances/Other Time Signature/12-8-8-Performance.json`, UUID `ab932340-4b4b-4912-80b6-e88551fa3e04`, has `allNotesNumber = [48,55,60,64,67,72]`, `octaveDiff = -1`. Consider an incoming D-minor voicing **`[62,65,69]`**.

| Source class, in encounter order | Octave offsets from the first source note | Destination class | Generated pitches |
|---|---|---|---|
| C (48, 60, 72) | 0, 1, 2 | D | 62, 74, 86 |
| G (55, 67) | 0, 1 | F | 65, 77 |
| E (64) | 1 | A | 81 |

Sorting gives **`[62,65,74,77,81,86]`**. The final offset is `12 * (octaveDiff + 1)`, zero for this record. The three source events at tick 0 have indices `[0,1,2]` and sound `[48,55,60]` in the source; the transform predicts **`[62,65,74]`** at that tick. For an incoming dyad `[62,65]`, only the first two source class groups remain: the indexable list is `[62,65,74,77,86]`; an event with raw index 5 is skipped. Both predicted lists and the first onset were checked by running the reference calculation below on this installed ZIP member.

### Pitch-only reference calculation

The following implements the observed operations for a nonempty factory source palette and MIDI chord pitches in input-vector order. Octave offsets use signed **truncation toward zero**, not downward rounding; this matters for the one unsorted Performance. Both byte stores are shown because the operations are on note bytes. For ordinary MIDI-range inputs and outputs, no byte wrap is involved. Downstream treatment of out-of-MIDI-range results was not investigated.

```python
def performance_palette(source, chord, octave_diff):
    if not source or not chord:
        return []

    groups = {}                         # insertion order, not numeric pitch-class order
    for pitch in source:
        delta = pitch - source[0]
        octave = (abs(delta) // 12) * (-1 if delta < 0 else 1)
        groups.setdefault(pitch % 12, []).append(octave)
    offsets = list(groups.values())

    voices = list(dict.fromkeys(p % 12 for p in chord))
    n = len(voices)
    if n <= 2:
        offsets = offsets[:n]           # discard the other groups, don't fold them
    else:
        for j in range(n, len(offsets)):
            to = offsets[j % n]
            for _ in offsets[j]:        # count matters; the old offset value doesn't
                if to[-1] <= 7:
                    to.append(to[-1] + 1)
                elif to[0] >= -1:
                    to.append(to[0] - 1)
        offsets = offsets[:n]

    base = chord[0] // 12
    wrap = 0
    generated = []
    for pc, occ in zip(voices, offsets):
        if pc < voices[0]:
            wrap = 1                    # latched, not a count of all descending steps
        for octave in occ:
            generated.append((12 * (base + wrap + octave) + pc) & 255)
    return [(p + 12 * (octave_diff + 1)) & 255 for p in sorted(generated)]
```

Select `palette[event.noteIndex]` **only** if `0 <= noteIndex < len(palette)` and `duration != 0`. There is no rescaling, modulo, or clamping of the event index. Octave doublings in the input do not add Performance voices; except for the first pitch's octave, the original chord pitches contribute their classes, not their supplied octaves. If there are fewer source groups than destination classes, unused destination classes do not acquire invented occurrences. A factory-bank count gives 223 Performances with three source pitch classes, six with four, and four with two. The one nonascending source array belongs to `Other Time Signature/5-4-7-Performance.json`; ingesting a sorted copy changes the reference pitch and the order of the class groups.

## Rhythms: direct voicing lookup, including doublings

For every eligible event, the pitch is **`chord[event.noteIndex] + 12 * (octaveDiff + 1)`** (byte store). Here `chord` is the original incoming vector. No pitch-class deduplication or sort is performed by this selector. All 102 installed Rhythm records have `octaveDiff = -1`, so their final offset cancels. Events beyond the chord width and zero-duration events are skipped individually; simultaneous source hits are still distinct events.

When `len(chord) > len(allNotesNumber)`, `ExpressionSet::extended(len(chord))` first builds a larger template. It scans the working source palette in order, including appended entries when needed. It appends an absent `pitch + 12` in the range 12…127, and clones the events for that source pitch at the new pitch, retaining timing and velocity. It stops at the requested size or if a pass makes no progress. It sorts the resulting pitch numbers, recomputes every event's index by matching its note number, then calls `withSortedEvents()`. The **sorted source numbers still aren't the pitches sent out**; the recomputed indices select destination notes. Thus an implementation that merely drops any extra incoming voices misses real hits.

Example: `Rhythms/Common Rhythms/Common-7.json` (`8f40ad8b-a60e-45ca-9441-4b66f37d275e`) has source palette `[60,64,67]` and starts with all three indices at tick 0, duration 360. For `[62,65]` the first hit is `[62,65]`. For `[62,65,69,74]` the extension adds 72 and clones the index-0 hit; lookup predicts all four pitches at tick 0, including the doubled D. These results concern pitch and occurrence; they don't establish export ordering for tied onsets.

One adjacent renderer detail: passing through the template's velocity is a separate policy. At `9146ac–9146e8`, `9147fc–914868` (Performances) and `91783c–917864`, `91775c–9177ec` (Rhythms), the transform blends the event velocity with an incoming velocity: the integer mean across all incoming notes for Performances, or the indexed note's velocity for Rhythms. It averages the two normalized values, limits the result to 0.3…0.9 and rounds to a MIDI velocity. `PerformanceSlot` currently supplies pitches and duration, not individual input velocities.

## Evidence and reproduction

Target: `/Library/Audio/Plug-Ins/VST3/Scaler 3.vst3/Contents/MacOS/Scaler 3`, universal SHA-256 `ee469bd2458668d7740c38df51f3caca97f2b4b48111b3a4ec80a4a3cfef8fb0`. REA `open_binary` confirmed identity; `list_architectures` evidence `ev_141a71868d32aad4845e6c2e31f0633b4e5cdbe9e01e7e99344980ebcef8e22b` identifies the arm64 slice at file offset `61898752`. Session closed. The code evidence below is **host symbol/disassembly evidence**, not a REA decompiler or runtime result. Locations are arm64 virtual addresses, not whole-file offsets. [Installation notes](scaler-installation.md) give the ZIP identity and local JSON-reading recipe.

| Observation | Instruction sites (hex) |
|---|---|
| JSON loader reads named `octaveDiff`, preserves palette order, reads `noteIndex`, `noteNumber`, velocity, position and duration into a 32-byte record. `ExpressionSet` stores the palette at `+0x50`, events at `+0x70`, and its signed integer octave field at `+0x88`. | `8053b4–8053d8`, `805580–805640`, `8058d4–8058e4`, `80597c–805aa0`, `806050–806070`, `80359c–8035fc` |
| Performance wrapper calls `Chord::getRoot`; pitch generation in the callee actually reads the incoming note vector. Source group IDs are assigned on first encounter of `pitch % 12`; each group receives `(pitch - palette[0]) / 12`. | `912a4c–912a64`, `912b10–912b38`, `912c58–912c88`, `912d40–912df0`, `912f1c–912f40` |
| Input note copies are deduplicated by pitch byte at `+0x1c` modulo 12, retaining first occurrence. For 1 or 2 distinct classes, the map is reassigned to the first 1 or 2 groups. For other widths, excess group `j` contributes occurrences to `j % n`, then is removed. | `9130c8–913114`, `913188–913198`, `913224–913278`, `913308–91343c`, `913498–9134f4`, `913664–913678`, `9139c8–9139dc`, `913ce8–913cf8`, `914000–914014`, `91422c–91424c` |
| Generation uses the first destination pitch's octave, a pitch-class comparison to that first class, and a flag set to 1 on a wrap. Sort is ascending unsigned pitch: the two-element case swaps only if the second pitch is smaller. Raw event index selects the sorted 56-byte record; duration zero skips; the final multiply/add gives `+12*octaveDiff + 12`. | `9142ac–9142c0`, `914308–914384`, `914398–9143bc`, `914680`, `9153c4–9153d4`, `914738–914764`, `9147c8–9147d0`, `91486c–914878` |
| Rhythm extension call is gated on input width vs source palette size. Index/duration checks and the `56*index` selection precede the octave addition. Extension searches for absent source pitch, clones matching events, sorts and reindexes. | `917624–91765c`, `917804–917850`, `9177a8–9177b4`, `803b74–803c2c`, `803d6c–803db4`, `803e6c–803ee0`, `803f50–803f8c` |

To inspect any **one symbol** without a whole-binary deep-analysis pass (replace `addr` with the function entry, e.g. `00000000009175c8` for Rhythms):

```sh
p='/Library/Audio/Plug-Ins/VST3/Scaler 3.vst3/Contents/MacOS/Scaler 3'
addr=0000000000912ad0
s=$(nm -arch arm64 "$p" | awk -v a="$addr" '$1==a { print $3; exit }')
xcrun llvm-objdump --macho --arch=arm64 --disassemble --dis-symname "$s" --no-show-raw-insn "$p" | c++filt
```

**Confidence boundary:** the selector and ordinary-range fixture predictions are supported by explicit load/compare/arithmetic/store sequences. No Scaler or host execution, session inspection, or exported-MIDI comparison was performed. The caller's choices (e.g. a different expression set, track transposition, or voicing order), other motion families, later MIDI-range handling, and parity with other builds are outside this evidence. Use the supplied **transform inputs** when testing the pitch rule; use a user-supplied MIDI export to test end-to-end parity.
