# Tuning presets

String 1 is the treble-side string. Configuration rows and horizontal fretboards show it at the top. Chord boxes use the usual convention: bass-side string on the left.

The table lists **bass to treble**, matching JSON storage. Octaves use scientific pitch notation: C4 is MIDI 60, A4 is 440 Hz. Choosing a string count preserves existing upper strings and adds lower strings a fourth apart. Presets replace the pitches; individual strings remain editable.

## Six strings

| Preset | Pitches, bass to treble |
| --- | --- |
| E standard | E2 A2 D3 G3 B3 E4 |
| Drop D | D2 A2 D3 G3 B3 E4 |
| Drop C | C2 G2 C3 F3 A3 D4 |
| D standard | D2 G2 C3 F3 A3 D4 |
| DADGAD | D2 A2 D3 G3 A3 D4 |
| Open D | D2 A2 D3 F♯3 A3 D4 |
| Open G | D2 G2 D3 G3 B3 D4 |

## Seven strings

| Preset | Pitches, bass to treble | Basis |
| --- | --- | --- |
| B standard | B1 E2 A2 D3 G3 B3 E4 | Standard extended-range tuning [1, 2, 3] |
| Drop A | A1 E2 A2 D3 G3 B3 E4 | B standard with bass string lowered one tone [1, 3] |
| A standard | A1 D2 G2 C3 F3 A3 D4 | B standard transposed down one tone |
| Drop G | G1 D2 G2 C3 F3 A3 D4 | Published drop tuning [3] |
| All fourths | B1 E2 A2 D3 G3 C4 F4 | Fourths throughout; upper strings adjusted from standard [1] |
| Open C | G1 C2 G2 C3 G3 C4 E4 | Published seven-string open tuning [3] |

## Eight strings

| Preset | Pitches, bass to treble | Basis |
| --- | --- | --- |
| F♯ standard | F♯1 B1 E2 A2 D3 G3 B3 E4 | Standard eight-string tuning [1, 2] |
| Drop E | E1 B1 E2 A2 D3 G3 B3 E4 | F♯ standard with bass string lowered one tone [1, 2] |
| F standard | F1 B♭1 E♭2 A♭2 D♭3 G♭3 B♭3 E♭4 | F♯ standard transposed down one semitone |
| E standard | E1 A1 D2 G2 C3 F3 A3 D4 | F♯ standard transposed down one tone |
| Drop D | D1 A1 D2 G2 C3 F3 A3 D4 | Drop E transposed down one tone |
| Double drop E/A | E1 A1 E2 A2 D3 G3 B3 E4 | Custom project tuning: lower both extended bass strings one tone |
| All fourths | F♯1 B1 E2 A2 D3 G3 C4 F4 | Fourths throughout; derived from F♯ standard |

**E standard**, **Drop E**, and **Double drop E/A** share a lowest E1 but differ on other strings. Derived transpositions and the custom double-drop tuning are not attributed to a particular artist.

## Sources

1. [Strandberg — 7- and 8-string guitar tunings](https://strandbergguitars.com/en-FR/magazine/7-and-8-string-guitar-tunings-with-strandberg-): standard, drop, and fourths-based extended-range patterns.
2. [Peterson — Guided Tuning Manual](https://www.petersontuners.com/media/pdf/Guided%20Tuning%20Manual.pdf): string numbering and scientific pitches for standard-family and drop tunings.
3. [OD Guitars — 7 String Guitar Tuning](https://www.od-guitars.com/tech-stuff/7-string-guitar-tuning/): B standard, Drop A, Drop G, Open C, and related six-string tunings.

Consulted October 31, 2026. Pitch arrays are implemented in [`web/tunings.js`](../web/tunings.js). The UI may use an enharmonic equivalent, such as D♭ instead of C♯; the sounding pitch is unchanged.
