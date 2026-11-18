# Crest Composer

A macOS VST3 for auditioning chord colors, keeping alternate eight-slot sketches, and dropping performed MIDI into Ableton. **Crest Composer** is an instrument; **Crest Chord Reference** is the existing guitar-sheet viewer. They have independent plug-in IDs and host state.

[Sketch](../docs/composer-pages/sketch.png) · [Slot picker](../docs/composer-pages/slot-picker.png) · [Colors](../docs/composer-pages/colors.png) · [Color chooser](../docs/composer-pages/color-chooser.png) · [Motions](../docs/composer-pages/motions.png) · [Progressions](../docs/composer-pages/progressions.png) · [Circle of Fifths](../docs/composer-pages/circle-of-fifths.png) · [Modulation](../docs/composer-pages/modulation.png) · [Explore](../docs/composer-pages/explore.png)

## Use in Live

### Set a performance on a Sketch row

Open **Sketch** inside Crest Composer. Next to each row name is a **Performance…** button. On **Sketch 2**, for example, click that button, audition a performance, then click **Apply to Sketch 2**. The row now shows the assigned name. Click its **▶** to play its progression. A selection made on an empty row is remembered for the chords you add later. To remove the performance, click its name and choose **Block chords**.

Each row saves its own choice. Scaler Performance phrases advance through chord changes and rests. Row playback, MIDI export, and **Send Sketch Clips** use that row's performed notes.

During preview, the header beside **Stop** shows the current chord name (or **Rest**). A teal highlight follows its slot in the Sketch row and the destination strip, independently of which slot you are editing.

### Preview through an Ableton instrument preset

**Verified in Live 12.4.16:** the corrected library device loaded before Operator on the same MIDI track. Open Composer opened the hosted editor; clicking its blue Am card produced audible sound and a nonzero peak measured after Operator. The temporary meter was removed after verification. The earlier package with incomplete project metadata is retired. Device state recall after saving and reopening a Live Set was not part of this test.

Search Live's Browser for **Crest Composer MIDI** (the Max for Live MIDI Effect). Place it **before** the instrument on a MIDI track:

**Crest Composer MIDI → Ableton instrument or Instrument Rack preset → audio effects**

Click **Open Composer** on the device. Click a chord or **Play sketch**: the next instrument in the chain receives the notes. Swap that instrument's preset to hear the same sketch with a different sound. The Crest preview oscillator is not sent to the track. **Keys thru** passes incoming clips and controller MIDI to the preset alongside Crest's generated notes. To trigger a saved lane instead, click its **Bind** button in Composer and select **Lane bind** on the device.

The effect hosts the installed `Crest Composer.vst3` with Max's `vst~`; its stored-only state parameter belongs to the individual device. Keep the VST3 installed, but you don't need to place it separately on the track. Preview does not require the CrestTimeline Control Surface. `python3 composer/tools/build_midi_effect.py` **stages only** under `composer/build/MIDI Effect/`. After Live verification, `--install` explicitly promotes it to **User Library → Presets → MIDI Effects → Max MIDI Effect**; for a custom library pass `--user-library /path/to/library`.

**Send labeled Session clips (0.2.2):** The installer updates the **CrestTimeline** Control Surface in the standard macOS Live User Library. Save your Set and restart Live. In **Settings → Link, Tempo & MIDI**, select **CrestTimeline** in an unused Control Surface row if it isn't already enabled; leave Input and Output at **None**. For a custom User Library, copy `composer/live/CrestTimeline/` into its `Remote Scripts/` folder before restarting.

In **Session View**, single-click the first empty clip slot on your instrument’s MIDI track. In Crest's **C** strip, click **Send Sketch Clips**. Each used sketch becomes one editable clip, in lane order, starting at that slot: for example, `Sketch 1 | Am9 - F - C - G | Accento`. Empty lanes are skipped; explicit rests keep their duration. The batch excludes Main Track. Crest adds scenes at the bottom if needed, but if any destination slot is occupied it places nothing. Clips are not launched. Check the status line for the track and scene numbers; **Cmd-Z** undoes a successful send. Use **Keys thru** on the MIDI effect so the exported notes play your instrument directly.

**Live 12.4.16 slot check:** the 0.2.2 renderer and sender delivered two three-bar Am–Dm–C sketches to the installed receiver. Live reported Accento (36 notes) in scene 2 and Adagietto (21 notes) in scene 3 on the same MIDI track as Operator. Their names, durations and performed MIDI were read back from the Session clips; the existing block-chord clip in scene 1 was preserved.

**Updating from 0.1.0:** Live 12.4.16 rejected that build because it declared an instrument with no MIDI input bus. Version 0.1.1 exposes a default-active main MIDI input and output. Ableton’s scanner recognized the rebuilt bundle and Steinberg’s validator passed all 47 tests. In Live, rescan under **Settings → Plug-Ins**, remove the failed device and load a fresh instance. If Live still has the old module loaded, save your set and restart Live.

1. Enable VST3 system folders in **Settings → Plug-Ins**, rescan and put **Crest → Crest Composer** on a MIDI track. Use the plug-in’s **Play sketch** for a one-shot preview. Starting Live’s transport does not start the sketch.
2. **Sketch** shows seven independent rows of eight slots. Select a scale in **B**; click a row name to target it, then **Load** a degree progression, or open **Progression bank** to compare the actual voiced variants. A row's play and octave buttons work on that row. The `...` menu can copy to another sketch or to the optional eight-slot Main Track.
3. Click a `+` or existing chord. **Discover / Variations** opens for that precise lane and slot. Eight visible voicing buttons, chord search and scale-fit colors let you hear alternatives. Click a chord to audition; double-click or **Add to slot / Replace slot** to commit. **Back** leaves the lane untouched. Inserting past an empty slot creates measured rests. Use **Colors** in the left rail to compare five rows; click a row's recipe name for its two-column menu. Drag a card onto the destination strip or double-click it. The octave and recipe for each row are saved.
4. The **C** strip stays visible across pages. Choose Main Track or a sketch, select slot length, reorder, add a rest, play, or export directly. **Bind** lets a MIDI controller play that lane's chords using eight white keys, MIDI 36–48, independently of which lane you edit. Bound chords emit on channel 2; ordinary playback emits on channel 1. The keyboard shows chord and playback notes; **Guitar** switches it to a standard-tuning fretboard. **More…** opens guitar project exchange and custom MIDI import.
5. The row's performance button and the footer **Performances** button open **Expressions → Performances → All subgroups**. On this Mac that opens all **233 Scaler 3 Performances across 13 groups**. Type a name, or narrow the list by subgroup. Click a result to audition, then the **Apply to** button naming your sketch. The adjacent footer dropdown selects Crest’s built-ins or the template already applied to the lane. [Browse and tag coverage](Motions.md).
6. Drag **Drag MIDI to DAW** onto a Live MIDI track or click **Save MIDI…**. The clipboard-like Main Track is optional; every sketch renders directly. The Circle, Modulation and Explore pages each audition and insert into the same destination. Click **Apply scale** to adopt an explored key.

**Try it:** A / Natural minor → Minor loop → Load → click slot 1 and double-click Am9 → Sketch 1's **Performance…** button → search **Accento** → **Apply to Sketch 1** → click the row's **▶**.

## Banks and guitar parts

- The built-in degree recipes work without Scaler: 12 roots, eight modes/collections, seven common progressions, 12 original playing styles. [Harmony rules](HARMONY.md) and [performance policies](PERFORMANCES.md).
- The optional local index combines this Mac’s Scaler 3.4.0 and Scaler 2.8.1. It holds **1,335 unique motions**, including **233 Performances**, **113 voiced progressions** across 16 patterns, and **14 color sets**. The default location is `~/Library/Application Support/Crest Composer/Local Bank/`. These assets are generated from the local installation and not distributed with the plug-in. Reindex with `python3 composer/tools/index_scaler.py`. Unknown builds fail verification rather than guessing offsets.
- The five Colors families are **Extensions, Voicings, Variations, Substitutions and Inversions**. For locally indexed voicings, Crest rotates the C-major or C-minor reference to the relative mode, then transposes. The harmonic-minor policy raises the natural-minor seventh.
- **Open guitar part…** loads one part of a Builder project into the selected sketch. **Save guitar parts…** exports every nonempty sketch as a part, omitting rests, timing and motion. [Guitar exchange details](../docs/composer-guitar-projects.md).

## Build, test, install

From the repository root, with macOS Command Line Tools and CMake 3.22+:

```sh
cmake -S composer -B composer/build -DCMAKE_BUILD_TYPE=Release
cmake --build composer/build --parallel 4
ctest --test-dir composer/build --output-on-failure
python3 composer/tools/index_scaler.py          # optional local factory library
python3 composer/tools/index_atlas.py           # shipped Explore constellations / chord dictionary
python3 composer/tools/index_motion_tags.py     # actual genre and mood tags
python3 composer/tools/install_composer.py
```

Set `-DCREST_JUCE_SOURCE=/path/to/JUCE` at configure time to use a local JUCE 8.0.12 checkout instead of fetching the pinned revision. The default build targets the current Mac architecture, macOS 13+, and is ad-hoc signed. It installs at `~/Library/Audio/Plug-Ins/VST3/Crest Composer.vst3`. Existing project builds and installs use different paths. See [upstream licensing](../plugin/THIRD_PARTY.md) for JUCE/VST3 terms.

For an additional check against the actual locally generated library:

```sh
composer/build/workflow_tests_artefacts/Release/workflow_tests --local-bank
CREST_VERIFY_SCALER_BANK="$HOME/Library/Application Support/Crest Composer/Local Bank" python3 -B -m unittest discover -s composer/tests -p 'test_index_scaler.py'
```

## Engineering notes

The plug-in editor and library are native JUCE controls. Music rules, performance transforms and SMF serialization are ordinary C++. File lookup, template parsing and render planning run off the audio callback. Audition swaps a prepared event sequence at a block boundary and emits note-offs when interrupted. Export is type-0 SMF, 480 PPQ, meter and tempo at tick zero, End of Track at the sketch boundary. Drag uses an OS file handoff; a host that does not accept the drag can import the saved `.mid`.

The [feature study](../docs/scaler-workflow.md) links the screenshots, manuals, versioned resource evidence and pitch-mapping investigation. This rebuild adds the five Create pages and preserves the established host identity. Old seven-lane saves read into the new book with an empty Main Track and no controller binding.

**Verified on this Mac:** the installed arm64 bundle passed signature verification and pluginval strictness 5, including editor open while processing and host-state tests. All five CTest suites and all six local-index tests passed. The workflow test imported all 1,335 local files, applied Accento through the editor, restored it from saved state, and compared audition MIDI with SMF note times, pitches and velocities for a test sketch. The physical drag into Live and a side-by-side render with Scaler were not exercised.
