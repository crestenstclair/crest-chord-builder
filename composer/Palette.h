#pragma once
#include "Harmony.h"
#include "LocalBank.h"
#include <juce_gui_basics/juce_gui_basics.h>

namespace crest {
namespace ink {
inline const juce::Colour background{0xff141b21}, panel{0xff202931}, raised{0xff303e49}, selected{0xff286263},
    accent{0xff8ce2d2}, bright{0xffedf6f5}, muted{0xffa5b8c3}, warm{0xffefc38c};
}
class Palette : public juce::Component {
  public:
    Palette();
    ~Palette() override;
    void setContext(harmony::Scale, int degree, std::vector<int> previous = {});
    void setContext(harmony::Scale, int degree, std::vector<int> previous, const harmony::Chord &selectedSlot);
    void setBankColors(const std::vector<BankSet> &);
    void showColors();
    void openSlotPicker();
    juce::var getSettings() const;
    void setSettings(const juce::var &);
    std::optional<harmony::Chord> selectedChord() const;
    std::optional<harmony::Chord> hoveredChord() const;
    std::function<void(const harmony::Chord &)> onChoose;
    std::function<void(const harmony::Chord &)> onInsert;
    std::function<void()> onSettingsChanged, onClosePicker;
    std::function<void(const std::optional<harmony::Chord> &)> onHover;
    std::function<void(const std::vector<harmony::Chord> &)> onAuditionRow;
    void resized() override;

  private:
    struct Content;
    std::unique_ptr<Content> content;
};
} // namespace crest
