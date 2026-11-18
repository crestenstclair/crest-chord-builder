#pragma once
#include "ColorControls.h"
#include "ColorRecipes.h"

namespace crest::palette_ui {
class ColorChooser : public juce::Component {
  public:
    ColorChooser() {
        setWantsKeyboardFocus(true);
        addAndMakeVisible(close);
        close.setTooltip("Close Colors menu");
        close.onClick = [this] { dismiss(); };
        for (int i = 0; i < 5; ++i) {
            auto *b = categories.add(new Chip(names[size_t(i)], Chip::menu));
            addAndMakeVisible(b);
            b->onClick = [this, i] { showCategory(i); };
        }
        addAndMakeVisible(scroll);
        scroll.setViewedComponent(&list, false);
        scroll.setScrollBarsShown(true, false);
        for (size_t i = 0; i < colorRecipes().size(); ++i) {
            auto *b = items.add(new Chip(colorRecipes()[i].name, Chip::menu));
            list.addChildComponent(b);
            b->onClick = [this, i] {
                dismiss();
                if (onPick)
                    onPick(i);
            };
        }
    }
    void open(size_t recipe, std::function<bool(size_t)> available) {
        current = recipe;
        for (int i = 0; i < items.size(); ++i) {
            auto *b = items[i];
            bool enabled = available(size_t(i));
            b->setEnabled(enabled);
            b->active = size_t(i) == recipe;
            b->setTooltip(enabled ? String(colorRecipes()[size_t(i)].name)
                                  : "Install the local voiced bank to use this recipe");
        }
        setVisible(true);
        toFront(false);
        showCategory(
            int(std::find(names.begin(), names.end(), String(colorRecipes()[recipe].family)) - names.begin()));
        if (isShowing())
            grabKeyboardFocus();
    }
    void dismiss() { setVisible(false); }
    std::function<void(size_t)> onPick;
    void mouseDown(const juce::MouseEvent &e) override {
        if (!box.contains(e.getPosition()))
            dismiss();
    }
    bool keyPressed(const juce::KeyPress &k) override {
        if (k == juce::KeyPress::escapeKey) {
            dismiss();
            return true;
        }
        return false;
    }
    void resized() override {
        box = getLocalBounds().reduced(12, 5);
        box = box.withSizeKeepingCentre(juce::jmin(548, box.getWidth()), juce::jmin(340, box.getHeight()));
        auto area = box.reduced(9);
        auto head = area.removeFromTop(28);
        close.setBounds(head.removeFromRight(27));
        area.removeFromTop(5);
        auto left = area.removeFromLeft(area.getWidth() / 3);
        for (auto *b : categories)
            b->setBounds(left.removeFromTop(itemHeight).reduced(0, 1));
        area.removeFromLeft(3);
        scroll.setBounds(area);
        layoutList();
    }
    void paint(Graphics &g) override {
        g.fillAll(juce::Colours::black.withAlpha(.55f));
        auto frame = box.toFloat();
        g.setColour(studio::bg);
        g.fillRoundedRectangle(frame, 7);
        g.setColour(studio::line);
        g.drawRoundedRectangle(frame.reduced(.5f), 7, 1);
        g.setFont(juce::FontOptions(16, juce::Font::bold));
        g.setColour(studio::text);
        g.drawText("Colors", box.withHeight(42), Justification::centred);
    }

  private:
    void showCategory(int i) {
        category = juce::jlimit(0, 4, i);
        for (int n = 0; n < categories.size(); ++n) {
            categories[n]->active = n == category;
            categories[n]->repaint();
        }
        layoutList();
        scroll.setViewPosition(0, 0);
        if (items[int(current)]->isVisible())
            scroll.setViewPosition(0, juce::jmax(0, items[int(current)]->getBottom() - scroll.getHeight()));
    }
    void layoutList() {
        int y = 0;
        const auto &all = colorRecipes();
        int count = int(std::count_if(all.begin(), all.end(), [&](const auto &r) {
            return r.family == names[size_t(category)].toStdString();
        }));
        int width =
            scroll.getWidth() - (count * itemHeight > scroll.getHeight() ? scroll.getScrollBarThickness() : 0);
        for (int i = 0; i < items.size(); ++i) {
            bool inFamily = String(all[size_t(i)].family) == names[size_t(category)];
            items[i]->setVisible(inFamily);
            if (inFamily) {
                items[i]->setBounds(0, y + 1, width, itemHeight - 2);
                y += itemHeight;
            }
        }
        list.setSize(width, y);
    }
    const std::array<String, 5> names{"Extensions", "Voicings", "Variations", "Substitutions", "Inversions"};
    static constexpr int itemHeight = 26;
    Chip close{"Close", Chip::plain, Chip::close};
    juce::OwnedArray<Chip> categories, items;
    juce::Component list;
    juce::Viewport scroll;
    juce::Rectangle<int> box;
    size_t current = 0;
    int category = 0;
};
} // namespace crest::palette_ui
