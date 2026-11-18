#include "ColorRecipes.h"
#include <algorithm>
#include <functional>

namespace crest {
using namespace harmony;
namespace {
using Maybe = std::optional<Chord>;
using Generator = std::function<Maybe(Scale, int)>;
struct Entry {
    ColorRecipe description;
    Generator generate;
};

Maybe voice(Chord source, VoicingFamily family, size_t index) {
    auto choices = voicings(source, family);
    return index < choices.size() ? Maybe{choices[index].chord} : Maybe{};
}
Generator voiced(Stack stack, VoicingFamily family, size_t index) {
    return [=](Scale s, int d) { return voice(degreeChord(s, d, stack), family, index); };
}
Chord raisedStack(Scale scale, int degree, int count) {
    auto result = degreeChord(scale, degree, Stack::Seventh);
    auto steps = scaleNotes(scale);
    for (int v = 4; v < count; ++v) {
        int position = degree - 1 + 2 * v;
        result.pitches.push_back(steps[position % 7] + 12 * (position / 7));
    }
    // A diatonic stack can have a flat ninth or sharp eleventh. Don't label all of them plain 9/11/13.
    for (const auto &known : variations(degreeChord(scale, degree)))
        if (known.pitches == result.pitches) {
            result.name = known.name;
            return result;
        }
    int ninth = result.pitches[4] - result.root;
    result.name += ninth == 13 ? "(b9" : ninth == 15 ? "(#9" : "(9";
    if (count >= 6)
        result.name += result.pitches[5] - result.root == 18 ? ",#11" : ",11";
    if (count >= 7)
        result.name += result.pitches[6] - result.root == 20 ? ",b13" : ",13";
    result.name += ")";
    return result;
}
Chord negative(Scale scale, int degree) {
    auto base = degreeChord(scale, degree);
    const int axis = 2 * scale.tonic + 7;
    const int root = scale.tonic + (axis - base.pitches.back() - scale.tonic + 120) % 12;
    std::vector<int> notes;
    for (int note : base.pitches)
        notes.push_back(root + (axis - note - root + 120) % 12);
    std::sort(notes.begin(), notes.end());
    Chord result{noteName(root) + " color", root, notes};
    for (const auto &known : variations(result))
        if (known.pitches == notes)
            return known;
    return result;
}
Chord parallel(Scale s, int d) {
    return degreeChord({s.tonic, scaleNotes(s)[2] - s.tonic == 4 ? Mode::NaturalMinor : Mode::Major}, d);
}
Chord appliedDominant(Scale s, int d) {
    const int r = degreeChord(s, d).root + 7;
    return {noteName(r) + "7", r, {r, r + 4, r + 7, r + 10}};
}
Chord appliedSubdominant(Scale s, int d) {
    const int r = degreeChord(s, d).root + 5;
    return {noteName(r) + "maj", r, {r, r + 4, r + 7}};
}
Chord openThird(Scale s, int d) {
    auto chord = degreeChord(s, d);
    chord.pitches[1] += 12;
    chord.pitches[2] += 12;
    return chord;
}
Chord doubleDrop(Scale s, int d) {
    auto chord = degreeChord(s, d, Stack::Seventh);
    chord.pitches[1] -= 12;
    chord.pitches[2] -= 12;
    std::sort(chord.pitches.begin(), chord.pitches.end());
    return chord;
}

std::vector<Entry> makeCatalog() {
    std::vector<Entry> entries;
    std::string family = "Extensions";
    auto add = [&](std::string name, Generator rule) { entries.push_back({{family, name, {}}, std::move(rule)}); };
    auto bank = [&](std::string name, std::string key) { entries.push_back({{family, name, key}, {}}); };
    add("Triads", [](Scale s, int d) { return degreeChord(s, d); });
    add("7ths", [](Scale s, int d) { return degreeChord(s, d, Stack::Seventh); });
    for (int n : {5, 6, 7})
        add(std::to_string(2 * n - 1) + "ths", [n](Scale s, int d) { return raisedStack(s, d, n); });
    add("Suspended",
        [](Scale s, int d) { return variations(degreeChord(s, d), VariationFamily::Suspended).at(1); });
    bank("6ths & 7ths", "6ths and 7ths");
    bank("Minor 7ths & 9ths", "Minor 7th,9ths");
    bank("Suspended 4ths, 7ths & 9ths", "Suspended 4th,7th,9ths");
    family = "Voicings";
    for (int i = 1; i <= 7; ++i) {
        auto name = "Voicing " + std::to_string(i);
        bank(name, name);
    }
    bank("Octaves & 3rds", "Octaves and 3rds");
    add("Open 1", voiced(Stack::Triad, VoicingFamily::Open, 0));
    add("Open 2", voiced(Stack::Triad, VoicingFamily::Open, 1));
    add("Open 3", openThird);
    add("Guitar", voiced(Stack::Triad, VoicingFamily::Guitar, 0));
    family = "Variations";
    int degree = 0;
    for (auto name : {"Tonic", "Supertonic", "Mediant", "Subdominant", "Dominant", "Submediant", "Leading Tone"}) {
        ++degree;
        entries.push_back({{family, name, {}, degree}, [degree](Scale s, int column) {
                               return rankedVariations(degreeChord(s, degree)).at(size_t(column - 1));
                           }});
    }
    family = "Substitutions";
    add("Parallel", parallel);
    add("Negative Harmony", negative);
    add("Dominant", appliedDominant);
    add("Subdominant", appliedSubdominant);
    for (auto [name, mode] : {std::pair{"Dorian", Mode::Dorian},
                              {"Phrygian", Mode::Phrygian},
                              {"Lydian", Mode::Lydian},
                              {"Mixolydian", Mode::Mixolydian},
                              {"Locrian", Mode::Locrian}})
        add(name, [mode](Scale s, int d) { return degreeChord({s.tonic, mode}, d); });
    add("Third above", [](Scale s, int d) { return substitutions(s, d)[0].chord; });
    add("Third below", [](Scale s, int d) { return substitutions(s, d)[1].chord; });
    family = "Inversions";
    add("1st Inversion", voiced(Stack::Triad, VoicingFamily::Inversions, 0));
    add("2nd Inversion", voiced(Stack::Triad, VoicingFamily::Inversions, 1));
    add("Drop 2", voiced(Stack::Seventh, VoicingFamily::Drop, 0));
    add("Drop 3", voiced(Stack::Seventh, VoicingFamily::Drop, 1));
    add("Drop 2 & 3", doubleDrop);
    bank("7ths Inverted", "7ths Inverted");
    bank("Octaves & Inverted 3rds", "Octaves and Inverted 3rds");
    bank("Triads Inverted", "Triads Inverted");
    return entries;
}
const std::vector<Entry> &catalog() {
    static const auto entries = makeCatalog();
    return entries;
}
std::string rootText(const Chord &chord) {
    auto end = chord.name.find_first_not_of("#b", 1);
    return chord.name.substr(0, end);
}
bool hasInterval(const Chord &chord, int interval) {
    return std::any_of(chord.pitches.begin(), chord.pitches.end(),
                       [&](int n) { return (n - chord.root + 132) % 12 == interval; });
}
} // namespace

const std::vector<ColorRecipe> &colorRecipes() {
    static const auto recipes = [] {
        std::vector<ColorRecipe> result;
        for (auto &entry : catalog())
            result.push_back(entry.description);
        return result;
    }();
    return recipes;
}
Maybe recipeChord(Scale scale, int column, size_t recipe) {
    if (column < 1 || column > 7 || recipe >= catalog().size())
        return {};
    const auto &make = catalog()[recipe].generate;
    return make ? make(scale, column) : Maybe{};
}
std::vector<Chord> rankedVariations(const Chord &source) {
    auto library = variations(source);
    auto root = library.empty() ? noteName(source.root) : rootText(library.front());
    const bool minor = hasInterval(source, 3);
    const std::array<const char *, 18> minorOrder = {"m",       "maj",     "sus2",      "sus4",    "m7",  "m9",
                                                     "m6",      "m6 9",    "dim",       "m(maj7)", "m11", "m6 11",
                                                     "m(maj9)", "m11(b5)", "m7 b9 b13", "m13(b5)", "m13", "/"};
    const std::array<const char *, 18> majorOrder = {"maj", "m",    "sus2", "sus4",      "maj7", "7",
                                                     "6",   "add9", "aug",  "dim",       "maj9", "9",
                                                     "m9",  "m11",  "m7b5", "aug(maj7)", "m13",  "/"};
    // Preserve the selected grip in the first box, including when searching for an extended chord.
    auto first = source;
    if (first.name == root)
        first.name += "maj";
    std::vector<Chord> result{first};
    for (std::string suffix : minor ? minorOrder : majorOrder) {
        auto match = std::find_if(library.begin(), library.end(), [&](const Chord &c) {
            return suffix == "/" ? c.name.find('/') != std::string::npos : c.name == root + suffix;
        });
        if (match != library.end() && match->name != first.name)
            result.push_back(*match);
        if (result.size() == 18)
            break;
    }
    return result;
}
} // namespace crest
