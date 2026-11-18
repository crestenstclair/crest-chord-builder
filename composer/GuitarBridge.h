#pragma once

#include <juce_core/juce_core.h>
#include <vector>

namespace crest::guitar {

struct Chord {
    juce::String name;
    int root = 0;           // harmonic pitch class, 0=C; may be absent from notes
    std::vector<int> notes; // sounding MIDI pitches (0..127); read lowest first
};

struct Part {
    juce::String name;
    int tonic = 0;          // pitch class, not an absolute MIDI tonic
    juce::String scale;    // Builder scale ID (e.g. "minor", "harmonic")
    std::vector<Chord> chords;
};

// Reads all v1–v3 guitar parts in order, even if they exceed eight chords.
// The caller must refuse an oversized *selected* part before replacing a sketch.
std::vector<Part> readProject(const juce::String& json);

// Writes v3, one <=8-chord sketch per part. Rests and unrepresentable scale
// definitions are errors. Both functions report invalid input via std::invalid_argument.
juce::String writeProject(const std::vector<Part>& parts);

} // namespace crest::guitar
