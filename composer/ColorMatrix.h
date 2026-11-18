#pragma once
#include "ColorChooser.h"

namespace crest::palette_ui {
inline String degreeLabel(harmony::Scale scale, const Chord &chord, int expected) {
    const auto tones = harmony::scaleNotes(scale);
    constexpr const char *roman[]{"I", "II", "III", "IV", "V", "VI", "VII"};
    auto offset = [&](int d) { return (chord.root - tones[size_t(d)] + 138) % 12 - 6; };
    int d = expected;
    for (int n = 0; n < 7; ++n)
        if (std::abs(offset(n)) < std::abs(offset(d)))
            d = n;
    auto contains = [&](int interval) {
        return std::any_of(chord.pitches.begin(), chord.pitches.end(),
                           [&](int pitch) { return (pitch - chord.root + 132) % 12 == interval; });
    };
    String degree = roman[d];
    if (contains(3) && !contains(4))
        degree = degree.toLowerCase();
    if (contains(6) && !contains(7))
        degree += String::charToString(contains(10) ? 0x00f8 : 0x00b0);
    if (offset(d) > 0)
        degree = "#" + degree;
    if (offset(d) < 0)
        degree = "b" + degree;
    return degree;
}

struct RowSettings {
    size_t recipe = 0;
    int octave = 0;
    bool chosen = false;
};
class ColorRow : public juce::Component {
  public:
    ColorRow() {
        for (auto *b : {&title, &prev, &next, &down, &up, &play})
            addAndMakeVisible(b);
        title.tint = prev.tint = next.tint = true;
        title.setTooltip("Choose a color for this row");
        prev.setTooltip("Previous color");
        next.setTooltip("Next color");
        down.setTooltip("Lower this row one octave");
        up.setTooltip("Raise this row one octave");
        play.setTooltip("Play this row from left to right");
        for (auto &pad : pads)
            addChildComponent(pad);
    }
    RowSettings settings;
    Chip title, prev{"Previous color", Chip::plain, Chip::left}, next{"Next color", Chip::plain, Chip::right},
        down{"Octave down", Chip::plain, Chip::left}, up{"Octave up", Chip::plain, Chip::right},
        play{"Play row", Chip::plain, Chip::play};
    std::array<Card, 7> pads;
    std::vector<Chord> sounds() const {
        std::vector<Chord> result;
        for (const auto &card : pads)
            if (card.sound)
                result.push_back(*card.sound);
        return result;
    }
    void update(harmony::Scale scale, const BankSet *bank) {
        const auto &recipe = colorRecipes()[settings.recipe];
        String prefix = String(recipe.family).substring(0, 3).toUpperCase();
        title.setButtonText(prefix + ": " + String(recipe.name));
        title.setTooltip(String(recipe.family) + "  /  " + String(recipe.name) + "  /  Choose color");
        for (int column = 0; column < 7; ++column) {
            auto chord = bank ? bank->colorDegree(scale, column) : recipeChord(scale, column + 1, settings.recipe);
            auto &pad = pads[size_t(column)];
            if (!chord || !shiftOctave(*chord, 12 * settings.octave))
                pad.display({}, scale);
            else
                pad.display(chord, scale,
                            degreeLabel(scale, *chord, recipe.fixedDegree ? recipe.fixedDegree - 1 : column));
        }
        down.setEnabled(settings.octave > -3);
        up.setEnabled(settings.octave < 3);
        missingBank = !recipe.bankName.empty() && !bank;
        play.setEnabled(!sounds().empty());
        repaint();
    }
    void resized() override {
        auto area = getLocalBounds().reduced(9, 2);
        auto bar = area.withSizeKeepingCentre(area.getWidth(), juce::jmin(28, area.getHeight()));
        recipeBox = bar.removeFromLeft(juce::jlimit(159, 207, getWidth() / 5));
        auto label = recipeBox.reduced(3, 0);
        next.setBounds(label.removeFromRight(21));
        prev.setBounds(label.removeFromRight(21));
        title.setBounds(label);
        bar.removeFromLeft(6);
        octLabel = bar.removeFromLeft(23);
        octBox = bar.removeFromLeft(64);
        auto number = octBox;
        down.setBounds(number.removeFromLeft(21));
        up.setBounds(number.removeFromRight(21));
        bar.removeFromLeft(3);
        play.setBounds(bar.removeFromLeft(26));
        area.setLeft(bar.getX() + 5);
        int h = juce::jlimit(23, 54, getHeight() - 12);
        auto blocks = area.withSizeKeepingCentre(area.getWidth(), h);
        for (int d = 0; d < 7; ++d)
            pads[size_t(d)].setBounds(blocks.removeFromLeft(blocks.getWidth() / (7 - d)).reduced(1, 0));
    }
    void paint(Graphics &g) override {
        g.fillAll(studio::panel);
        g.setColour(studio::line.withAlpha(.56f));
        g.drawHorizontalLine(getHeight() - 1, 7.f, getWidth() - 7.f);
        auto a = recipeBox.toFloat().reduced(.5f);
        g.setColour(Colour(0xff253437));
        g.fillRoundedRectangle(a, a.getHeight() * .5f);
        g.setColour(Colour(0xff406263));
        g.drawRoundedRectangle(a, a.getHeight() * .5f, 1);
        g.setColour(studio::line);
        g.drawRoundedRectangle(octBox.toFloat().reduced(.5f), 13, 1);
        g.setColour(studio::dim);
        g.setFont(juce::FontOptions(11.f));
        g.drawText("Oct", octLabel, Justification::centred);
        g.setColour(studio::text);
        g.setFont(juce::FontOptions(13.f));
        g.drawText(settings.octave > 0 ? "+" + String(settings.octave) : String(settings.octave), octBox,
                   Justification::centred);
        if (missingBank)
            g.drawText("Load the local bank to hear this voiced set.",
                       getLocalBounds().withLeft(play.getRight() + 12), Justification::centredLeft);
    }

  private:
    static bool shiftOctave(Chord &c, int semi) {
        if (c.root + semi < 0 || c.root + semi > 127 || c.pitches.front() + semi < 0 ||
            c.pitches.back() + semi > 127)
            return false;
        c.root += semi;
        for (auto &n : c.pitches)
            n += semi;
        return true;
    }
    juce::Rectangle<int> recipeBox, octLabel, octBox;
    bool missingBank = false;
};

class ColorMatrix : public juce::Component {
  public:
    explicit ColorMatrix(CardState &state) : events(state) {
        for (int r = 0; r < 5; ++r)
            connectRow(rows[size_t(r)], r);
        addChildComponent(chooser);
        chooser.onPick = [this](size_t recipe) {
            auto &row = rows[size_t(editing)];
            row.settings.recipe = recipe;
            changed(row);
        };
        applyDefaults();
        refresh();
    }
    void setScale(harmony::Scale s) {
        scale = s;
        refresh();
    }
    void setBank(const std::vector<BankSet> &supplied) {
        bank = supplied;
        applyDefaults();
        refresh();
        chooser.dismiss();
    }
    void hideMenu() { chooser.dismiss(); }
    juce::var saveRows() const {
        juce::Array<juce::var> data;
        for (auto &row : rows) {
            auto &r = colorRecipes()[row.settings.recipe];
            auto obj = std::make_unique<juce::DynamicObject>();
            obj->setProperty("family", String(r.family));
            obj->setProperty("recipe", String(r.name));
            obj->setProperty("octave", row.settings.octave);
            data.add(juce::var(obj.release()));
        }
        return juce::var(data);
    }
    void restoreRows(const juce::var &settings) {
        auto *input = settings.getArray();
        if (!input || input->size() != 5)
            return;
        for (int i = 0; i < 5; ++i) {
            const auto &item = input->getReference(i);
            if (!item.isObject() || !item["octave"].isInt())
                continue;
            if (auto recipe = find(item["family"].toString(), item["recipe"].toString()))
                rows[size_t(i)].settings = {*recipe, juce::jlimit(-3, 3, int(item["octave"])), true};
        }
        refresh();
    }
    void resized() override {
        auto band = getLocalBounds().reduced(3, 2);
        int left = int(rows.size());
        for (auto &row : rows)
            row.setBounds(band.removeFromTop(band.getHeight() / left--));
        chooser.setBounds(getLocalBounds());
    }
    void paint(Graphics &g) override { g.fillAll(studio::panel); }

  private:
    void connectRow(ColorRow &row, int r) {
        addAndMakeVisible(row);
        auto prefix = "color-row-" + String(r + 1) + "-";
        row.title.setComponentID(prefix + "recipe");
        row.prev.setComponentID(prefix + "previous");
        row.next.setComponentID(prefix + "next");
        row.down.setComponentID(prefix + "octave-down");
        row.up.setComponentID(prefix + "octave-up");
        row.play.setComponentID(prefix + "play");
        row.title.onClick = [this, r, &row] {
            editing = r;
            events.hover(nullptr);
            chooser.open(row.settings.recipe, [this](size_t i) { return available(i); });
        };
        row.prev.onClick = [this, &row] { cycle(row, -1); };
        row.next.onClick = [this, &row] { cycle(row, 1); };
        row.down.onClick = [this, &row] {
            --row.settings.octave;
            changed(row);
        };
        row.up.onClick = [this, &row] {
            ++row.settings.octave;
            changed(row);
        };
        row.play.onClick = [this, &row] {
            if (events.owner.onAuditionRow)
                events.owner.onAuditionRow(row.sounds());
        };
        int degree = 0;
        for (auto &pad : row.pads) {
            pad.connect(events, Card::tile);
            pad.setComponentID(prefix + "degree-" + String(++degree));
        }
    }
    static std::optional<size_t> find(const String &family, const String &name) {
        const auto &all = colorRecipes();
        auto it = std::find_if(all.begin(), all.end(), [&](const auto &r) {
            return String(r.family) == family && String(r.name) == name;
        });
        return it == all.end() ? std::nullopt : std::optional<size_t>(size_t(it - all.begin()));
    }
    const BankSet *source(size_t i) const {
        const String key(colorRecipes()[i].bankName);
        if (key.isEmpty())
            return nullptr;
        auto it = std::find_if(bank.begin(), bank.end(),
                               [&](const auto &set) { return set.name == key && set.reference.size() >= 7; });
        return it == bank.end() ? nullptr : &*it;
    }
    bool available(size_t i) const { return colorRecipes()[i].bankName.empty() || source(i) != nullptr; }
    void cycle(ColorRow &row, int step) {
        int i = int(row.settings.recipe), count = int(colorRecipes().size());
        do {
            i = (i + step + count) % count;
        } while (!available(size_t(i)));
        row.settings.recipe = size_t(i);
        changed(row);
    }
    void changed(ColorRow &row) {
        row.settings.chosen = true;
        row.update(scale, source(row.settings.recipe));
        if (events.owner.onSettingsChanged)
            events.owner.onSettingsChanged();
    }
    void applyDefaults() {
        const char *families[]{"Extensions", "Voicings", "Voicings", "Inversions", "Voicings"};
        const char *defaults[]{"7ths", "Voicing 1", "Voicing 7", "7ths Inverted", "Open 3"};
        const char *fallback[]{"7ths", "Open 1", "Open 2", "1st Inversion", "Open 3"};
        for (int i = 0; i < 5; ++i)
            if (!rows[size_t(i)].settings.chosen) {
                size_t recipe = find(families[i], defaults[i]).value();
                rows[size_t(i)].settings.recipe =
                    available(recipe) ? recipe : find(families[i], fallback[i]).value();
            }
    }
    void refresh() {
        for (auto &row : rows)
            row.update(scale, source(row.settings.recipe));
    }
    CardState &events;
    harmony::Scale scale;
    std::vector<BankSet> bank;
    std::array<ColorRow, 5> rows;
    ColorChooser chooser;
    int editing = 0;
};
} // namespace crest::palette_ui
