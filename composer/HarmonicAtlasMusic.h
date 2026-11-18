#pragma once
// Private music/data boundary for HarmonicAtlas.cpp. No audio-thread work here.
#include "LocalBank.h"
#include <bit>
#include <set>

namespace crest::atlas {
using namespace juce;
using harmony::Chord;
using harmony::Mode;
using harmony::Scale;
using harmony::Stack;
constexpr std::array names{"C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"};
constexpr std::array modes{"Major", "Dorian", "Phrygian", "Lydian", "Mixolydian", "Minor", "Locrian", "Harmonic minor"};
inline int pc(int n) { return (n % 12 + 12) % 12; }
inline String scaleName(Scale s) { return String(names[pc(s.tonic)]) + " " + modes[int(s.mode)]; }
inline Scale safeScale(Scale s) {
    // Leave headroom for four stacked thirds and two-octave edits at either end of MIDI.
    const int anchor = s.tonic >= 24 && s.tonic <= 84 ? s.tonic : 48 + pc(s.tonic);
    return {anchor, isPositiveAndBelow(int(s.mode), 8) ? s.mode : Mode::Major};
}
inline String notesOf(const Chord& c) {
    StringArray result;
    for (auto n : c.pitches) result.add(String(names[pc(n)]) + String(n / 12 - 1));
    return result.joinIntoString("  ");
}
inline int pitchMask(const auto& pitches) {
    int mask = 0;
    for (int n : pitches) mask |= 1 << pc(n);
    return mask;
}
inline int outside(Scale s, const Chord& c) {
    return std::popcount(unsigned(pitchMask(c.pitches) & ~pitchMask(harmony::scaleNotes(s))));
}
inline Scale dynamicScale(const Chord& c) {
    // Match chord tones first. Resolve ties on the chord root, preferring familiar modes.
    Scale best{48 + pc(c.root), Mode::Major};
    int cost = 100;
    for (auto mode : {Mode::Major, Mode::NaturalMinor, Mode::Dorian, Mode::Mixolydian, Mode::Lydian,
                      Mode::Phrygian, Mode::HarmonicMinor, Mode::Locrian}) {
        Scale trial{best.tonic, mode};
        if (int misses = outside(trial, c); misses < cost) { best = trial; cost = misses; }
    }
    return best;
}
struct Edit { int oct = 0, semi = 0, inv = 0; };
inline String quality(const Chord& c) {
    auto symbol = String(c.name).upToFirstOccurrenceOf("/", false, false);
    int end = 1;
    while (end < symbol.length() && (symbol[end] == '#' || symbol[end] == 'b')) ++end;
    return symbol.substring(end);
}
inline Chord edited(Chord c, Edit edit, int transpose = 0) {
    if (c.pitches.empty()) return c;
    auto suffix = quality(c);
    for (int i = 0; i < edit.inv && c.pitches.size() > 1; ++i) {
        int raised = c.pitches.front() + 12;
        c.pitches.erase(c.pitches.begin());
        while (raised <= c.pitches.front() || std::binary_search(c.pitches.begin(), c.pitches.end(), raised)) raised += 12;
        c.pitches.insert(std::lower_bound(c.pitches.begin(), c.pitches.end(), raised), raised);
    }
    int shift = transpose + edit.semi + 12 * edit.oct;
    while (std::min(c.root, c.pitches.front()) + shift < 0) shift += 12;
    while (std::max(c.root, c.pitches.back()) + shift > 127) shift -= 12;
    for (auto& pitch : c.pitches) pitch += shift;
    c.root += shift;
    c.name = (String(names[pc(c.root)]) + suffix).toStdString();
    if (pc(c.root) != pc(c.pitches.front())) c.name += std::string("/") + names[pc(c.pitches.front())];
    return c;
}

struct Formula { String suffix; std::vector<int> steps; };
struct Preset { String genre, mood, name; std::array<Chord, 16> slots; };
struct Library {
    std::vector<Preset> presets;
    std::vector<Formula> formulas;
    String problem;
};
inline void require(bool pass) { if (!pass) throw std::invalid_argument("Invalid local Atlas bank"); }
inline const Array<var>& array(const var& value, int min, int max) {
    auto* a = value.getArray(); require(a && isPositiveAndBelow(a->size() - min, max - min + 1)); return *a;
}
inline int integer(const var& v, int low, int high) { require(v.isInt() && int(v) >= low && int(v) <= high); return int(v); }
inline String text(const var& v) { require(v.isString() && v.toString().isNotEmpty() && v.toString().length() <= 100); return v.toString(); }
inline std::vector<int> sequence(const var& v, int low, int high) {
    std::vector<int> result;
    for (const auto& item : array(v, 1, 14)) {
        auto n = integer(item, low, high); require(result.empty() || n > result.back()); result.push_back(n);
    }
    return result;
}
inline Chord readChord(const var& v) {
    auto notes = sequence(v["notes"], 18, 100);
    int root = integer(v["root"], 0, 11);
    return {(String(names[root]) + text(v["suffix"])).toStdString(), 48 + root, std::move(notes)};
}
inline Preset readPreset(const var& v) {
    Preset p{text(v["genre"]), text(v["mood"]), text(v["name"]), {}};
    require(p.mood == "Bright" || p.mood == "Dark" || p.mood == "Neutral");
    int i = 0;
    for (const auto& item : array(v["slots"], 16, 16)) p.slots[i++] = readChord(item);
    return p;
}
inline Library readLibrary() {
    auto file = LocalBank::defaultFolder().getChildFile("atlas-v1.json");
    if (!file.existsAsFile()) return {{}, {}, "Run python3 composer/tools/index_atlas.py, then reopen the editor."};
    try {
        require(file.getSize() <= 1024 * 1024);
        auto document = JSON::parse(file);
        integer(document["version"], 1, 1);
        Library lib;
        std::set<std::pair<String, String>> distinct;
        for (const auto& v : array(document["presets"], 81, 81)) {
            auto p = readPreset(v); require(distinct.emplace(p.genre, p.mood).second); lib.presets.push_back(std::move(p));
        }
        for (const auto& v : array(document["formulas"], 253, 253))
            lib.formulas.push_back({text(v["suffix"]), sequence(v["steps"], 0, 28)});
        return lib;
    } catch (const std::exception&) { return {{}, {}, "Invalid atlas-v1.json. Check your local bank and reopen the editor."}; }
}
inline Chord fromFormula(int root, const Formula& f) {
    Chord c{(String(names[pc(root)]) + f.suffix).toStdString(), root, {}};
    for (auto step : f.steps) c.pitches.push_back(root + step);
    return c;
}
inline String canonical(String s) {
    return s.trim().replaceCharacter(0x266d, 'b').replaceCharacter(0x266f, '#').replace("minor", "m", true)
            .replace("major", "maj", true).replace("min", "m", true).removeCharacters(" ()-");
}
inline std::pair<int, int> parseRoot(String s) {
    const int letter = String("C D EF G A B").indexOf(s.substring(0, 1).toUpperCase());
    if (s.isEmpty() || !String("ABCDEFG").containsChar(CharacterFunctions::toUpperCase(s[0]))) return {-1, 0};
    const int alteration = s[1] == '#' ? 1 : (s[1] == 'b' ? -1 : 0);
    return {pc(letter + alteration), alteration ? 2 : 1};
}
inline std::vector<Chord> rootCatalog(const Library& lib, int root) {
    if (lib.formulas.empty()) return harmony::variations({names[pc(root)], root, {root}});
    std::vector<Chord> result;
    for (const auto& f : lib.formulas) result.push_back(fromFormula(root, f));
    return result;
}
inline std::vector<Chord> search(const Library& lib, String query, int defaultRoot) {
    auto parts = StringArray::fromTokens(canonical(query), "/", "");
    auto symbol = parts[0];
    auto [root, used] = parseRoot(symbol);
    if (symbol.isNotEmpty() && root < 0) return {};
    auto key = symbol.substring(used);
    if (key.startsWithChar('M')) key = "maj" + key.substring(1);
    const auto slash = parseRoot(parts[1]);
    if (query.containsChar('/') && (parts.size() != 2 || slash.first < 0 || parts[1].length() != slash.second)) return {};
    std::vector<Chord> exact, other;
    for (auto c : rootCatalog(lib, 48 + (root < 0 ? pc(defaultRoot) : root))) {
        auto q = canonical(quality(c));
        if (!q.startsWithIgnoreCase(key)) continue;
        if (slash.first >= 0 && pc(c.pitches.front()) != slash.first) {
            int bass = c.pitches.front() - (pc(c.pitches.front() - slash.first - 1) + 1);
            c.pitches.insert(c.pitches.begin(), bass); c.name += std::string("/") + names[slash.first];
        }
        (q.equalsIgnoreCase(key) ? exact : other).push_back(std::move(c));
    }
    exact.insert(exact.end(), other.begin(), other.end());
    return exact;
}
inline std::vector<Chord> suggested(Scale scale, int seedMask, int requiredMask) {
    auto pool = harmony::degreeChords(scale);
    auto sevenths = harmony::degreeChords(scale, Stack::Seventh);
    pool.insert(pool.end(), sevenths.begin(), sevenths.end());
    std::erase_if(pool, [requiredMask](const Chord& c) { return (pitchMask(c.pitches) & requiredMask) != requiredMask; });
    auto affinity = [seedMask](const Chord& c) { return std::popcount(unsigned(pitchMask(c.pitches) & seedMask)); };
    std::stable_sort(pool.begin(), pool.end(), [&](const auto& a, const auto& b) { return affinity(a) > affinity(b); });
    return pool;
}
inline std::vector<Chord> pivots(Scale origin, Scale destination) {
    auto pool = harmony::degreeChords(origin);
    std::erase_if(pool, [destination](const Chord& c) { return outside(destination, c) != 0; });
    return pool;
}
inline std::vector<Chord> cadence(Scale destination, int degree) {
    auto landing = harmony::degreeChord(destination, degree);
    bool minor = (pitchMask(landing.pitches) & (1 << pc(landing.root + 3))) != 0;
    return {fromFormula(48 + pc(landing.root + 2), minor ? Formula{"m7b5", {0,3,6,10}} : Formula{"m7", {0,3,7,10}}),
            fromFormula(48 + pc(landing.root + 7), {"7", {0,4,7,10}}), landing};
}
} // namespace crest::atlas
