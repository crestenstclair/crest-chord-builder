#pragma once
#include "StudioPad.h"
namespace crest {
class InstrumentStrip final : public juce::Component {
  public:
    InstrumentStrip();
    void setNotes(harmony::Scale, const std::vector<int> &);
    void setSounding(const std::array<bool, 128> &);
    void setGuitar(bool b) {
        guitar = b;
        repaint();
    }
    void setLock(bool b) {
        locked = b;
    }
    std::function<void(int)> onNote;
    std::function<void()> onRelease;
    void paint(juce::Graphics &) override;
    void resized() override;
    void mouseDown(const juce::MouseEvent &) override;
    void mouseDrag(const juce::MouseEvent &) override;
    void mouseUp(const juce::MouseEvent &) override;

  private:
    struct Key {
        int note;
        bool black;
        juce::Rectangle<float> box;
    };
    std::vector<Key> keys;
    void paintStrings(juce::Graphics &);
    int hit(juce::Point<float>) const;
    void press(int);
    bool guitar = false, locked = false;
    int pressed = -1;
    std::array<bool, 12> scale{};
    std::array<bool, 128> chosen{}, sounding{};
};
} // namespace crest
