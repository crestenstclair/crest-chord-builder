# Sketch performances

## Screenshot 7: observation and interpretation

Screenshot 7 shows **performance selection as a separate choice from the harmony**: Expressions → Performances → Adagio → Accento. The [installed bank](../docs/scaler-installation.md) supplies the note-on times, gates, source pitches and velocities that the thumbnail alone cannot establish.

**Implementation decision:** Crest stores one stable performance ID per sketch. Selecting a performance changes how the slot pitches are played; it never changes the stored chord or inversion. The following names, scores and mapping rules are original. No factory performance MIDI is bundled.

| Family | Choice | What to listen for |
|---|---|---|
| Chords | Block chords | All voices arrive together and sustain to the slot boundary, even across several bars. |
| Slow articulations | Felt lantern | Long low anchor; two softer, delayed upper entrances and a late low pickup. |
| Accents | Bell and echo | A strong chord, a short high echo, then a bass–treble accent and quiet pickup. |
| Arpeggios | Switchback eights | Eighth notes turn through the voicing, with slightly late, lighter offbeats. |
| Arpeggios | Triplet rain | Three descending attacks per beat; neighboring voices overlap. |
| Rhythms | Shutter cuts | Muted bass attack, sixteenth-displaced upper stabs and an accented push. |
| Rhythms | Late afterbeat | Low downbeat with short, slightly delayed offbeat chords. |
| Basslines | Keel steps | A long bass note, short repetition and an answering second-lowest voice. |
| Melodies | Skyline reply | An opening breath before a rising upper line; the reply lands and sustains. |
| Phrases | Window dialogue | A held low voice under a climbing call; a high answer resolves to an outer-voice pair. |
| Strums | Reed brush | Down/up strokes lean into the first string; the upstroke is quicker and softer. |
| Strums | Thumb and fan | Isolated thumb attack, a sustained upward fan, then a shorter downward sweep. |

## Render once; audition or export

```cpp
using namespace crest::composer;
std::vector<PerformanceSlot> slots{
    {{57, 60, 64}, 3}, {{53, 57, 60}, 1.5}, {{}, 1.5}
};
auto clip = renderPerformance(slots, "strum-reed", 96, 3);
auto midiBytes = performanceMidi(clip);
// Audition clip.notes; seconds = tick * 60.0 / (clip.bpm * performancePPQ).
```

* `Performance.h` has no JUCE dependency. Rendering, import and export allocate and belong outside the audio callback. File I/O belongs to the caller. Invalid or unsupported input throws `std::invalid_argument`.
* Supply absolute MIDI pitches 0–127 and positive durations in quarter-note **beats**, including for empty/rest slots. To specify bars use `bars * beatsPerBar`. Slot ends are cumulatively rounded at 480 ticks per quarter. A slot must occupy at least one tick.
* The original styles sort voicings and remove duplicate pitches. Their bass is the lowest **sounding** pitch, even in an inversion. Every original-style note belongs to the current slot's voicing. The timing motif begins afresh at a chord change; call/reply depends on the parity of the elapsed sketch bar. Final-beat figures move with the meter. Gates are clipped at the change, so rests really are silent.
* `PerformanceRender::notes` is ordered by onset, then pitch. Ranges are `[startTick, endTick)`. Simultaneous attacks mapped to one key merge using the stronger velocity and later release. Reattacking a held key terminates it before the new attack. In an audition scheduler dispatch note-offs before note-ons at the same tick.
* `performanceMidi()` returns a Standard MIDI File (type 0, channel 1) with tempo and 3/4 or 4/4 at tick zero. End of Track is at `totalTicks`, not at the last note-off. A sketch of only rests still exports its full duration. No instrument/program is forced on the recipient.

## Use your own MIDI performance

Call `importPerformanceMidi(bytes)`, then pass the result in place of the ID to `renderPerformance`. A simple recipe: record one or two bars on three or four different keys. Include a little space at the end of the clip for a breath, and export the loop with its intended end position.

1. Import reads pitched note pairs from standard PPQ type-0 and type-1 SMFs. For each track/channel it accepts explicit note-offs, velocity-zero note-ons and running status. It ignores channel 10 percussion, controllers (including sustain), program changes, and SysEx. Timing uses note-on/off messages, not audio or pedal tails. Input tempo and meter do not override the sketch clock.
2. In ordinary MIDI, all distinct source keys across pitched tracks are ranked together. The lowest maps to the slot bass and the highest to its top voice; intermediate ranks are spread evenly across the slot voicing and rounded to the nearest voice (half up). One source key gives a bass pulse. For example, three source keys into `[65,69,72,76]` produce `[65,72,76]`.
3. Timing and velocities follow the source. Its loop length is the latest End of Track, including leading/trailing silence. It repeats at its native **quarter-note** length within each slot, rather than stretching to fill a bar; a four-beat source still occupies four beats in 3/4. At the next slot, restart at the loop beginning and map again. Place the first attack near zero if the sketch has short slots.

Domain limits: 4 MiB, 64 tracks and 65,536 attacks per template; 16,384 quarter notes and 262,144 generated attacks per render. The host can impose smaller project limits. SMPTE timecode, type 2, unclosed notes, and ordinary clips without a pitched note of positive duration are rejected.

### Local bank: Performances and Rhythms

When the [local indexer](tools/index_scaler.py) supplies `CRESTMAP1`, `importPerformanceMidi()` retains the original palette order, signed octave difference and raw event indices. Indexed **Performances** run from the beginning of the sketch, advancing through chords and rests and repeating at the template's own end. A held gate at a chord change is revoiced for its remaining duration. `renderPerformance()` builds the index-to-pitch lookup for each slot. The MIDI track remains independently playable in other software. Unmarked files still use ordinary rank mapping, including older bank indexes; regenerate those indexes to enable these selectors.

* **Performances** (also the indexer's `Grooves` alias): substitute the played chord's distinct pitch classes, in first-appearance order, into the source palette's grouped octave offsets. Use the first incoming note as octave reference; sort the generated note bytes, then select by raw event index. Small chords discard excess source classes; with three or more classes surplus occurrences fold into the retained groups. A larger chord does not invent missing source occurrences. Thus `12-8-8-Performance` on `[62,65,69]` opens on **62, 65, 74**.
* **Rhythms:** select by direct index into the **supplied voicing order**, including octave doublings. If the voicing is wider than the source palette, extend eligible source keys upward by octaves, cloning their timing and velocity; sort the extended keys and reindex the hits. `Common-7` on `[62,65,69,74]` opens on **all four** notes, with a clone supplying the last hit.
* For both families, add `12 * (octaveDiff + 1)` after selection. An index absent from the destination or a zero-duration hit contributes silence. The observed arithmetic stores note bytes; Crest omits any resulting byte above 127 from MIDI without shifting the other indices. **Velocity is the original event's MIDI velocity**, including clones. Crest does not implement the incoming-velocity blend in the source transform. Same-key collisions still use the shared render's merge/retrigger policy.

See [the mapping report](../docs/scaler-performance-mapping.md) for the exact rules and their evidence. This implements the documented pitch selectors; timing retrigger, collision handling and velocity are Crest policies. The fixture expectations are selector predictions, not claims of identical DAW exports.

**File contract:** a single `FF 7F` event at absolute tick 0, payload `CRESTMAP1` (9 ASCII bytes), family `u8` (1 Performances, 2 Rhythms), signed `i8 octaveDiff`, `u8` palette count (1–127), that many distinct MIDI keys in stored order, then a big-endian `u32` event count (1–65,536). Each record is `u32 start, u32 duration, u8 rawIndex, u8 velocity` with big-endian ticks in the SMF's PPQ. Raw indices must address the source palette, velocities are 1–127, and events must fit the loop end (latest End of Track). Zero gates remain valid but silent. A malformed recognized payload fails import; unrelated sequencer metadata is ignored. Ordinary export writes only the performed notes, tempo, meter and loop end.

## Standalone checks

From the repository root:

```sh
c++ -std=c++17 -Wall -Wextra -Wpedantic composer/Performance.cpp composer/tests/performance.cpp -o "${TMPDIR:-/tmp}/crest-performance-tests"
"${TMPDIR:-/tmp}/crest-performance-tests"
```

Checks cover the musical differences above, sorted non-overlapping keys, changes of voicing, silence, byte-exact waltz encoding, type-1 import with running status, collapsed ranks, irregular PPQ rounding, malformed metadata and note-for-note MIDI round trips in both meters. Selector fixtures include the unsorted `5-4-7-Performance` palette, `12-8-8-Performance`, and `Common-7`. To check the actual adapter output, pass the path of a freshly indexed local bank as the test executable's only argument. It checks the opening attacks of those three files by UUID, without shipping the bank.
