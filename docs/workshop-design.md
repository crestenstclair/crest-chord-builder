# Chord workshop

The workshop opens from a scale triad or a saved chord. Root, quality, interval choices, inversion, and the fretboard are visible together on a 1920×1080 display. The fingering panel holds the chord box, alternate grips, playback, and individual string controls.

## Interaction rules

- A quality button starts a new formula for the selected root. The grid then edits that formula directly.
- Each column groups variants of one degree. Select 3 to replace ♭3, or ♭5 to replace 5. Selecting the active variant removes it. At least one tone must remain.
- Extensions are explicit: selecting 9 adds only 9. No sevenths or other extensions are inserted implicitly.
- Equivalent pitches use one spelling. Choosing ♭5 removes ♯11 if present; choosing ♯11 can retain a separate perfect fifth. JSON preserves the selected spelling.
- Inversion has its own filter row. Choose any bass, the root, or another selected interval to constrain suggested grips, including nearby voicings. The **Current** readout separately identifies the displayed voicing's lowest sounding pitch. Drawing, muting, or shifting notes clears the filter and detects the inversion automatically. Removing the filtered tone resets the filter to **Any**. Saved chords retain their actual bass; reopening starts with an unrestricted filter.
- Inversion and formula changes request a new grip, then audition its exact pitches. Stale search results cannot trigger playback. If no grip is available, the status explains that and manual selection remains available.
- In **Find voicings**, clicking a chord tone searches for nearby grips containing that exact string and fret. A grid below the fretboard shows six chord boxes at a time; page controls reach every ranked result. Clicking another note replaces the search. Root, quality, and interval controls collapse during browsing and reopen with **Edit chord tones**.
- Select a grid card to place and audition its complete fingering. Save remains disabled until a grip is chosen. Voicing selection preserves the chord formula, even when an extended grip omits the fifth. **Draw / remove** changes the formula to follow the sounding notes. Save commits the exact chosen grip to the main view and Play & Print; Cancel and Escape discard edits.
- Fretboard labels show intervals. Filled tones belong to the chord; neutral notes belong to the part scale; dashed borders mark outside-scale notes. Rings identify the chosen grip; a square marks the search anchor.
- The browser engine ranks practical fingerings within a four-fret span, with open strings allowed. It may omit a perfect fifth from chords with five or more tones. When no grip is available, the fretboard remains available for manual placement.
- Anchored searches enumerate every playable grip in four-fret hand windows containing the clicked fret, subject to the inversion and hand-position filters. Clicking an open string searches frets 1–4 at the nut. Other open strings remain available in every window. Unanchored searches retain the twelve diversified suggestions.

## References

Reviewed October 31, 2026:

- [Oolimo Chord Analyzer](https://www.oolimo.com/en/guitar-chords/analyze): interval branches, separate bass handling, enharmonic distinctions such as ♭5 versus ♯11, and the difference between extensions and explicit additions. These informed the degree columns and stored formula spelling.
- [Chord Prism features](https://www.chordprism.com/pages/features): editing individual chord tones and voicings. This supported keeping tone edits, octave controls, and audition together.
- [Guitar with Reuben Chord Explorer](https://tools.guitarwithreuben.com/chord-explorer): visible root and quality choices, formulas, and alternative fingerings. This informed the visible controls and adjacent grip panel.

The implementation uses the existing chord engine and native browser controls. No external editor assets or runtime services are used.
