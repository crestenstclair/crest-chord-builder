#pragma once

#include "Harmony.h"
#include <juce_gui_basics/juce_gui_basics.h>
#include <optional>

namespace crest {
class HarmonicAtlas final : public juce::Component {
  public:
    enum class View { Circle, Modulation, Explore };
    HarmonicAtlas();
    ~HarmonicAtlas() override;
    void setView(View);
    void setScale(harmony::Scale);
    // Optional Section C input for Circle's shared-tone suggestions. Never auditions or commits.
    void setContextChord(std::optional<harmony::Chord>);

    std::function<void(const harmony::Chord&)> onChoose;
    std::function<void(const harmony::Chord&)> onInsert;
    std::function<void(harmony::Scale)> onScale;
    void resized() override;
    void visibilityChanged() override;

  private:
    struct Surface;
    std::unique_ptr<Surface> surface;
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(HarmonicAtlas)
};
} // namespace crest
