#pragma once
#include "Sketch.h"
#include "StudioPad.h"

namespace crest {
class SketchGrid final : public juce::Component {
  public:
    SketchGrid();
    void update(const Book &, int slot);
    void showPlayingSlot(int lane, int slot);
    void resized() override;
    void paint(juce::Graphics &) override;
    std::function<void(int, int)> onCell, onOctave;
    std::function<void(int)> onPlay, onPerformance, onBind, onFocus, onCopy, onToMain, onRename, onClear;
    std::function<void(int, int, const harmony::Chord &)> onDrop;

  private:
    struct Row {
        juce::TextButton name, performance, down{"-"}, up{"+"}, play{juce::String::fromUTF8("▶")}, bind{"Bind"}, more{"..."};
        std::array<StudioPad, slotLimit> pads;
    };
    void setup(Row &, int);
    void menu(int);
    std::array<Row, sketchCount> rows;
    int playingLane = -1, playingSlot = -1;
};
} // namespace crest
