#include "SketchGrid.h"
using namespace juce;
namespace crest {
SketchGrid::SketchGrid() {
    for (int i = 0; i < sketchCount; ++i)
        setup(rows[i], i);
}
void SketchGrid::setup(Row &r, int i) {
    for (auto *b : {&r.name, &r.performance, &r.down, &r.up, &r.play, &r.bind, &r.more})
        addAndMakeVisible(*b);
    r.name.onClick = [this, i] { onFocus(i); };
    r.performance.onClick = [this, i] { onPerformance(i); };
    r.performance.setComponentID("sketch-" + String(i + 1) + "-performance");
    r.play.setComponentID("sketch-" + String(i + 1) + "-play");
    r.down.onClick = [this, i] { onOctave(i, -1); };
    r.up.onClick = [this, i] { onOctave(i, 1); };
    r.play.onClick = [this, i] { onPlay(i); };
    r.bind.onClick = [this, i] { onBind(i); };
    r.more.onClick = [this, i] { menu(i); };
    r.down.setTooltip("Lower existing chords one octave");
    r.up.setTooltip("Raise existing chords one octave");
    r.bind.setTooltip("Bind MIDI white keys 36–48 to this lane");
    r.play.setTooltip("Audition this sketch with its performance");
    for (int j = 0; j < slotLimit; ++j) {
        auto &pad = r.pads[j];
        addAndMakeVisible(pad);
        pad.setComponentID("sketch-" + String(i + 1) + "-slot-" + String(j + 1));
        pad.onClick = [this, i, j] { onCell(i, j); };
        pad.onDrop = [this, i, j](const auto &chord) { onDrop(i, j, chord); };
    }
}
void SketchGrid::menu(int row) {
    PopupMenu m;
    m.addItem(1, "Copy to an empty sketch");
    m.addItem(2, "Copy to Main Track");
    m.addItem(3, "Rename sketch...");
    m.addItem(4, "Clear sketch (undoable)");
    m.showMenuAsync(PopupMenu::Options().withTargetComponent(&rows[row].more),
                    [self = Component::SafePointer<SketchGrid>(this), row](int id) {
                        if (!self)
                            return;
                        if (id == 1)
                            self->onCopy(row);
                        if (id == 2)
                            self->onToMain(row);
                        if (id == 3)
                            self->onRename(row);
                        if (id == 4)
                            self->onClear(row);
                    });
}
void SketchGrid::update(const Book &book, int selected) {
    for (int i = 0; i < sketchCount; ++i) {
        auto &r = rows[i];
        const auto &lane = book.sketches[i];
        const auto count = int(lane.slots.size());
        r.name.setButtonText(lane.name);
        const bool styled = lane.perform && lane.performance != "block";
        const auto style = performanceName(lane);
        r.performance.setButtonText(styled ? style : String::fromUTF8("Performance…"));
        r.performance.setTooltip(lane.name + " performance: " + style + ". Click to change.");
        r.performance.setColour(TextButton::textColourOffId, styled ? studio::aqua : studio::text);
        r.name.setColour(TextButton::textColourOffId, i == book.active ? studio::aqua : studio::text);
        r.bind.setColour(TextButton::buttonColourId, book.bound == i ? Colour(0xff366367) : studio::cell);
        r.play.setEnabled(count > 0);
        r.down.setEnabled(count > 0);
        r.up.setEnabled(count > 0);
        for (int j = 0; j < slotLimit; ++j) {
            auto &pad = r.pads[j];
            bool focus = book.active == i && selected == j;
            if (j >= count) {
                bool next = j == count;
                pad.display(next ? StudioPad::Kind::Append : StudioPad::Kind::Empty, next ? "+" : "", {},
                            focus && next);
                pad.setTooltip("Drop a chord here, or click to choose one");
                continue;
            }
            auto &s = lane.slots[j];
            const bool rest = s.chord.pitches.empty();
            pad.display(
                rest ? StudioPad::Kind::Rest : StudioPad::Kind::Chord, rest ? "Rest" : String(s.chord.name),
                String(j + 1) + "  /  " + String(s.quarterBars * .25) + " bar", focus, rest ? nullptr : &s.chord);
            pad.setTooltip("Edit this chord or drag it to another slot");
        }
    }
}
void SketchGrid::showPlayingSlot(int lane, int slot) {
    if (playingLane == lane && playingSlot == slot) return;
    if (isPositiveAndBelow(playingLane, sketchCount) && isPositiveAndBelow(playingSlot, slotLimit))
        rows[playingLane].pads[playingSlot].setPlaying(false);
    playingLane = lane;
    playingSlot = slot;
    if (isPositiveAndBelow(lane, sketchCount) && isPositiveAndBelow(slot, slotLimit))
        rows[lane].pads[slot].setPlaying(true);
}
void SketchGrid::resized() {
    auto area = getLocalBounds().reduced(8, 4);
    const int rh = area.getHeight() / sketchCount;
    for (auto &r : rows) {
        auto line = area.removeFromTop(rh).reduced(0, 3);
        auto centered = line.withSizeKeepingCentre(line.getWidth(), jmin(27, line.getHeight()));
        r.name.setBounds(centered.removeFromLeft(jlimit(77, 125, getWidth() / 9)).reduced(1));
        r.performance.setBounds(centered.removeFromLeft(jlimit(104, 146, getWidth() / 8)).reduced(1));
        r.down.setBounds(centered.removeFromLeft(24).reduced(1));
        r.up.setBounds(centered.removeFromLeft(24).reduced(1));
        r.play.setBounds(centered.removeFromLeft(32).reduced(2));
        r.more.setBounds(centered.removeFromRight(23).reduced(1));
        r.bind.setBounds(centered.removeFromRight(42).reduced(2));
        line.setLeft(centered.getX());
        line.setRight(centered.getRight());
        for (int j = 0; j < slotLimit; ++j)
            r.pads[j].setBounds(line.removeFromLeft(line.getWidth() / (slotLimit - j)).reduced(2, 0));
    }
}
void SketchGrid::paint(Graphics &g) {
    g.fillAll(studio::panel);
}
} // namespace crest
