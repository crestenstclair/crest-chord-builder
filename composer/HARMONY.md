# Sketch harmony

`Harmony.h` is the C++17 interface. Example: `degreeChord({57, Mode::NaturalMinor}, 1)` produces `{"Am", 57, {57,60,64}}`. A sketch can store that result directly instead of storing a catalogue index. Catalogue functions return values and may allocate; call them when editing the sketch, outside the audio callback.

## What the reference establishes

Screenshots 3/4/6 show an A natural minor row: **Am · Bdim · C · Dm · Em · F · G**. On Am, the choices include **Am, Amaj, Asus2, Asus4, Am7, Am9**, the extended colors below, and **Fadd9/A**. Screenshot 6 distinguishes **Open 1**, **Open 2** and **Dynamic** as voicing choices independent of variations. The stills do not establish exact formulas, registers, guitar shapes or a voice-leading distance metric.

## Crest’s implementation policies

| Operation | Rule |
|---|---|
| Key and register | `Scale::tonic` is an **absolute MIDI note** (`60` = C4), degrees are **1–7**. The default is A3 natural minor. The seven church modes and harmonic minor use 12-tone equal temperament. Ionian = major; Aeolian = natural minor. |
| Degree chords | Stack every other scale tone, wrapping **up** at the octave. The seventh adds one more scale third. Degree major triads use a bare letter; the variation list uses `maj` explicitly. Bare pitch-class labels prefer flats. Degree symbols follow consecutive scale letters, so A harmonic minor ends on **G#dim**, and variations retain that spelling. |
| Common progressions | The bank holds named degree sequences. `realize` interprets those degrees in the current scale and register. E.g. `1,6,3,7` gives Am–F–C–G. No borrowed dominant or voice-leading step happens implicitly. |
| Variations | Triads, suspensions and extensions have separate filters. Root-based qualities replace the interval formula and put the matching set first if present. Ninths include the seventh; `add9` omits it. `Fadd9/A` is a same-bass colour in Extensions: it changes the harmonic root to F and plays A–C–F–G. Transposed to C bass this is `Abadd9/C`. |
| Substitutions | The triads a diatonic third above and below share two pitch classes with the selected triad. Borrowing takes the same numbered degree from parallel major if the scale has a minor third, or natural minor if it has a major third. A dominant-seventh degree also offers a dominant seventh a tritone away. Labels identify why each chord was offered. |
| Voicings | Keep the symbol and harmonic root. `Closed` collects each sounding pitch class once in the octave starting at the root (slash bass for a slash chord). Inversions successively lift low voices an octave; slash chords invert their upper voices. `Open 1` raises alternating voices starting at the second; `Open 2` starts at the third. Open Am yields **A3–E4–C5** and **A3–C4–E5** respectively. Drop 2/3 lowers the second-/third-highest compact voice an octave, provided a lower voice exists. A slash bass follows the dropped voice down to remain lowest. |
| Dynamic | `dynamicVoicing(chord, previous)` takes strictly ascending previous MIDI pitches. Empty means keep the input. It preserves pitch classes, doublings, and intended slash bass. An exact previous layout wins if eligible. Otherwise it searches MIDI registers of the input and, for undoubled chords, compact and open inversions. It minimizes summed absolute semitone motion between voices ordered low to high; for differing voice counts, old voices are sampled by nearest proportional rank. The original layout wins ties when already nearest. |
| Guitar | Search E2–A2–D3–G3–B3–E4, frets 0–15. Require the root (or specified slash note) in the bass, all pitch classes, a contiguous group of strings, ascending pitches and at most four adjacent stopped frets. Count up to four fingers, allowing a barre at the lowest stopped fret. Rank by lowest maximum fret, most strings, fewest fingers, then lowest total fret number. One matching grip, or none. The label lists frets from bass to treble; `x` means mute. Open Am is `x-0-2-2-1-0`, sounding `{45,52,57,60,64}`. |
| Scale fit | Check each **sounding** note modulo 12, including extensions and guitar doublings. Return every foreign **absolute** pitch in sounding order. No inference from the label or an unsounded harmonic root. For example Amaj `{57,61,64}` in A minor returns `{61}`; another C# at 73 would also appear. |

### Extended colours: labels versus pitches

These names follow the supplied transcription, with `m(maj9)` for minor-major ninth. **The notes are our interpretation of the labels**, not observed MIDI. In particular we keep all intermediate extensions in an 11th/13th stack; a 6 chord with named additions gets only those additions, not an implied seventh. Inversions and open layouts use the *same* set of pitch classes.

| Catalog label | Pitches chosen over A, bottom to top |
|---|---|
| Am(maj9) | A C E G# B |
| Am11(b5) | A C Eb G B D |
| Am7 b9 b13 | A C E G Bb F |
| Am6 11 | A C E F# D |
| Am13(b5) | A C Eb G B D F# |
| Am6 9 | A C E F# B |
| Am13 | A C E G B D F# |
| Fadd9/A | A C F G |

### MIDI bounds

Chord inputs require a MIDI root and nonempty, strictly increasing MIDI pitches. A pitch class can recur in different octaves. Invalid MIDI notes and degree numbers throw `std::out_of_range`; malformed chords throw `std::invalid_argument`. Degree generation and substitutions require the requested register to fit MIDI. Variations and voicings omit individual candidates outside `0..127` rather than clipping or dropping tones. Guitar searches its instrument register independently of the source register.

### Run the standalone tests

From the repository root:

```sh
c++ -std=c++17 -Wall -Wextra -Wpedantic composer/Harmony.cpp composer/tests/harmony.cpp -o "${TMPDIR:-/tmp}/crest-harmony-tests"
"${TMPDIR:-/tmp}/crest-harmony-tests"
```
