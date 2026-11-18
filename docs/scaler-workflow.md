# Scaler → Crest: the sketch-to-MIDI workflow

**The page is Scaler 3’s Create page.** Its named tools include Circle of Fifths, Modulation, Explore, Colors and Sketch. The performance chooser in image 7 is **Motions → Expressions → Performances** in a Scaler **3** window. The earlier Scaler 2 performances are relevant too: the installed banks share all 151 of those Performance templates.

The implementation is [Crest Composer](../composer/README.md), a separate VST3 instrument. One sketch lane is one exportable phrase. It can stay a throwaway variation or become a guitar part; there is no intermediate arrangement to populate. [Editable workflow diagram](https://www.figma.com/board/n8j5NcIqGPhbUK5pTZAOSH).

## What the seven images establish

| Image | Observed | What to retain |
|---|---|---|
| 1 — Circle of Fifths | Section B is A minor, with Am, Bdim, Cmaj, Dm, Em, Fmaj, Gmaj; a major/minor wheel, suggestion and search areas; Section C is empty. The transport shows 3/4, 90 BPM. | Keep the seven degrees visible regardless of what is being edited. A pitch-class set can be selected manually; recognition is unnecessary here. The still does not show which wheel interaction populates the suggestions. |
| 2 — Explore | Ambient and Bright selectors, a dynamic A♭ major scale and a network of suggestions. The Section B scale still says A minor. | Distinguish an exploration context from the current composition key. The picture gives examples, not a recommendation algorithm. |
| 3 — Colors | Five independent rows across the same scale: 7ths, Voicing 1, Voicing 7, inverted 7ths, Open 3. Each has octave and audition controls. Some cells change chord quality or bass; others have the same symbol but a different register. | Compare vertically for one degree, horizontally across degrees. Store the actual voiced pitches: a saved `Am` symbol is insufficient to reproduce a chosen voicing. |
| 4 — Colors selector | Two-level selector: Extensions, Voicings, Variations, Substitutions, Inversions. Visible examples include Drop 2, Drop 2 & 3 and 7ths Inverted. | The recipe belongs to a single row, not globally to the scale. Changing a recipe should not silently rewrite the sketch. |
| 5 — Sketch | Seven named rows with eight cells, a first `+`, per-row octave, audition, binding and menu. | Crest 0.2 displays the full 7×8 grid. Click a cell for the full picker or choose a destination using Section C. Each lane can be played, transposed, bound or copied. |
| 6 — Slot picker | Discover / Variations; A minor selected; a voicing filter independent of the chord candidates; Dynamic, inversions, Open 1/2, Guitar, Drop 2/3; octave and semitone controls; a Rest in the destination strip. | Choose a harmonic color, then a register/voicing. Leave borrowed notes selectable. In A minor, Asus2 (A B E) fits; A major (A C♯ E) does not; changing the inversion does not make C♯ diatonic. Audition before writing into the slot. |
| 7 — Motions | Search; All / Favourites / Articulations / Expressions / Moods / Genres; Performances alongside Phrases, Rhythms, Bass, Melody, Sequences and StrummedSequences. Adagio is selected. Individual entries have note previews and a heart. | A performance is a reusable timed gesture applied to harmony. Search by name or browse family and group. Supply both a literal source MIDI drag and a rendered sketch MIDI drag. The thumbnails cannot establish exact note events. |

See [installation evidence](scaler-installation.md) for versioned inventories, manual pages, actual record schemas and count checks. See [performance pitch mapping](scaler-performance-mapping.md) for the independent arm64 investigation of what happens **after** a template is selected.

## Worked example: a single substitution should survive the trip to Live

1. Choose **A / Natural minor**. Load **Minor loop**: `Am – F – C – G`. The first voicing starts at MIDI 57 (A3); this octave is a Crest choice. To use the factory voicings instead, open **Progression bank** and select `i-VI-III-VII`.
2. **Copy to empty**, select slot 1 of the copy. In **Slot variations**, audition **Am9**; the written notes are A–C–E–G–B. Switch the voicing selector to hear the difference before pressing **Replace slot 1**. The other three slots and the original sketch keep their pitches.
3. Click **Performances** to open all groups. Choose **Adagio**, or search for `Accento` directly. Click it to audition, then **Use in sketch**. Dragging the motion's name or miniature piano roll from that browser gives the template at its *source* pitches; **Send Sketch Clips** in Section C places the performed sketches in Live's Session slots.
4. Set the meter to **3/4**, play the sketch and drag **Drag MIDI to DAW** to a MIDI track. Four one-bar slots occupy twelve quarter notes. A final explicit rest is part of the clip length. The BPM comes from the host when available or from the local clock. Live uses its own tempo for the imported clip.
5. **Save guitar parts** writes the chords as a Crest Builder project. This preserves harmony, not the template’s performance timing. **Open guitar part** reads sounding pitches from a saved compatible grip, including capo and re-entrant tunings. See [exchange rules](composer-guitar-projects.md).

## Reconstruction coverage

| Question | Status and boundary |
|---|---|
| What are the actual common progressions and templates? | **Answered for these installs.** Verified both binaries and musical records; both banks and the local index are reproducible. Factory arrays are preserved locally. Root/quality labels on ambiguous chord sets are interpretations, not claims about Scaler’s naming engine. |
| How are Colors and Sketch organized? | **Answered at workflow level.** Still images plus the installed manual describe row/slot boundaries, picker filters and audition. The 14 stored voicing presets are available. Crest also supplies its own degree, modal, substitution, inversion and voice-leading rules. Exact native outputs for every scale × recipe were not measured. |
| What are the notes of a performance? | **Answered for the source.** Ordinary MIDI plays exact source pitches and timing subject to the documented one-tick representation of a zero-length event. The two principal pitch selectors have additional static evidence. Source MIDI, predicted transformed MIDI and an actual Scaler export are distinct comparison targets. |
| Can a sketch reach the DAW without Arrange? | **Implemented.** Native external file drag, Save MIDI and VST3 MIDI output use the same performed note stream as preview. Host acceptance of a drag needs a test in the target DAW. |
| Which other pages are present? | Version 0.2 adds Circle of Fifths, Modulation, Explore, the full Sketch workspace, a dedicated Colors page, Discover/Variations, a four-column Motions browser and a played-note keyboard with lane binding. See the [running-editor gallery](../composer/README.md). Exact suggestion ranking, all native transformations, sound libraries, detection and multi-track Arrange are outside the verified result. |
