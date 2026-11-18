#include "Palette.h"
#include "ColorMatrix.h"
#include "ColorSuggestions.h"

namespace crest {
struct Palette::Content : public juce::Component {
    explicit Content(Palette &owner) : state(owner), colors(state), picker(state) {
        addAndMakeVisible(colors);
        addChildComponent(picker);
    }
    void setPage(bool picking) {
        state.clear();
        colors.hideMenu();
        colors.setVisible(!picking);
        picker.setVisible(picking);
        if (picking)
            picker.open();
    }
    void setContext(harmony::Scale scale, int degree, std::vector<int> previous,
                    std::optional<harmony::Chord> source) {
        colors.setScale(scale);
        picker.setContext(scale, degree, std::move(previous), std::move(source));
    }
    void resized() override {
        colors.setBounds(getLocalBounds());
        picker.setBounds(getLocalBounds());
    }
    palette_ui::CardState state;
    palette_ui::ColorMatrix colors;
    palette_ui::SlotSuggestions picker;
};
Palette::Palette() : content(std::make_unique<Content>(*this)) {
    addAndMakeVisible(*content);
}
Palette::~Palette() = default;
void Palette::setContext(harmony::Scale scale, int degree, std::vector<int> previous) {
    content->setContext(scale, degree, std::move(previous), {});
}
void Palette::setContext(harmony::Scale scale, int degree, std::vector<int> previous, const harmony::Chord &slot) {
    content->setContext(scale, degree, std::move(previous),
                        slot.pitches.empty() ? std::nullopt : std::optional(slot));
}
void Palette::setBankColors(const std::vector<BankSet> &sets) {
    content->colors.setBank(sets);
}
void Palette::showColors() {
    content->setPage(false);
}
void Palette::openSlotPicker() {
    content->setPage(true);
}
juce::var Palette::getSettings() const {
    return content->colors.saveRows();
}
void Palette::setSettings(const juce::var &value) {
    content->colors.restoreRows(value);
}
std::optional<harmony::Chord> Palette::selectedChord() const {
    return content->state.selected ? content->state.selected->sound : std::nullopt;
}
std::optional<harmony::Chord> Palette::hoveredChord() const {
    return content->state.hovered ? content->state.hovered->sound : std::nullopt;
}
void Palette::resized() {
    content->setBounds(getLocalBounds());
}
} // namespace crest
