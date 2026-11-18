# Colors and the slot picker

**Colors** compares five rows across seven scale degrees. Click a row's color indicator, pick a category on the left, then a recipe on the right. The chevrons beside the indicator step through available recipes. The second pair shifts only that row by an octave. The triangle plays its seven sounding chords in order. A card click auditions; a double-click inserts; a drag carries the actual voiced MIDI pitches into a slot.

| Reference | Reconstructed behavior |
|---|---|
| Images 3–4, as transcribed in [the workflow notes](../docs/scaler-workflow.md); installed Scaler 3 guide pp. 69–70 | The five initial rows with a local bank are **7ths, Voicing 1, Voicing 7, 7ths Inverted, Open 3**. The centered two-column menu edits only its opening row. Roman numerals identify sounding roots against the current scale; the seven Variations recipes each explore one fixed degree horizontally. |
| Image 6; guide pp. 53–56 | **Discover** and **Variations** belong to the slot picker. Variations has three tiers of six cards. For Am, the large bottom row is **Am, Amaj, Asus2, Asus4, Am7, Am9**. Smaller rows offer extended and slash chords. Search changes the source chord live; e.g. `F#m7` works in A minor. Click one of the eight voicing buttons to reshape all choices; click it again to return to basic shapes. Unavailable grips say **No shape**. |
| Guide pp. 54, 110 | Discover has 5 large, 5 medium and 6 small bubbles. The **All** view mixes diatonic, borrowed and adventurous choices; each group can be explored separately. Blue, light blue and grey distinguish zero, one or multiple out-of-scale sounding notes. Borrowed chords can be auditioned and inserted normally. |

The [catalog evidence](../docs/scaler-installation.md#colors-and-sketch) distinguishes the installed bank's fourteen **voiced sets** from generated Colors recipes. Crest loads those sets by source name into their corresponding categories. Without the bank, its rows remain listed but unavailable; generated rows supply the initial matrix. Installed sets use `BankSet::colorDegree` to adapt degree order and transpose the pitches. Extensions, inversions, Open 3, negative/modal harmony and candidate ranking use Crest's rules. Discover prioritizes fourth-, fifth- and third-related destinations; this ordering and the [voicing engine](HARMONY.md) are reconstructions rather than measurements of Scaler MIDI output.

## Editor integration

`Palette::showColors()` presents the matrix. `openSlotPicker()` opens on Variations. Provide a scale, 1-based degree and previous sounding pitches with `setContext`. Its four-argument overload accepts an existing slot chord so its exact grip, including an extension or slash bass, can lead the list. `onClosePicker` returns to the editor's originating page. The parent owns transpose and destination controls.

`selectedChord()` and `hoveredChord()` return `std::optional<harmony::Chord>`. `onHover` reports entry and exit, `onChoose` auditions, `onInsert` handles double-click, and `onAuditionRow` receives sounding chords in left-to-right order. The drag payload uses the shared `beginChordDrag` protocol.

**Row persistence:** `juce::var getSettings() const` returns a five-element array, each element shaped like `{"family":"Inversions","recipe":"7ths Inverted","octave":0}`. Save it on `onSettingsChanged` and restore with `setSettings(const juce::var&)`. Category plus recipe name disambiguates the two Dominant and Subdominant choices and survives changes to catalog order. Restore does not trigger edits or audition and may precede local bank loading.

For a chooser capture with the default local bank rows, click component ID **`color-row-4-recipe`** (`INV: 7ths Inverted`). It opens on **Inversions**. Other stable IDs follow `color-row-{1..5}-{recipe,previous,next,octave-down,octave-up,play,degree-1..degree-7}`.
