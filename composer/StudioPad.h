#pragma once
#include "ChordDrag.h"

namespace crest {
namespace studio {
inline const juce::Colour bg{0xff191c20}, band{0xff272b30}, panel{0xff202429}, cell{0xff2d3238}, line{0xff41474c},
    text{0xffedf0f2}, dim{0xff9ba6ae}, aqua{0xff89d4d1}, blue{0xff426cbd}, blueHi{0xff5682d3};
}
class StudioPad final : public juce::TextButton, public juce::DragAndDropTarget {
  public:
    enum class Kind { Empty, Append, Chord, Rest };
    void setPlaying(bool value) {
        if (playing != value) { playing = value; repaint(); }
    }
    bool isPlaying() const { return playing; }
    void display(Kind type, juce::String title, juce::String sub, bool focused,
                 const harmony::Chord *sound = nullptr) {
        kind = type;
        active = focused;
        subtitle = std::move(sub);
        chord = sound ? std::optional(*sound) : std::nullopt;
        setButtonText(title);
        repaint();
    }
    std::function<void(const harmony::Chord &)> onDrop;
    void mouseDown(const juce::MouseEvent &e) override {
        dragged = false;
        TextButton::mouseDown(e);
    }
    void mouseDrag(const juce::MouseEvent &e) override {
        if (chord && !dragged && e.getDistanceFromDragStart() > 5) {
            dragged = true;
            beginChordDrag(*this, *chord);
        }
    }
    void mouseUp(const juce::MouseEvent &e) override {
        if (dragged) {
            setState(buttonNormal);
            return;
        }
        TextButton::mouseUp(e);
    }
    bool isInterestedInDragSource(const SourceDetails &source) override {
        return bool(onDrop) && bool(draggedChord(source.description));
    }
    void itemDragEnter(const SourceDetails &) override {
        over = true;
        repaint();
    }
    void itemDragExit(const SourceDetails &) override {
        over = false;
        repaint();
    }
    void itemDropped(const SourceDetails &source) override {
        over = false;
        repaint();
        if (auto c = draggedChord(source.description); c && onDrop)
            onDrop(*c);
    }
    void paintButton(juce::Graphics &g, bool hot, bool down) override {
        using namespace studio;
        const auto bounds = getLocalBounds().toFloat().reduced(0.75f);
        auto fill = kind == Kind::Chord ? blue : kind == Kind::Rest ? juce::Colour(0xff475063) : cell;
        if (playing) fill = juce::Colour(0xff246665);
        g.setColour((hot || down) ? fill.brighter(.16f) : fill);
        g.fillRoundedRectangle(bounds, 4);
        if (playing) {
            g.setColour(aqua);
            g.fillRoundedRectangle(bounds.getX() + 1.5f, bounds.getY() + 3, 3.f, bounds.getHeight() - 6, 1.5f);
        }
        if (over || active || kind == Kind::Append) {
            g.setColour(over ? aqua : active ? studio::text.withAlpha(.85f) : aqua.withAlpha(.52f));
            g.drawRoundedRectangle(bounds, 4, over ? 2 : 1);
        }
        if (kind == Kind::Empty)
            return;
        if (kind == Kind::Append) {
            g.setColour(aqua);
            g.setFont(juce::FontOptions(24));
            g.drawText("+", getLocalBounds(), juce::Justification::centred);
            return;
        }
        auto b = getLocalBounds().reduced(8, 3);
        g.setColour(studio::text);
        g.setFont(juce::FontOptions(15, juce::Font::bold));
        g.drawFittedText(getButtonText(), b.removeFromTop(b.getHeight() * 6 / 10),
                         juce::Justification::centredLeft, 1, .72f);
        g.setFont(juce::FontOptions(11));
        g.setColour(studio::text.withAlpha(.79f));
        g.drawText(subtitle, b, juce::Justification::centredLeft, true);
    }

  private:
    Kind kind = Kind::Empty;
    bool active = false, over = false, dragged = false, playing = false;
    juce::String subtitle;
    std::optional<harmony::Chord> chord;
};
} // namespace crest
