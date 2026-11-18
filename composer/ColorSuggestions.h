#pragma once
#include "ColorControls.h"
#include "ColorRecipes.h"

namespace crest::palette_ui {
inline String normalizedSymbol(String symbol) {
    return symbol.trim()
        .removeCharacters(" -")
        .replace(String::charToString(0x266d), "b")
        .replace(String::charToString(0x266f), "#")
        .replace("major", "maj", true)
        .replace("minor", "m", true)
        .replace("min", "m", true);
}
inline int rootLength(const String &name) {
    if (name.isEmpty() || !String("ABCDEFG").containsChar(juce::CharacterFunctions::toUpperCase(name[0])))
        return 0;
    return name.length() > 1 && (name[1] == 'b' || name[1] == '#') ? 2 : 1;
}
inline int rootClass(const String &name) {
    constexpr int natural[]{9, 11, 0, 2, 4, 5, 7};
    int pc = natural[juce::CharacterFunctions::toUpperCase(name[0]) - 'A'];
    return (pc + (name.endsWith("#") ? 1 : name.endsWith("b") ? -1 : 0) + 12) % 12;
}
inline MaybeChord findChord(String input, harmony::Scale scale) {
    auto query = normalizedSymbol(input);
    int letters = rootLength(query);
    if (!letters)
        return {};
    auto spelling = query.substring(0, 1).toUpperCase() + query.substring(1, letters);
    int root = scale.tonic + (rootClass(spelling) - scale.tonic % 12 + 12) % 12;
    String symbol = spelling + query.substring(letters).upToFirstOccurrenceOf("/", false, false);
    if (symbol == spelling)
        symbol += "maj";
    auto options = harmony::variations({spelling.toStdString(), root, {root}});
    auto it = std::find_if(options.begin(), options.end(),
                           [&](const auto &c) { return normalizedSymbol(c.name).equalsIgnoreCase(symbol); });
    if (it == options.end())
        it = std::find_if(options.begin(), options.end(),
                          [&](const auto &c) { return normalizedSymbol(c.name).startsWithIgnoreCase(symbol); });
    if (it == options.end())
        return {};
    auto result = *it;
    if (query.contains("/")) {
        auto bass = query.fromFirstOccurrenceOf("/", false, false);
        if (rootLength(bass) == 0 || rootLength(bass) != bass.length())
            return {};
        int pc = rootClass(bass), low = result.pitches.front();
        if (low % 12 != pc) {
            int pitch = low - ((low - pc + 12) % 12);
            if (pitch < 0)
                return {};
            result.pitches.insert(result.pitches.begin(), pitch);
        }
        result.name += "/" + bass.substring(0, 1).toUpperCase().toStdString() + bass.substring(1).toStdString();
    }
    return result;
}

struct VoicingOption {
    const char *name;
    harmony::VoicingFamily family;
    const char *label;
};
inline constexpr auto voicingOptions =
    std::to_array<VoicingOption>({{"Dynamic", harmony::VoicingFamily::All, ""},
                                  {"1st Inv.", harmony::VoicingFamily::Inversions, "Inversion 1"},
                                  {"2nd Inv.", harmony::VoicingFamily::Inversions, "Inversion 2"},
                                  {"Open 1", harmony::VoicingFamily::Open, "Open 1"},
                                  {"Open 2", harmony::VoicingFamily::Open, "Open 2"},
                                  {"Guitar", harmony::VoicingFamily::Guitar, "Guitar"},
                                  {"Drop 2", harmony::VoicingFamily::Drop, "Drop 2"},
                                  {"Drop 3", harmony::VoicingFamily::Drop, "Drop 3"}});
inline MaybeChord shape(const Chord &chord, int filter, const std::vector<int> &previous) {
    if (filter < 0)
        return chord;
    if (filter == 0)
        return harmony::dynamicVoicing(chord, previous);
    auto option = voicingOptions[size_t(filter)];
    for (auto &choice : harmony::voicings(chord, option.family))
        if (choice.label.starts_with(option.label))
            return choice.chord;
    return {};
}

// Discover ranks cadential/third-related destination degrees first. A chromatic pool fills out
// borrowed and adventurous suggestions. The grouping uses the notes, not the source template's name.
class DiscoverChoices {
  public:
    DiscoverChoices(harmony::Scale s, int selectedDegree) : scale(s) {
        constexpr int ordered[]{3, 4, 5, 2, 1, 6, 0};
        for (int distance : ordered)
            addDegree((selectedDegree - 1 + distance) % 7 + 1);
        for (int distance : ordered)
            add(harmony::degreeChord(scale, (selectedDegree - 1 + distance) % 7 + 1, harmony::Stack::Seventh));
        int base = harmony::degreeChord(s, selectedDegree).root;
        for (int distance : {7, 5, 3, 8, 10, 2, 9, 4, 1, 6, 11, 0})
            addChromatic(base + distance);
    }
    std::vector<Chord> get(int filter) const {
        std::vector<Chord> result;
        if (filter) {
            append(result, groups[size_t(filter - 1)], 16);
            return result;
        }
        append(result, groups[0], 5);
        append(result, groups[1], 5);
        append(result, groups[2], 6);
        return result;
    }

  private:
    static void append(std::vector<Chord> &out, const std::vector<Chord> &pool, int n) {
        out.insert(out.end(), pool.begin(), pool.begin() + std::min(size_t(n), pool.size()));
    }
    void add(Chord chord) {
        size_t bucket = std::min(size_t(2), harmony::foreignNotes(scale, chord).size());
        auto &pool = groups[bucket];
        if (pool.size() < 16 &&
            std::none_of(pool.begin(), pool.end(), [&](const Chord &c) { return c.name == chord.name; }))
            pool.push_back(std::move(chord));
    }
    void addDegree(int d) {
        add(harmony::degreeChord(scale, d));
        const auto other =
            harmony::scaleNotes(scale)[2] - scale.tonic == 4 ? harmony::Mode::NaturalMinor : harmony::Mode::Major;
        add(harmony::degreeChord({scale.tonic, other}, d));
    }
    void addChromatic(int r) {
        auto source = Chord{harmony::noteName(r), r, {r, r + 4, r + 7}};
        for (auto &choice : harmony::variations(source))
            add(choice);
    }
    harmony::Scale scale;
    std::array<std::vector<Chord>, 3> groups;
};

class SlotSuggestions : public juce::Component {
  public:
    explicit SlotSuggestions(CardState &state) : events(state) {
        addAndMakeVisible(discover);
        addAndMakeVisible(variations);
        addAndMakeVisible(close);
        addAndMakeVisible(search);
        search.setComponentID("find-chord");
        search.setName("Find any Chord");
        search.setTextToShowWhenEmpty("Find any Chord", studio::dim);
        search.setColour(juce::TextEditor::backgroundColourId, studio::bg);
        search.setColour(juce::TextEditor::outlineColourId, studio::line);
        search.setColour(juce::TextEditor::focusedOutlineColourId, studio::aqua);
        search.setFont(juce::FontOptions(13.f));
        search.setIndents(8, 3);
        search.setInputRestrictions(48);
        search.onTextChange = [this] { refresh(); };
        close.setComponentID("close-slot-picker");
        close.setTooltip("Close slot picker");
        close.onClick = [this] {
            if (events.owner.onClosePicker)
                events.owner.onClosePicker();
            else
                events.owner.showColors();
        };
        discover.onClick = [this] { showTab(false); };
        variations.onClick = [this] { showTab(true); };
        for (int i = 0; i < 8; ++i) {
            auto &b = filters[size_t(i)];
            b.setButtonText(voicingOptions[size_t(i)].name);
            b.tint = true;
            addAndMakeVisible(b);
            b.onClick = [this, i] {
                voicing = i == voicing ? -1 : i;
                refresh();
            };
        }
        int n = 0;
        for (auto name : {"All", "Diatonic", "Borrowed", "Adventurous"}) {
            int id = n++;
            auto &b = discoverFilters[size_t(id)];
            b.setButtonText(name);
            addChildComponent(b);
            b.onClick = [this, id] {
                discoverFilter = id;
                refresh();
            };
        }
        for (auto &c : cards) {
            addChildComponent(c);
            c.connect(events, Card::suggestion);
        }
        cards.front().reference = true;
        for (auto &c : bubbles) {
            addChildComponent(c);
            c.connect(events, Card::bubble);
        }
        showTab(true);
    }
    void setContext(harmony::Scale s, int d, std::vector<int> prev, MaybeChord slot) {
        scale = s;
        degree = d;
        previous = std::move(prev);
        selectedSlot = std::move(slot);
        search.setText({}, false);
        refresh();
    }
    void open() {
        search.setText({}, false);
        showTab(true);
    }
    void resized() override {
        auto area = getLocalBounds().reduced(16, 11);
        auto head = area.removeFromTop(31);
        auto tabs = head;
        discover.setBounds(tabs.removeFromLeft(84));
        variations.setBounds(tabs.removeFromLeft(93));
        search.setBounds(head.withSizeKeepingCentre(195, 27));
        close.setBounds(head.removeFromRight(28));
        area.removeFromTop(9);
        if (!isVariations) {
            layoutDiscover(area);
            return;
        }
        auto segment = area.removeFromTop(29);
        segment = segment.withSizeKeepingCentre(juce::jmin(593, area.getWidth() - 75), 27);
        voicingLabel = segment.withWidth(57).translated(-62, 0);
        for (int i = 0; i < 8; ++i)
            filters[size_t(i)].setBounds(segment.removeFromLeft(segment.getWidth() / (8 - i)).reduced(1, 0));
        area.removeFromTop(8);
        area.removeFromBottom(24);
        auto stack = area.withSizeKeepingCentre(area.getWidth(), juce::jmin(area.getHeight(), 222));
        int cardHeight = stack.getHeight() - 12;
        layoutTier(stack.removeFromBottom(cardHeight * 39 / 100), 0, area.getWidth() * .73f);
        stack.removeFromBottom(6);
        layoutTier(stack.removeFromBottom(cardHeight * 33 / 100), 6, area.getWidth() * .67f);
        stack.removeFromBottom(6);
        layoutTier(stack, 12, area.getWidth() * .61f);
    }
    void paint(Graphics &g) override {
        g.fillAll(studio::panel);
        auto mid = getLocalBounds().getCentre().toFloat();
        g.setGradientFill(juce::ColourGradient(Colour(0xff26303a), mid, studio::panel,
                                               mid.translated(getWidth() * .43f, 0.f), true));
        g.fillRect(getLocalBounds());
        g.setColour(studio::dim);
        g.setFont(juce::FontOptions(12.f));
        if (isVariations)
            g.drawText("Voicing", voicingLabel, Justification::centredRight);
        if (noResults)
            g.drawText("No chord found. Try a symbol such as F#m7 or Bbmaj9.", getLocalBounds(),
                       Justification::centred);
        g.setFont(juce::FontOptions(11.5f));
        g.drawText(
            String::fromUTF8("Blue: in scale     •     Pale blue: one outside note     •     Grey: two or more"),
            getLocalBounds().reduced(12, 5).removeFromBottom(15), Justification::centred);
    }

  private:
    void showTab(bool variationsTab) {
        events.clear();
        isVariations = variationsTab;
        variations.active = isVariations;
        discover.active = !isVariations;
        search.setVisible(isVariations);
        for (auto &f : filters)
            f.setVisible(isVariations);
        for (auto &f : discoverFilters)
            f.setVisible(!isVariations);
        for (auto &c : cards)
            c.setVisible(false);
        for (auto &c : bubbles)
            c.setVisible(false);
        resized();
        refresh();
    }
    void refresh() {
        if (isVariations) {
            for (int i = 0; i < 8; ++i) {
                filters[size_t(i)].active = i == voicing;
                filters[size_t(i)].repaint();
            }
            auto input = search.getText().trim();
            auto target = input.isNotEmpty() ? findChord(input, scale) : selectedSlot;
            if (!target && input.isEmpty())
                target = harmony::degreeChord(scale, degree);
            auto choices = target ? rankedVariations(*target) : std::vector<Chord>{};
            noResults = choices.empty();
            for (size_t i = 0; i < cards.size(); ++i) {
                if (i >= choices.size()) {
                    cards[i].display({}, scale);
                    continue;
                }
                if (auto voiced = shape(choices[i], voicing, previous))
                    cards[i].display(voiced, scale);
                else
                    cards[i].unavailable(choices[i], scale, voicingOptions[size_t(voicing)].name);
            }
        } else {
            for (int i = 0; i < 4; ++i) {
                discoverFilters[size_t(i)].active = i == discoverFilter;
                discoverFilters[size_t(i)].repaint();
            }
            noResults = false;
            auto choices = DiscoverChoices(scale, degree).get(discoverFilter);
            for (size_t i = 0; i < bubbles.size(); ++i)
                bubbles[i].display(i < choices.size() ? MaybeChord(choices[i]) : MaybeChord{}, scale);
        }
        repaint();
    }
    void layoutTier(juce::Rectangle<int> area, int start, float width) {
        auto row = area.withSizeKeepingCentre(juce::jmin(785, int(width)), area.getHeight());
        for (int n = 0; n < 6; ++n)
            cards[size_t(start + n)].setBounds(row.removeFromLeft(row.getWidth() / (6 - n)).reduced(3, 0));
    }
    void layoutDiscover(juce::Rectangle<int> area) {
        area.removeFromBottom(20);
        auto tray = area.removeFromLeft(110);
        tray = tray.withSizeKeepingCentre(95, 140);
        for (auto &filter : discoverFilters)
            filter.setBounds(tray.removeFromTop(35).reduced(2));
        // Constellation centres and diameters share one coordinate system; keep the bubbles round at every size.
        struct Bubble {
            int x, y, d;
        };
        constexpr Bubble points[]{{127, 65, 56},  {183, 47, 56}, {242, 39, 56}, {215, 96, 56},
                                  {160, 115, 56}, {75, 63, 42},  {92, 104, 42}, {266, 87, 42},
                                  {294, 49, 42},  {312, 91, 42}, {97, 30, 30},  {37, 66, 30},
                                  {21, 96, 30},   {53, 96, 30},  {332, 56, 30}, {352, 85, 30}};
        float zoom = juce::jmin(area.getWidth() / 385.f, area.getHeight() / 152.f, 1.95f);
        auto origin = area.getCentre().toFloat() - juce::Point<float>(187.f * zoom, 76.f * zoom);
        for (size_t i = 0; i < bubbles.size(); ++i) {
            auto p = points[i];
            bubbles[i].setBounds(juce::Rectangle<float>(p.d * zoom, p.d * zoom)
                                     .withCentre(origin + juce::Point<float>(p.x * zoom, p.y * zoom))
                                     .toNearestInt());
        }
    }
    CardState &events;
    Chip discover{"Discover", Chip::tab}, variations{"Variations", Chip::tab},
        close{"Close", Chip::plain, Chip::close};
    juce::TextEditor search;
    using Segment = std::array<Chip, 8>;
    Segment filters{Chip({}, Chip::pill), Chip({}, Chip::pill), Chip({}, Chip::pill), Chip({}, Chip::pill),
                    Chip({}, Chip::pill), Chip({}, Chip::pill), Chip({}, Chip::pill), Chip({}, Chip::pill)};
    std::array<Chip, 4> discoverFilters{Chip({}, Chip::pill), Chip({}, Chip::pill), Chip({}, Chip::pill),
                                        Chip({}, Chip::pill)};
    std::array<Card, 18> cards;
    std::array<Card, 16> bubbles;
    juce::Rectangle<int> voicingLabel;
    harmony::Scale scale;
    MaybeChord selectedSlot;
    int degree = 1, voicing = -1, discoverFilter = 0;
    std::vector<int> previous;
    bool isVariations = true, noResults = false;
};
} // namespace crest::palette_ui
