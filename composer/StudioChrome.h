#pragma once
#include "StudioPad.h"
namespace crest {
class StudioLook final : public juce::LookAndFeel_V4 {
  public:
    void drawButtonBackground(juce::Graphics &g, juce::Button &b, const juce::Colour &base, bool over,
                              bool down) override {
        auto r = b.getLocalBounds().toFloat().reduced(.5f);
        auto c = b.getToggleState() ? juce::Colour(0xff355456) : base;
        g.setColour((over || down ? c.brighter(.12f) : c).withMultipliedAlpha(b.isEnabled() ? 1.f : .5f));
        g.fillRoundedRectangle(r, 4);
        g.setColour(studio::line.withAlpha(.68f));
        g.drawRoundedRectangle(r, 4, 1);
    }
};
class PageTab final : public juce::TextButton {
  public:
    int icon = 0;
    bool selected = false;
    void paintButton(juce::Graphics &g, bool hot, bool) override {
        using namespace juce;
        auto r = getLocalBounds();
        g.fillAll(selected ? Colour(0xff303943) : hot ? studio::cell : studio::panel);
        g.setColour(studio::line);
        g.drawHorizontalLine(r.getBottom() - 1, 0, float(r.getWidth()));
        if (selected) {
            g.setColour(studio::aqua);
            g.fillRect(0, 0, 3, r.getHeight());
        }
        auto col = selected ? studio::text : studio::dim;
        g.setColour(selected ? studio::aqua : studio::dim);
        auto x = r.getCentreX(), y = r.getCentreY() - 9;
        Path p;
        switch (icon) {
        case 0:
            for (int radius : {9, 6, 2})
                g.drawEllipse(float(x - radius), float(y - radius), float(2 * radius), float(2 * radius), 1.4f);
            break;
        case 1:
            p.startNewSubPath(x - 10, y + 7);
            p.lineTo(x - 5, y + 7);
            p.lineTo(x - 1, y);
            p.lineTo(x + 3, y);
            p.lineTo(x + 6, y - 7);
            p.lineTo(x + 11, y - 7);
            g.strokePath(p, PathStrokeType(2));
            break;
        case 2:
            g.drawEllipse(float(x - 6), float(y - 9), 12, 13, 1.6f);
            g.drawHorizontalLine(y + 6, x - 4, x + 4);
            g.drawHorizontalLine(y + 9, x - 3, x + 3);
            for (int d : {-1, 1})
                g.drawLine(x + 8 * d, y - 3, x + 11 * d, y - 4, 1.5f);
            break;
        case 3:
            g.setFont(FontOptions(21, Font::bold));
            g.drawText("V", x - 12, y - 11, 18, 23, Justification::centred);
            g.setFont(FontOptions(11));
            g.drawText("9", x + 4, y - 15, 10, 14, Justification::centred);
            break;
        case 4:
            for (int i = 0; i < 9; ++i)
                g.fillRoundedRectangle(float(x - 10 + (i % 3) * 7), float(y - 7 + (i / 3) * 5), 5, 3, 1);
            break;
        }
        g.setColour(col);
        g.setFont(FontOptions(13, selected ? Font::bold : Font::plain));
        g.drawFittedText(getButtonText(), 2, y + 12, r.getWidth() - 4, 26, Justification::centred, 2, .85f);
    }
};
} // namespace crest
