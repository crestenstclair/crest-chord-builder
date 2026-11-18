#include "Editor.h"

using namespace juce;
namespace crest {
namespace {
void labelStyle(Label &l, float size, Colour colour, bool bold = false) {
    l.setFont(Font(FontOptions(size, bold ? Font::bold : Font::plain)));
    l.setColour(Label::textColourId, colour);
}
String describe(const harmony::Chord &chord) {
    StringArray names;
    for (int n : chord.pitches)
        names.add(String(harmony::noteName(n)) + String(n / 12 - 1));
    return names.joinIntoString("  ");
}
String slotName(const Slot &s) {
    return s.chord.pitches.empty() ? "Rest" : String(s.chord.name);
}
constexpr std::array<int, 6> lengths{1, 2, 4, 6, 8, 16};
} // namespace
Editor::Editor(Processor &p) : AudioProcessorEditor(p), proc(p) {
    look.setColour(ComboBox::backgroundColourId, ink::raised);
    look.setColour(ComboBox::outlineColourId, ink::raised.brighter(.15f));
    look.setColour(TextButton::buttonColourId, ink::raised);
    look.setColour(TextButton::textColourOffId, ink::bright);
    look.setColour(PopupMenu::backgroundColourId, ink::panel);
    look.setColour(PopupMenu::highlightedBackgroundColourId, ink::selected);
    setLookAndFeel(&look);
    controls();
    sketchControls();
    transportControls();
    pageControls();
    sync();
    if (LocalBank::defaultFolder().getChildFile("index.json").existsAsFile())
        loadBank();
    setResizable(true, true);
    setResizeLimits(1040, 690, 1900, 1250);
    setSize(1232, 782);
    startTimerHz(18);
}
Editor::~Editor() {
    stopTimer();
    proc.audition.stop();
    setLookAndFeel(nullptr);
}
void Editor::controls() {
    for (auto *l : {&title, &workspace, &summary, &status, &detail, &tempoReadout})
        addAndMakeVisible(*l);
    title.setText("Crest Composer", dontSendNotification);
    labelStyle(title, 28, ink::bright, true);
    labelStyle(workspace, 18, ink::bright, true);
    labelStyle(summary, 14, ink::accent, true);
    labelStyle(status, 14, ink::muted);
    labelStyle(detail, 15, ink::bright);
    labelStyle(tempoReadout, 13, ink::accent);
    addChildComponent(nowPlaying);
    nowPlaying.setComponentID("preview-chord");
    nowPlaying.setName("Now playing");
    labelStyle(nowPlaying, 19, studio::aqua, true);
    for (auto *box : {&root, &mode, &progression, &motion, &meter, &length})
        addAndMakeVisible(*box);
    for (auto *b : {&play, &stop, &load, &clone, &undo, &add, &rest, &remove, &earlier, &later, &openGuitar,
                    &writeGuitar, &openMotion, &writeMidi})
        addAndMakeVisible(*b);
    addAndMakeVisible(palette);
    addAndMakeVisible(drag);
    addAndMakeVisible(host);
    addAndMakeVisible(bpm);
    addAndMakeVisible(bankButton);
    bankButton.onClick = [this] { browseBank(); };
    bankButton.setTooltip("Browse all indexed Scaler Performances; choose a group or search by name");
    for (int n = 0; n < 12; ++n)
        root.addItem(harmony::noteName(n), n + 1);
    for (auto &m : modes())
        mode.addItem(m.name, int(m.mode) + 1);
    for (auto &p : harmony::commonProgressions())
        progression.addItem(p.name, progression.getNumItems() + 1);
    progression.setSelectedId(2, dontSendNotification);
    for (int i = 0; i < int(lengths.size()); ++i)
        length.addItem(String(lengths[i] * 0.25) + (lengths[i] == 4 ? " bar" : " bars"), lengths[i]);
    root.setTooltip("Scale root. Saved chords keep their pitches.");
    mode.setTooltip("Scale for degree pads and new chords");
    progression.setTooltip("Degree recipe, harmonized in the current scale");
    load.setTooltip("Replace this sketch with the selected progression; Undo restores it");
    add.setColour(TextButton::buttonColourId, ink::selected);
    drag.setColour(TextButton::buttonColourId, ink::selected);
    drag.setTooltip("Drag this button into Live. Save MIDI is the file-based equivalent.");
    clone.onClick = [this] { duplicateSketch(); };
    undo.onClick = [this] {
        if (undoBook) {
            book = std::move(*undoBook);
            undoBook.reset();
            slot = 0;
            save(false);
            selectSlot(0);
            message("Edit undone.");
        }
    };
    openGuitar.onClick = [this] { importGuitar(); };
    writeGuitar.onClick = [this] { exportGuitar(); };
    writeMidi.onClick = [this] { saveMidi(); };
    drag.drag = [this] { dragMidi(); };
    addAndMakeVisible(sendClips);
    sendClips.setColour(TextButton::buttonColourId, ink::selected);
    sendClips.setTooltip("One labeled Session clip per used Sketch lane, starting at Live's selected MIDI clip slot");
    sendClips.onClick = [this] { sendSketchClips(); };
    openMotion.onClick = [this] { importMotion(); };
    palette.onChoose = [this](const auto &chord) { choose(chord); };
    palette.onAuditionRow = [this](const auto &chords) {
        std::vector<composer::PerformanceSlot> row;
        StringArray names;
        for (auto &chord : chords) {
            row.push_back({chord.pitches, 1.0});
            names.add(chord.name);
        }
        startPreview(composer::renderPerformance(row, "block", proc.tempo(book), book.meter), std::move(names));
    };
    for (auto *b : {&octaveDown, &octaveUp, &semiDown, &semiUp})
        addAndMakeVisible(*b);
    octaveDown.onClick = [this] { transposeCandidate(-12); };
    octaveUp.onClick = [this] { transposeCandidate(12); };
    semiDown.onClick = [this] { transposeCandidate(-1); };
    semiUp.onClick = [this] { transposeCandidate(1); };
}
void Editor::sketchControls() {
    for (int i = 0; i < 7; ++i) {
        addAndMakeVisible(degrees[i]);
        degrees[i].onClick = [this, i] { selectDegree(i + 1); };
    }
    for (int i = 0; i < slotLimit; ++i) {
        addAndMakeVisible(slots[i]);
        slots[i].onClick = [this, i] { openPicker(book.active, i); };
        slots[i].onDrop = [this, i](const auto &chord) { dropChord(book.active, i, chord); };
    }
    root.onChange = mode.onChange = [this] {
        setPaletteScale({(scaleOct.getSelectedId() + 2) * 12 + root.getSelectedId() - 1,
                         static_cast<harmony::Mode>(mode.getSelectedId() - 1)});
    };
    length.onChange = [this] {
        if (slot < int(sketch().slots.size())) {
            sketch().slots[slot].quarterBars = length.getSelectedId();
            save();
        }
    };
    earlier.onClick = [this] { moveSlot(-1); };
    later.onClick = [this] { moveSlot(1); };
    add.onClick = [this] { keep(false); };
    rest.onClick = [this] { keep(true); };
    remove.onClick = [this] {
        auto &list = sketch().slots;
        if (slot < int(list.size())) {
            list.erase(list.begin() + slot);
            save();
            selectSlot(slot);
        }
    };
    load.onClick = [this] { loadProgression(); };
}
void Editor::transportControls() {
    bpm.setRange(30, 300, 1);
    bpm.setSliderStyle(Slider::IncDecButtons);
    bpm.setTextBoxStyle(Slider::TextBoxLeft, false, 45, 24);
    bpm.setTooltip("Local BPM; also used if the host has not supplied a tempo");
    bpm.onValueChange = [this] {
        book.bpm = int(bpm.getValue());
        save();
    };
    meter.addItem("3/4", 3);
    meter.addItem("4/4", 4);
    meter.onChange = [this] {
        book.meter = meter.getSelectedId();
        save();
    };
    host.onClick = [this] {
        book.hostTempo = host.getToggleState();
        save();
    };
    play.onClick = [this] { playSketch(); };
    stop.onClick = [this] {
        proc.audition.stop();
        message("Stopped.");
    };
    motion.onChange = [this] {
        auto i = motion.getSelectedId() - 1;
        const auto &bank = composer::performanceCatalog();
        if (i < 0)
            return;
        sketch().performance = i < int(bank.size()) ? bank.at(size_t(i)).id : "import";
        sketch().perform = true;
        save();
        if (!clip.notes.empty())
            playSketch();
    };
}
void Editor::sync() {
    closeBank(); // Host recall can replace both the lane and its name mid-browse.
    auto state = proc.snapshot();
    book = std::move(state.first);
    generation = state.second;
    saved = book;
    undoBook.reset();
    slot = 0;
    degree = 1;
    refresh();
    selectSlot(0, false);
    picker = false;
    if(book.colorSettings.isNotEmpty())palette.setSettings(JSON::parse(book.colorSettings));
    updatePage();
}
bool Editor::save(bool undoable) {
    if (!proc.commit(book, generation)) {
        sync();
        message("The host restored a different sketchbook.");
        return false;
    }
    if (undoable)
        undoBook = std::move(saved);
    saved = book;
    ++generation;
    refresh();
    return true;
}
void Editor::timerCallback() {
    if (auto result = timeline.completion()) {
        message(*result);
        updateSendButton();
    }
    if (generation != proc.revision())
        sync();
    tempoReadout.setText(String(proc.tempo(book), 1) + " BPM", dontSendNotification);
    std::array<bool, 128> lit{};
    for (int i = 0; i < 128; ++i)
        lit[i] = proc.sounding(i);
    keyboard.setSounding(lit);
    updatePreviewDisplay();
}
void Editor::startPreview(const composer::PerformanceRender &played, StringArray names, int lane, int firstSlot) {
    jassert(played.slotStarts.size() == size_t(names.size()));
    previewId = proc.audition.submit(played);
    previewNames = std::move(names);
    previewLane = lane;
    previewFirstSlot = firstSlot;
}
void Editor::startLanePreview(const composer::PerformanceRender &played, const Sketch &part, int lane) {
    StringArray names;
    for (const auto &s : part.slots) names.add(slotName(s));
    startPreview(played, std::move(names), lane);
}
void Editor::updatePreviewDisplay() {
    const auto cursor = proc.audition.cursor();
    const bool showing = cursor.preview == previewId && isPositiveAndBelow(cursor.slot, previewNames.size());
    const String name = showing ? previewNames[cursor.slot] : String{};
    // The snapshot names describe the audio even if the user edits the lane during playback.
    int column = -1;
    if (showing && isPositiveAndBelow(previewLane, laneCount)) {
        const auto &savedSlots = book.sketches[previewLane].slots;
        const int i = previewFirstSlot + cursor.slot;
        if (isPositiveAndBelow(i, int(savedSlots.size())) && slotName(savedSlots[i]) == name) column = i;
    }
    grid.showPlayingSlot(previewLane, column);
    for (int i = 0; i < slotLimit; ++i) slots[i].setPlaying(previewLane == book.active && column == i);
    if (showing) nowPlaying.setText(String::fromUTF8("▶  ") + name, dontSendNotification);
    if (showing != nowPlaying.isVisible()) {
        nowPlaying.setVisible(showing);
        repaint(nowPlaying.getBounds());
    }
}
void Editor::message(const String &text) {
    status.setText(text, dontSendNotification);
    status.setTooltip(text);
}
void Editor::refreshBank() {
    const auto &bank = composer::performanceCatalog();
    motion.clear(dontSendNotification);
    String familyName;
    int id = 0, selected = 0;
    for (auto &p : bank) {
        if (familyName != String(p.family)) {
            familyName = p.family;
            motion.addSectionHeading(familyName);
        }
        motion.addItem(p.name, ++id);
        if (p.id == sketch().performance)
            selected = id;
    }
    if (!sketch().templateMidi.empty()) {
        motion.addSectionHeading("Imported template");
        motion.addItem(sketch().templateName, ++id);
        if (sketch().performance == "import")
            selected = id;
    }
    motion.setSelectedId(selected, dontSendNotification);
}
void Editor::refreshSlots() {
    const int count = int(sketch().slots.size());
    slot = std::clamp(slot, 0, slotLimit - 1);
    for (int i = 0; i < slotLimit; ++i) {
        auto &pad = slots[i];
        if (i < count) {
            auto &s = sketch().slots[i];
            bool rest = s.chord.pitches.empty();
            pad.display(rest ? StudioPad::Kind::Rest : StudioPad::Kind::Chord, slotName(s),
                        String(i + 1) + "  /  " + String(s.quarterBars * .25) + " bar", i == slot,
                        rest ? nullptr : &s.chord);
        } else
            pad.display(i == count ? StudioPad::Kind::Append : StudioPad::Kind::Empty, i == count ? "+" : "", {},
                        i == slot);
    }
    grid.update(book, slot);
    remove.setEnabled(slot < count);
    earlier.setEnabled(slot > 0 && slot < count);
    later.setEnabled(slot + 1 < count);
    if (slot < count)
        length.setSelectedId(sketch().slots[slot].quarterBars, dontSendNotification);
    else if (!length.getSelectedId())
        length.setSelectedId(4, dontSendNotification);
    add.setButtonText(slot >= count ? "Add to slot " + String(slot + 1) : "Replace slot " + String(slot + 1));
    undo.setEnabled(undoBook.has_value());
    for (int i = 0; i < 7; ++i) {
        auto ch = harmony::degreeChord(
            sketch().scale, i + 1, stack.getSelectedId() == 2 ? harmony::Stack::Seventh : harmony::Stack::Triad);
        auto roman = String(std::array{"I", "II", "III", "IV", "V", "VI", "VII"}[i]);
        if (ch.pitches[1] - ch.root == 3)
            roman = roman.toLowerCase();
        if (ch.pitches[2] - ch.root == 6)
            roman += String::fromUTF8("°");
        degrees[i].display(StudioPad::Kind::Chord, ch.name, roman, i + 1 == degree, &ch);
    }
    workspace.setText(nav[book.page].getButtonText(), dontSendNotification);
}
void Editor::refresh() {
    refreshSlots();
    refreshBank();
    root.setSelectedId(sketch().scale.tonic % 12 + 1, dontSendNotification);
    mode.setSelectedId(int(sketch().scale.mode) + 1, dontSendNotification);
    bpm.setValue(book.bpm, dontSendNotification);
    host.setToggleState(book.hostTempo, dontSendNotification);
    meter.setSelectedId(book.meter, dontSendNotification);
    refreshPalette();
    updateFooter();
    atlas.setScale(sketch().scale);
    try {
        clip = render(sketch(), proc.tempo(book), book.meter);
    } catch (const std::exception &e) {
        clip = {};
        message(e.what());
    }
    bool audible = !clip.notes.empty();
    play.setEnabled(audible);
    drag.setEnabled(audible);
    updateSendButton();
    writeMidi.setEnabled(audible);
    summary.setText("PERFORMANCE    /    " + String(clip.notes.size()) + " NOTES    /    " +
                        String(double(clip.totalTicks) / composer::performancePPQ / book.meter, 2) + " BARS",
                    dontSendNotification);
    repaint();
}
void Editor::selectSlot(int index, bool sound) {
    auto &s = sketch();
    slot = std::clamp(index, 0, slotLimit - 1);
    if (slot < int(s.slots.size()) && !s.slots[slot].chord.pitches.empty()) {
        candidate = s.slots[slot].chord;
        auto scaleNotes = harmony::scaleNotes(s.scale);
        auto found = std::find_if(scaleNotes.begin(), scaleNotes.end(),
                                  [this](int n) { return n % 12 == candidate.root % 12; });
        degree = found == scaleNotes.end() ? 1 : int(found - scaleNotes.begin()) + 1;
    } else
        candidate = harmony::degreeChord(s.scale, degree);
    refreshSlots();
    refreshPalette();
    setCandidate(candidate);
    if(slot<int(s.slots.size())&&!s.slots[slot].chord.pitches.empty()){
        std::vector<int> prev;for(int i=slot-1;i>=0;--i)if(!s.slots[i].chord.pitches.empty()){prev=s.slots[i].chord.pitches;break;}
        palette.setContext(s.scale,degree,std::move(prev),s.slots[slot].chord);atlas.setContextChord(s.slots[slot].chord);
    }else atlas.setContextChord(std::nullopt);
    if (sound && slot < int(s.slots.size()) && !s.slots[slot].chord.pitches.empty())
        preview(candidate, book.active, slot);
    message("Slot " + String(slot + 1) + ": pick a degree, audition a color, then " + add.getButtonText() + ".");
}
void Editor::refreshPalette() {
    std::vector<int> previous;
    for (int i = std::min(slot, int(sketch().slots.size())) - 1; i >= 0; --i) {
        previous = sketch().slots.at(size_t(i)).chord.pitches;
        if (!previous.empty())
            break;
    }
    palette.setContext(sketch().scale, degree, std::move(previous));
}
void Editor::selectDegree(int value) {
    degree = value;
    refreshSlots();
    refreshPalette();
    choose(harmony::degreeChord(sketch().scale, degree,
                                stack.getSelectedId() == 2 ? harmony::Stack::Seventh : harmony::Stack::Triad));
}
void Editor::transposeCandidate(int semitones) {
    auto c = candidate;
    if (c.pitches.empty() || c.pitches.front() + semitones < 0 || c.pitches.back() + semitones > 127 ||
        c.root + semitones < 0 || c.root + semitones > 127)
        return;
    c.root += semitones;
    for (auto &pitch : c.pitches)
        pitch += semitones;
    if (semitones % 12) { // Replace each written root (including a slash bass) without altering its quality.
        auto rewrite = [semitones](std::string text, int root) {
            auto cut = text.find_first_not_of("#b", 1);
            return harmony::noteName(root) + (cut == std::string::npos ? "" : text.substr(cut));
        };
        auto slash = c.name.find('/');
        auto suffix = slash == std::string::npos ? std::string{} : "/" + harmony::noteName(c.pitches.front());
        c.name = rewrite(c.name.substr(0, slash), c.root) + suffix;
    }
    choose(c);
}
void Editor::choose(const harmony::Chord &c) {
    setCandidate(c);
    preview(c);
}
void Editor::setCandidate(const harmony::Chord &c) {
    candidate = c;
    keyboard.setNotes(sketch().scale, c.pitches);
    detail.setText(String(c.name) + "   /   " + describe(c), dontSendNotification);
}
void Editor::preview(const harmony::Chord &c, int lane, int column) {
    try {
        if (c.pitches.size() > 1 && sketch().perform && sketch().performance != "block") {
            // Audition the chord at the editor cursor, in the actual lane's phrasing and voicing context.
            auto part = sketch();
            part.slots.resize(size_t(slot + 1));
            part.slots[size_t(slot)].chord = c;
            if (slot >= int(sketch().slots.size()))
                part.slots[size_t(slot)].quarterBars = jmax(1, length.getSelectedId());
            auto played = render(part, proc.tempo(book), book.meter);
            const int start = played.slotStarts.back();
            std::erase_if(played.notes, [start](const auto &n) { return n.endTick <= start; });
            for (auto &n : played.notes) { n.startTick = jmax(0, n.startTick - start); n.endTick -= start; }
            played.totalTicks -= start;
            played.slotStarts = {0};
            startPreview(played, {String(c.name)}, lane, column);
            return;
        }
        startPreview(composer::renderPerformance({{c.pitches, 0.85}}, "block", proc.tempo(book), book.meter),
                     {String(c.name)}, lane, column);
    } catch (const std::exception &e) {
        message(e.what());
    }
}
void Editor::keep(bool isRest) {
    Slot keepSlot{isRest ? harmony::Chord{"Rest", 0, {}} : candidate, length.getSelectedId()};
    auto &items = sketch().slots;
    while (int(items.size()) < slot)
        items.push_back({{"Rest", 0, {}}, 4});
    if (slot == int(items.size()))
        items.push_back(keepSlot);
    else
        items.at(size_t(slot)) = keepSlot;
    int next = std::min(slot + 1, slotLimit - 1);
    save();
    selectSlot(next, false);
    if (picker) {
        picker = false;
        updatePage();
        message("Saved to " + sketch().name + ". Click another slot or drag MIDI to Live.");
    }
}
void Editor::loadProgression() {
    const auto &p = harmony::commonProgressions().at(size_t(progression.getSelectedId() - 1));
    auto chords = harmony::realize(sketch().scale, p);
    if (chords.size() > slotLimit) {
        message("Progression exceeds eight slots.");
        return;
    }
    auto &items = sketch().slots;
    items.clear();
    for (auto &c : chords)
        items.push_back({c, 4});
    slot = 0;
    save();
    selectSlot(0, false);
    message("Loaded " + String(p.name) + ". Play the sketch or select a slot to remix it.");
}
void Editor::moveSlot(int delta) {
    auto &list = sketch().slots;
    std::swap(list.at(size_t(slot)), list.at(size_t(slot + delta)));
    slot += delta;
    save();
    selectSlot(slot, false);
}
void Editor::duplicateSketch() {
    for (int i = 0; i < sketchCount; ++i)
        if (i != book.active && book.sketches[i].slots.empty()) {
            auto copy = sketch();
            copy.name = "Sketch " + String(i + 1);
            book.sketches[i] = std::move(copy);
            book.active = i;
            save();
            selectSlot(0, false);
            message("Copied. Remix this sketch independently.");
            return;
        }
    message("Every sketch is in use.");
}
void Editor::playSketch() {
    try {
        startLanePreview(render(sketch(), proc.tempo(book), book.meter), sketch(), book.active);
        message("Playing " + sketch().name + "  /  " + performanceName(sketch()));
    } catch (const std::exception &e) {
        message(e.what());
    }
}
} // namespace crest
