#pragma once
#include <juce_gui_basics/juce_gui_basics.h>

namespace crest::motion {
inline const juce::Colour chrome{0xff232527}, surface{0xff323436}, line{0xff424547}, text{0xffecefee},
    dim{0xffb2b8b7}, teal{0xff7cc8c8}, darkText{0xff10282a}, selectedRow{0xff365356};

inline void styleList(juce::ListBox &list, const juce::String &id) {
    list.setName(id);
    list.setComponentID(id);
    list.setColour(juce::ListBox::backgroundColourId, surface);
    list.setColour(juce::ListBox::outlineColourId, line);
    list.setOutlineThickness(0);
    list.setRowHeight(29);
    list.setMultipleSelectionEnabled(false);
    list.getViewport()->setScrollBarThickness(6);
    list.getVerticalScrollBar().setColour(juce::ScrollBar::thumbColourId, dim.withAlpha(.42f));
}

class Column final : private juce::ListBoxModel, public juce::ListBox {
  public:
    explicit Column(const juce::String &id) : ListBox(id) { styleList(*this, id); setModel(this); }
    ~Column() override { setModel(nullptr); }
    juce::String setChoices(juce::StringArray values, const juce::String &preferred) {
        juce::ScopedValueSetter<bool> block(replacing, true);
        choices = std::move(values);
        updateContent();
        int row = choices.indexOf(preferred);
        if (row < 0) row = choices.isEmpty() ? -1 : 0;
        selectRow(row);
        if (row >= 0) scrollToEnsureRowIsOnscreen(row);
        repaint();
        return choices[row];
    }
    std::function<void(juce::String)> onSelect;
  private:
    int getNumRows() override { return choices.size(); }
    juce::String getNameForRow(int row) override { return choices[row]; }
    void selectedRowsChanged(int row) override {
        if (!replacing && juce::isPositiveAndBelow(row, choices.size()) && onSelect) onSelect(choices[row]);
    }
    void paintListBoxItem(int row, juce::Graphics &g, int w, int h, bool selected) override {
        g.fillAll(selected ? teal : surface);
        g.setColour(line);
        g.drawHorizontalLine(h - 1, 0.f, float(w));
        g.setColour(selected ? darkText : text);
        g.setFont(juce::FontOptions(13.f, selected ? juce::Font::bold : juce::Font::plain));
        g.drawFittedText(choices[row], 11, 1, w - 24, h - 2, juce::Justification::centredLeft, 1, .88f);
        if (selected) {
            float x = float(w - 12), y = h / 2.f;
            g.drawLine(x, y - 3.f, x + 3.f, y, 1.3f);
            g.drawLine(x + 3.f, y, x, y + 3.f, 1.3f);
        }
    }
    bool replacing = false;
    juce::StringArray choices;
};
} // namespace crest::motion
