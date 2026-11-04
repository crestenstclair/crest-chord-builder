# Chord workshop

The workshop opens from a scale triad or a saved chord. Root, quality, inversion, and a Fretboard / Scale view switch share one editor. Each view fits a 1920×1080 display. The fingering panel holds the chord box, alternate grips, playback, and individual string controls.

## Interaction rules

- A quality button starts a new formula for the selected root. The grid then edits that formula directly.
- Columns follow simple interval order, 1–7, and include all twelve pitch classes. Labels lead with the simple interval: **2 (9th)**, **4 (11th)**, **6 (13th)**. Formula and fretboard labels use simple intervals; chord names use conventional harmonic spelling.
- Each column groups variants of one degree. Select 3 to replace ♭3, or ♭5 to replace 5. Selecting the active variant removes it. The last tone can be removed to leave an empty draft; saving stays disabled until a note is present.
- Selecting 2, 4, or 6 adds only that interval and keeps the third. No sevenths or other intervals are implied.
- Equivalent pitches use one spelling. Choosing ♭5 removes ♯4 if present; choosing ♯4 can retain a separate perfect fifth. JSON preserves the underlying chord spelling, including existing 9/11/13 labels.
- Inversion has its own filter row. Choose any bass, the root, or another selected interval to constrain suggested grips, including nearby voicings. The **Current** readout separately identifies the displayed voicing's lowest sounding pitch. Fret edits, muting, or shifting notes clears the filter and detects the inversion automatically. Removing the filtered tone resets the filter to **Any**. Saved chords retain their actual bass; reopening starts with an unrestricted filter.
- Inversion and formula changes request a new grip, then audition its exact pitches. Stale search results cannot trigger playback. If no grip is available, the status explains that and manual selection remains available.
- **Fretboard** and **Scale** are presentations of the same chord, not editing modes. The fretboard shows physical pitches; Scale shows the interval grid. Switching views never mutates the chord or restarts playback. Tabs support arrow keys, Home, and End.
- Every fret is editable. Clicking adds or removes a note; another fret on the same string replaces it without clearing other strings. This also applies when reopening a saved grip, closing suggestions, or editing a suggested grip. Mute and octave controls share this behavior and remain usable during a background search.
- Direct fingering edits recompute the chord’s formula and name from sounding pitches. The selected harmonic root stays fixed, including for rootless chords; the part scale supplies note spelling and in-key hints. The lowest sounding pitch determines inversion, including with re-entrant tunings. Inversion filters are reset by direct edits.
- Interval edits change the same chord definition and request a matching grip. Compatible notes remain visible during generation. The name and grid reflect the requested formula; the fingering panel lists the intervals actually sounding. Cancel and Escape discard edits. Saved JSON remains compatible with existing projects.
- Nearby suggestions include every required string/fret position. Results are grouped by inversion, six ranked chord boxes per page. Browsing groups and pages does not alter the current grip. Selecting a card auditions its exact pitches; selecting it again restores the prior grip.
- Fret edits are immediately saveable. Pending, failed, or empty searches cannot erase them. Failed searches offer **Retry search**. The selector’s × closes suggestions and keeps the current grip; subsequent clicks continue editing that grip.
- Fretboard labels show intervals. Filled tones belong to the chord; neutral notes belong to the scale; dashed borders mark outside-scale notes. Rings identify sounding notes; squares mark required search positions.
- Search uses four-fret hand windows containing required fretted notes, with open strings available. An all-open constraint searches frets 1–4. Unconstrained searches retain twelve diversified suggestions. Extended grips may omit the perfect fifth. The player can directly place grips outside these suggestion limits.

## References

Reviewed October 31, 2026:

- [Oolimo Chord Analyzer](https://www.oolimo.com/en/guitar-chords/analyze): interval branches, separate bass handling, enharmonic distinctions such as ♭5 versus ♯11, and the difference between extensions and explicit additions. These informed the degree columns and stored formula spelling.
- [Chord Prism features](https://www.chordprism.com/pages/features): editing individual chord tones and voicings. This supported keeping tone edits, octave controls, and audition together.
- [Guitar with Reuben Chord Explorer](https://tools.guitarwithreuben.com/chord-explorer): visible root and quality choices, formulas, and alternative fingerings. This informed the visible controls and adjacent grip panel.

The implementation uses the existing chord engine and native browser controls. No external editor assets or runtime services are used.
