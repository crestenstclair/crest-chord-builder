#pragma once
#include "Harmony.h"
#include <juce_core/juce_core.h>

namespace crest {
struct BankMotion {
    juce::String name, family, group;
    juce::File midi;
};
struct BankSet {
    juce::String name, group;
    int tonic = 0;
    std::vector<harmony::Chord> reference;
    std::vector<harmony::Chord> transposeTo(int tonicPitchClass) const;
    std::optional<harmony::Chord> colorDegree(harmony::Scale, int column) const;
};
struct LocalBank {
    std::vector<BankMotion> motions;
    std::vector<BankSet> progressions, colors;
    static LocalBank read(const juce::File &directory);
    static juce::File defaultFolder();
};
} // namespace crest
