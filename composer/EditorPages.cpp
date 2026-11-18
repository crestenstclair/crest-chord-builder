#include "Editor.h"
using namespace juce;
namespace crest {
void Editor::pageControls() {
    addAndMakeVisible(grid);
    addChildComponent(atlas);
    addAndMakeVisible(keyboard);
    addChildComponent(shade);
    shade.setColour(TextButton::buttonColourId, Colour(0xff000000));
    shade.setAlpha(.55f);
    shade.setName("Dismiss library");
    shade.onClick = [this] { closeBank(); };
    const std::array names{"Circle of Fifths", "Modulation", "Explore", "Colors", "Sketch"};
    for (int i = 0; i < 5; ++i) {
        auto &tab = nav[i];
        addAndMakeVisible(tab);
        tab.setButtonText(names[i]);
        tab.icon = i;
        tab.onClick = [this, i] { showPage(i); };
    }
    for (auto *b : {&destination, &stack, &scaleOct, &speed, &swing})
        addAndMakeVisible(*b);
    for (auto *b : {&pickerClose, &menu, &common, &bind, &keysView, &guitarView, &dockPlay})
        addAndMakeVisible(*b);
    for (auto *b : {&perform, &keyLock, &voiceGroup})
        addAndMakeVisible(*b);
    stack.addItemList({"Triads", "7ths"}, 1);
    stack.setSelectedId(1, dontSendNotification);
    stack.onChange = [this] { selectDegree(degree); };
    scaleOct.addItemList({"Oct 2", "Oct 3", "Oct 4"}, 1);
    scaleOct.onChange = root.onChange;
    scaleOct.setTooltip("Register of the current scale palette");
    destination.onChange = [this] { focusLane(destination.getSelectedId() - 1); };
    bind.onClick = [this] { bindLane(book.active); };
    menu.onClick = [this] { actionsMenu(); };
    common.onClick = [this] { browseBank(true); };
    dockPlay.onClick = [this] { playSketch(); };
    pickerClose.onClick = [this] {
        picker = false;
        updatePage();
        message("Picker closed.");
    };
    grid.onFocus = [this](int i) { focusLane(i); };
    grid.onPerformance = [this](int row) {
        focusLane(row);
        browseBank();
    };
    grid.onCell = [this](int i, int j) { openPicker(i, j); };
    grid.onDrop = [this](int i, int j, const auto &c) { dropChord(i, j, c); };
    grid.onOctave = [this](int row, int offset) { transposeLane(row, offset); };
    grid.onBind = [this](int i) { bindLane(i); };
    grid.onPlay = [this](int row) {
        focusLane(row);
        playSketch();
    };
    grid.onCopy = [this](int row) {
        focusLane(row);
        duplicateSketch();
    };
    grid.onRename = [this](int i) { renameLane(i); };
    grid.onClear = [this](int i) {
        focusLane(i);
        sketch().slots.clear();
        slot = 0;
        save();
        selectSlot(0, false);
    };
    grid.onToMain = [this](int i) { copyMain(i); };
    palette.onInsert = [this](const auto &c) {
        setCandidate(c);
        keep(false);
    };
    palette.onSettingsChanged=[this]{book.colorSettings=JSON::toString(palette.getSettings(),true);save(false);};
    palette.onClosePicker=pickerClose.onClick;
    palette.onHover=[this](const auto& c){keyboard.setNotes(sketch().scale,c?c->pitches:candidate.pitches);};
    atlas.onChoose = [this](const auto &c) { choose(c); };
    atlas.onInsert = palette.onInsert;
    atlas.onScale = [this](auto s) { setPaletteScale(s); };
    speed.addItemList({"x 1/2", "x 1", "x 2"}, 1);
    speed.onChange = [this] {
        sketch().speed = speed.getSelectedId() - 1;
        save();
    };
    for (int value : {50, 58, 66, 75})
        swing.addItem(value == 50 ? "Straight" : "Swing " + String(value) + "%", value);
    swing.onChange = [this] {
        sketch().swing = swing.getSelectedId();
        save();
    };
    perform.onClick = [this] {
        sketch().perform = perform.getToggleState();
        save();
    };
    voiceGroup.onClick = [this] {
        sketch().groupVoices = voiceGroup.getToggleState();
        save();
    };
    voiceGroup.setTooltip("Voice-lead generated MIDI toward the previous chord");
    keyLock.onClick = [this] { keyboard.setLock(keyLock.getToggleState()); };
    keyLock.setTooltip("Limit clicked instrument notes to the selected scale");
    keysView.onClick = [this] {
        keyboard.setGuitar(false);
        keysView.setToggleState(true, dontSendNotification);
        guitarView.setToggleState(false, dontSendNotification);
    };
    guitarView.onClick = [this] {
        keyboard.setGuitar(true);
        keysView.setToggleState(false, dontSendNotification);
        guitarView.setToggleState(true, dontSendNotification);
    };
    keysView.onClick();
    keyboard.onNote = [this](int n) {
        int key = BoundKeys::slotFor(n);
        if (book.bound >= 0 && key >= 0) {
            const auto &row = book.sketches[book.bound];
            if (key < int(row.slots.size()) && !row.slots[key].chord.pitches.empty())
                preview(row.slots[key].chord, book.bound, key);
            else
                proc.audition.stop();
            return;
        }
        preview({harmony::noteName(n), n, {n}});
    };
    keyboard.onRelease = [this] { proc.audition.stop(); };
    for (auto *b : {&openMotion, &openGuitar, &writeGuitar})
        b->setVisible(false);
}
void Editor::updateFooter() {
    destination.clear(dontSendNotification);
    destination.addItem("Main Track", mainLane + 1);
    destination.addSeparator();
    for (int i = 0; i < sketchCount; ++i)
        destination.addItem(book.sketches[i].name, i + 1);
    destination.setSelectedId(book.active + 1, dontSendNotification);
    scaleOct.setSelectedId(sketch().scale.tonic / 12 - 2, dontSendNotification);
    perform.setToggleState(sketch().perform, dontSendNotification);
    speed.setSelectedId(sketch().speed + 1, dontSendNotification);
    swing.setSelectedId(sketch().swing, dontSendNotification);
    voiceGroup.setToggleState(sketch().groupVoices, dontSendNotification);
    bind.setToggleState(book.active == book.bound, dontSendNotification);
    dockPlay.setEnabled(!sketch().slots.empty());
}
void Editor::showPage(int value) {
    picker = false;
    closeBank();
    if (book.page != value) {
        book.page = value;
        save(false);
    }
    updatePage();
}
void Editor::updatePage() {
    const bool colors = !picker && book.page == 3, sketchPage = !picker && book.page == 4;
    for (auto &n : nav) {
        n.selected = n.icon == book.page;
        n.repaint();
    }
    grid.setVisible(sketchPage);
    atlas.setVisible(!picker && book.page < 3);
    palette.setVisible(picker || colors);
    if (picker)
        palette.openSlotPicker();
    else if (colors)
        palette.showColors();
    else if (book.page < 3)
        atlas.setView(static_cast<HarmonicAtlas::View>(book.page));
    pickerClose.setVisible(picker);
    for (auto *b : {&octaveDown, &octaveUp, &semiDown, &semiUp})
        b->setVisible(picker);
    for (auto *b : {&progression})
        b->setVisible(sketchPage);
    load.setVisible(sketchPage);
    clone.setVisible(sketchPage);
    common.setVisible(!picker);
    // Every page edits the same destination strip. The picker never opens an arrangement.
    add.setVisible(colors || picker);
    detail.setVisible(colors || picker);
    workspace.setVisible(!picker);
    workspace.setText(book.page == 4 ? "Sketch" : nav[book.page].getButtonText(), dontSendNotification);
    resized();
    repaint();
}
void Editor::focusLane(int row) {
    if (row < 0 || row >= laneCount || row == book.active)
        return;
    auto current = sketch().scale;
    book.active = row;
    if (sketch().slots.empty())
        sketch().scale = current;
    slot = 0;
    degree = 1;
    save(false);
    selectSlot(0, false);
}
void Editor::openPicker(int row, int column) {
    focusLane(row);
    picker = true;
    selectSlot(column);
    updatePage();
}
void Editor::dropChord(int row, int column, const harmony::Chord &c) {
    focusLane(row);
    selectSlot(column, false);
    setCandidate(c);
    keep(false);
}
void Editor::setPaletteScale(harmony::Scale s) {
    s.tonic = std::clamp(s.tonic, 36, 71);
    sketch().scale = s;
    degree = 1;
    save();
    selectDegree(1);
    message("Scale palette updated. Existing notes keep their pitches.");
}
void Editor::transposeLane(int i, int oct) {
    auto &s = book.sketches[i];
    int shift = 12 * oct;
    for (const auto &x : s.slots) {
        const auto &c = x.chord;
        if (c.pitches.empty())
            continue;
        if (c.root + shift < 0 || c.root + shift > 127 || c.pitches.front() + shift < 0 ||
            c.pitches.back() + shift > 127) {
            message("This lane cannot move another octave.");
            return;
        }
    }
    for (auto &x : s.slots)
        if (!x.chord.pitches.empty()) {
            x.chord.root += shift;
            for (int &pitch : x.chord.pitches)
                pitch += shift;
        }
    save();
    if (book.active == i)
        selectSlot(slot, false);
    message(s.name + " moved " + String(oct) + " octave.");
}
void Editor::bindLane(int i) {
    book.bound = book.bound == i ? -1 : i;
    save();
    message(book.bound < 0 ? "Keys unbound."
                           : book.sketches[i].name + " bound to the eight white MIDI keys from 36 through 48.");
}
void Editor::copyMain(int i) {
    auto s = book.sketches[i];
    s.name = "Main Track";
    book.sketches[mainLane] = std::move(s);
    book.active = mainLane;
    slot = 0;
    save();
    selectSlot(0, false);
    message("Copied to Main Track. The sketch is still available.");
}
void Editor::renameLane(int i) {
    auto *box = new AlertWindow("Rename sketch", "Name this lane", MessageBoxIconType::NoIcon, this);
    box->addTextEditor("name", book.sketches[i].name);
    box->addButton("Save", 1, KeyPress(KeyPress::returnKey));
    box->addButton("Cancel", 0, KeyPress(KeyPress::escapeKey));
    box->enterModalState(true,
                         ModalCallbackFunction::create(
                             [self = Component::SafePointer<Editor>(this), box, i, rev = generation](int result) {
                                 if (!self || !result || self->proc.revision() != rev)
                                     return;
                                 auto name = box->getTextEditorContents("name").trim().substring(0, 64);
                                 if (name.isNotEmpty()) {
                                     self->book.sketches[i].name = name;
                                     self->save();
                                 }
                             }),
                         true);
}
void Editor::actionsMenu() {
    PopupMenu m;
    m.addItem(1, "Import performance MIDI...");
    m.addSeparator();
    m.addItem(2, "Open Crest guitar part...");
    m.addItem(3, "Save sketches as guitar parts...");
    m.addSeparator();
    m.addItem(4, "Save performed MIDI...", !clip.notes.empty());
    m.addItem(5, "Copy to an empty sketch");
    m.addItem(6, "Copy to Main Track", book.active != mainLane);
    m.showMenuAsync(PopupMenu::Options().withTargetComponent(&menu),
                    [self = Component::SafePointer<Editor>(this)](int id) {
                        if (!self)
                            return;
                        switch (id) {
                        case 1:
                            self->importMotion();
                            break;
                        case 2:
                            self->importGuitar();
                            break;
                        case 3:
                            self->exportGuitar();
                            break;
                        case 4:
                            self->saveMidi();
                            break;
                        case 5:
                            self->duplicateSketch();
                            break;
                        case 6:
                            self->copyMain(self->book.active);
                            break;
                        }
                    });
}
} // namespace crest
