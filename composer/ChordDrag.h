#pragma once
#include "Harmony.h"
#include <juce_gui_basics/juce_gui_basics.h>

namespace crest {
inline void beginChordDrag(juce::Component &source, const harmony::Chord &chord) {
    auto *container = juce::DragAndDropContainer::findParentDragContainerFor(&source);
    if (!container || container->isDragAndDropActive() || chord.pitches.empty())
        return;
    auto obj = std::make_unique<juce::DynamicObject>();
    obj->setProperty("kind", "crest.chord");
    obj->setProperty("root", chord.root);
    obj->setProperty("name", juce::String(chord.name));
    juce::Array<juce::var> notes;
    for (int pitch : chord.pitches)
        notes.add(pitch);
    obj->setProperty("pitches", notes);
    container->startDragging(juce::var(obj.release()), &source);
}
inline std::optional<harmony::Chord> draggedChord(const juce::var &data) {
    if (data["kind"].toString() != "crest.chord" || !data["root"].isInt())
        return {};
    harmony::Chord chord{data["name"].toString().substring(0, 120).toStdString(), int(data["root"]), {}};
    auto *notes = data["pitches"].getArray();
    if (chord.root < 0 || chord.root > 127 || !notes || notes->isEmpty() || notes->size() > 16)
        return {};
    for (const auto &pitch : *notes) {
        if (!pitch.isInt() || int(pitch) < 0 || int(pitch) > 127)
            return {};
        chord.pitches.push_back(int(pitch));
    }
    std::sort(chord.pitches.begin(), chord.pitches.end());
    return chord;
}
} // namespace crest
