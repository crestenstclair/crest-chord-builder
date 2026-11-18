#pragma once

#include "Harmony.h"
#include "Performance.h"
#include <array>
#include <juce_core/juce_core.h>

namespace crest {
constexpr int sketchCount = 7, slotLimit = 8, maxTemplateBytes = 128 * 1024;
constexpr int mainLane = sketchCount, laneCount = sketchCount + 1;
struct Slot {
    harmony::Chord chord; // empty pitches represent an explicit rest
    int quarterBars = 4;
};
struct Sketch {
    juce::String name;
    harmony::Scale scale;
    std::vector<Slot> slots;
    std::string performance = "block";
    juce::String templateName;
    std::vector<uint8_t> templateMidi;
    bool perform = true, groupVoices = false;
    int speed = 1, swing = 50; // 0=half, 1=normal, 2=double; swing midpoint %
};
struct Book {
    Book();
    std::array<Sketch, laneCount> sketches;
    int active = 0, bpm = 90, meter = 4;
    bool hostTempo = true;
    int bound = -1, page = 4; // Circle, Modulation, Explore, Colors, Sketch
    juce::String colorSettings;
};

struct ModeInfo {
    const char *name;
    const char *guitarId;
    harmony::Mode mode;
};
const std::array<ModeInfo, 8> &modes();
juce::String performanceName(const Sketch &);
composer::PerformanceRender render(const Sketch &, double bpm, int meter);
juce::String encode(const Book &);
Book decode(const juce::String &); // validates the entire snapshot or throws
} // namespace crest
