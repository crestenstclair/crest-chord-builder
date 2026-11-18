#include "Harmony.h"

#include <algorithm>
#include <cstdlib>
#include <optional>
#include <stdexcept>
#include <string_view>
#include <tuple>
#include <utility>

namespace crest::harmony {
namespace {

using Notes = std::vector<int>;
using Steps = std::array<int, 7>;

bool isMidi(int note) { return note >= 0 && note <= 127; }

void requireMidi(int note) {
    if (!isMidi(note)) throw std::out_of_range("note outside MIDI 0..127");
}

void requireOrderedMidi(const Notes& pitches) {
    int previous = -1;
    for (int pitch : pitches) {
        requireMidi(pitch);
        if (pitch <= previous) throw std::invalid_argument("expected ascending distinct pitches");
        previous = pitch;
    }
}

void validate(const Chord& chord) {
    requireMidi(chord.root);
    if (chord.pitches.empty()) throw std::invalid_argument("empty chord");
    requireOrderedMidi(chord.pitches);
}

Steps steps(Scale scale) {
    requireMidi(scale.tonic);
    switch (scale.mode) {
        case Mode::Major:         return {0, 2, 4, 5, 7, 9, 11};
        case Mode::Dorian:        return {0, 2, 3, 5, 7, 9, 10};
        case Mode::Phrygian:      return {0, 1, 3, 5, 7, 8, 10};
        case Mode::Lydian:        return {0, 2, 4, 6, 7, 9, 11};
        case Mode::Mixolydian:    return {0, 2, 4, 5, 7, 9, 10};
        case Mode::NaturalMinor:  return {0, 2, 3, 5, 7, 8, 10};
        case Mode::Locrian:       return {0, 1, 3, 5, 6, 8, 10};
        case Mode::HarmonicMinor: return {0, 2, 3, 5, 7, 8, 11};
    }
    throw std::invalid_argument("unknown mode");
}

struct Quality { const char* symbol; VariationFamily family; Notes offsets; };

const std::vector<Quality>& qualities() {
    using F = VariationFamily;
    static const std::vector<Quality> catalog {
        {"maj", F::Triads, {0,4,7}},         {"m", F::Triads, {0,3,7}},
        {"dim", F::Triads, {0,3,6}},         {"aug", F::Triads, {0,4,8}},
        {"sus2", F::Suspended, {0,2,7}},     {"sus4", F::Suspended, {0,5,7}},
        {"m7", F::Extensions, {0,3,7,10}},   {"7", F::Extensions, {0,4,7,10}},
        {"maj7", F::Extensions, {0,4,7,11}}, {"m7b5", F::Extensions, {0,3,6,10}},
        {"dim7", F::Extensions, {0,3,6,9}},  {"m(maj7)", F::Extensions, {0,3,7,11}},
        {"aug(maj7)", F::Extensions, {0,4,8,11}}, {"6", F::Extensions, {0,4,7,9}},
        {"m6", F::Extensions, {0,3,7,9}},    {"add9", F::Extensions, {0,4,7,14}},
        {"madd9", F::Extensions, {0,3,7,14}}, {"m9", F::Extensions, {0,3,7,10,14}},
        {"9", F::Extensions, {0,4,7,10,14}}, {"maj9", F::Extensions, {0,4,7,11,14}},
        {"m(maj9)", F::Extensions, {0,3,7,11,14}}, {"m11", F::Extensions, {0,3,7,10,14,17}},
        {"m11(b5)", F::Extensions, {0,3,6,10,14,17}}, {"m7 b9 b13", F::Extensions, {0,3,7,10,13,20}},
        {"m6 11", F::Extensions, {0,3,7,9,17}}, {"m13(b5)", F::Extensions, {0,3,6,10,14,17,21}},
        {"m6 9", F::Extensions, {0,3,7,9,14}}, {"m13", F::Extensions, {0,3,7,10,14,17,21}}
    };
    return catalog;
}

constexpr std::string_view letters = "CDEFGAB";
constexpr Steps naturals {0, 2, 4, 5, 7, 9, 11};

std::string degreeSpelling(std::string_view tonicName, int index, int root) {
    const auto letter = (letters.find(tonicName.front()) + index) % letters.size();
    const int adjustment = (root % 12 - naturals[letter] + 18) % 12 - 6;
    return std::string(1, letters[letter]) + (adjustment < 0 ? std::string(-adjustment, 'b')
                                                            : std::string(adjustment, '#'));
}

std::string rootSpelling(const Chord& chord) {
    if (chord.name.empty()) return noteName(chord.root);
    const auto letter = letters.find(chord.name[0]);
    if (letter == std::string_view::npos) return noteName(chord.root);
    int pc = naturals[letter];
    size_t end = 1;
    while (end < chord.name.size() && (chord.name[end] == 'b' || chord.name[end] == '#')) {
        pc = (pc + (chord.name[end++] == 'b' ? 11 : 1)) % 12;
    }
    return pc == chord.root % 12 ? chord.name.substr(0, end) : noteName(chord.root);
}

Chord makeChord(int root, const Notes& offsets, const std::string& suffix, const std::string& rootName) {
    requireMidi(root + offsets.back());
    Chord chord {rootName + suffix, root, {}};
    for (int offset : offsets) chord.pitches.push_back(root + offset);
    return chord;
}

std::string degreeSuffix(const Notes& offsets) {
    for (const auto& q : qualities()) {
        if (q.offsets == offsets) return q.symbol == std::string_view("maj") ? "" : q.symbol;
    }
    throw std::logic_error("missing degree chord quality");
}

int toneCount(Stack stack) {
    switch (stack) {
        case Stack::Triad: return 3;
        case Stack::Seventh: return 4;
    }
    throw std::invalid_argument("unknown chord stack");
}

int pitchBit(int midi) { return 1 << (midi % 12); }

int pitchClasses(const Notes& pitches) {
    int result = 0;
    for (int pitch : pitches) result |= pitchBit(pitch);
    return result;
}

// Our slash colours specify an actual bass note; suffixes such as "6/9" do not.
bool hasSlashBass(const Chord& chord) {
    const auto slash = chord.name.rfind('/');
    if (slash == std::string::npos) return false;
    const auto bass = std::string_view(chord.name).substr(slash + 1);
    return !bass.empty() && letters.find(bass.front()) != letters.npos && bass.find_first_not_of("#b", 1) == bass.npos;
}

Notes closePosition(const Chord& chord) {
    const int start = hasSlashBass(chord) ? chord.pitches.front() : chord.root;
    const int classes = pitchClasses(chord.pitches);
    Notes notes;
    for (int pitch = start; pitch < start + 12; ++pitch) {
        if (classes & pitchBit(pitch)) notes.push_back(pitch);
    }
    return notes;
}

void addSlashColor(std::vector<Chord>& result, int bass, const std::string& bassName) {
    // E.g. A-C-F-G is Fadd9/A. Store F as the harmonic root even though A is the bass.
    if (!isMidi(bass + 10)) return;
    const int root = bass + (bass >= 4 ? -4 : 8);
    result.push_back({degreeSpelling(bassName, 5, root) + "add9/" + bassName, root, {bass,bass+3,bass+8,bass+10}});
}

void addVoicing(std::vector<Choice>& result, const Chord& source, std::string label, Notes pitches) {
    std::sort(pitches.begin(), pitches.end());
    if (!isMidi(pitches.front()) || !isMidi(pitches.back())) return;
    result.push_back({std::move(label), {source.name, source.root, std::move(pitches)}});
}

void addInversions(std::vector<Choice>& result, const Chord& chord, Notes notes) {
    const size_t first = hasSlashBass(chord) ? 1 : 0;
    for (size_t voice = first; voice + 1 < notes.size(); ++voice) {
        notes[voice] += 12;
        addVoicing(result, chord, "Inversion " + std::to_string(voice - first + 1), notes);
    }
}

Notes spread(Notes notes, size_t firstRaised) {
    for (size_t voice = firstRaised; voice < notes.size(); voice += 2) notes[voice] += 12;
    return notes;
}

// Rank-align the voices so adding a fourth note to a triad still compares bass with bass
// and soprano with soprano. For a single new voice use the middle of the previous chord.
Notes voiceTargets(const Notes& previous, size_t count) {
    if (count == 1) return {previous[previous.size() / 2]};
    Notes targets;
    for (size_t i = 0; i < count; ++i) {
        const size_t nearestRank = (i * (previous.size() - 1) + (count - 1) / 2) / (count - 1);
        targets.push_back(previous[nearestRank]);
    }
    return targets;
}

int motion(const Notes& notes, int shift, const Notes& targets) {
    int semitones = 0;
    for (size_t i = 0; i < notes.size(); ++i) semitones += std::abs(notes[i] + shift - targets[i]);
    return semitones;
}

struct NearestLayout {
    Notes targets, best;
    int bestMotion;

    void considerRegisters(Notes shape) {
        std::sort(shape.begin(), shape.end());
        const int lowestShift = shape.front() % 12 - shape.front();
        for (int shift = lowestShift; shape.back() + shift <= 127; shift += 12) {
            const int travel = motion(shape, shift, targets);
            if (travel >= bestMotion) continue;
            bestMotion = travel;
            best = shape;
            std::transform(best.begin(), best.end(), best.begin(), [shift](int n) { return n + shift; });
        }
    }

    void considerInversions(Notes closed, bool lockBass) {
        const size_t first = lockBass ? 1 : 0;
        for (size_t n = first; n < closed.size(); ++n) {
            considerRegisters(closed);
            if (closed.size() >= 3) {
                considerRegisters(spread(closed, 1));
                considerRegisters(spread(closed, 2));
            }
            closed[first] += 12;
            std::rotate(closed.begin() + first, closed.begin() + first + 1, closed.end());
        }
    }
};

std::array<int,12> classCounts(const Notes& notes) {
    std::array<int,12> counts {};
    for (int n : notes) ++counts[n % 12];
    return counts;
}

void addDrops(std::vector<Choice>& result, const Chord& chord, const Notes& closed) {
    for (size_t drop : {2u, 3u}) {
        if (closed.size() <= drop) continue;
        auto notes = closed;
        notes[notes.size() - drop] -= 12;
        if (hasSlashBass(chord)) notes.front() -= 12;
        addVoicing(result, chord, "Drop " + std::to_string(drop), std::move(notes));
    }
}

// A bounded search for one standard-tuning grip. Muted strings flank a contiguous
// sounding group. At most four fingers, counting a single barre at the lowest stop.
constexpr std::array<int, 6> tuning {40, 45, 50, 55, 59, 64};
using Frets = std::array<int, 6>;
using GripScore = std::tuple<int, int, int, int>;

std::optional<GripScore> scoreGrip(const Frets& frets) {
    int low = 16, high = 0, voices = 0, stops = 0, sum = 0;
    for (int fret : frets) {
        if (fret < 0) continue;
        ++voices;
        if (fret == 0) continue;
        low = std::min(low, fret);
        high = std::max(high, fret);
        ++stops;
        sum += fret;
    }
    const auto first = std::find(frets.begin(), frets.end(), low);
    const auto last = std::find(frets.rbegin(), frets.rend(), low).base();
    int fingers = stops;
    if (first != frets.end() && std::find(first, last, 0) == last)
        fingers -= static_cast<int>(std::count(first, last, low)) - 1;
    if (fingers > 4) return {};
    return GripScore {high, -voices, fingers, sum};
}

struct GuitarSearch {
    int wanted, rootClass;
    Frets frets {-1, -1, -1, -1, -1, -1};
    std::optional<GripScore> bestScore;
    Frets best {};

    void consider() {
        const auto score = scoreGrip(frets);
        if (score && (!bestScore || *score < *bestScore)) { best = frets; bestScore = score; }
    }

    void visit(size_t string, int found, int lastPitch, int low, int high) {
        if (string == tuning.size()) return;
        const int limit = bestScore ? std::get<0>(*bestScore) : 15;
        for (int fret = 0; fret <= limit; ++fret) {
            const int pitch = tuning[string] + fret, bit = pitchBit(pitch);
            if (!(bit & wanted) || pitch <= lastPitch || (!found && bit != rootClass)) continue;
            const int nextLow = fret ? std::min(low, fret) : low;
            const int nextHigh = std::max(high, fret);
            if (nextHigh - nextLow > 3) continue;
            frets[string] = fret;
            if ((found | bit) == wanted) consider();
            visit(string + 1, found | bit, pitch, nextLow, nextHigh);
            frets[string] = -1;
        }
    }
};

void addGuitar(std::vector<Choice>& result, const Chord& chord, const Notes& closed) {
    if (closed.size() < 3 || closed.size() > 6) return;
    const int bass = hasSlashBass(chord) ? chord.pitches.front() : chord.root;
    GuitarSearch search {pitchClasses(closed), pitchBit(bass), {-1,-1,-1,-1,-1,-1}, {}, {}};
    for (size_t first = 0; first <= tuning.size() - closed.size(); ++first)
        search.visit(first, 0, -1, 16, 0);
    if (!search.bestScore) return;

    std::string label = "Guitar ";
    Notes notes;
    for (size_t string = 0; string < tuning.size(); ++string) {
        const int fret = search.best[string];
        if (string != 0) label += '-';
        label += fret < 0 ? "x" : std::to_string(fret);
        if (fret >= 0) notes.push_back(tuning[string] + fret);
    }
    addVoicing(result, chord, std::move(label), std::move(notes));
}

} // namespace

std::string noteName(int midi) {
    requireMidi(midi);
    static constexpr const char* names[] = {"C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"};
    return names[midi % 12];
}

std::array<int, 7> scaleNotes(Scale scale) {
    auto notes = steps(scale);
    requireMidi(scale.tonic + notes.back());
    for (int& pitch : notes) pitch += scale.tonic;
    return notes;
}

Chord degreeChord(Scale scale, int degree, Stack stack) {
    if (degree < 1 || degree > 7) throw std::out_of_range("degree outside 1..7");
    const auto intervals = steps(scale);
    const int start = degree - 1, count = toneCount(stack);
    Notes offsets;
    for (int voice = 0; voice < count; ++voice) {
        const int step = start + 2 * voice;
        offsets.push_back(intervals[step % 7] + (step / 7) * 12 - intervals[start]);
    }
    const int root = scale.tonic + intervals[start];
    return makeChord(root, offsets, degreeSuffix(offsets), degreeSpelling(noteName(scale.tonic), start, root));
}

std::vector<Chord> degreeChords(Scale scale, Stack stack) {
    std::vector<Chord> chords;
    for (int degree = 1; degree <= 7; ++degree) chords.push_back(degreeChord(scale, degree, stack));
    return chords;
}

const std::vector<Progression>& commonProgressions() {
    static const std::vector<Progression> bank {
        {"Pop turnaround", {1,5,6,4}}, {"Minor loop", {1,6,3,7}},
        {"Descending bass", {1,7,6,5}}, {"Cadence", {2,5,1}},
        {"Fifties", {1,6,4,5}}, {"Three-chord cycle", {1,4,5,4}},
        {"Circle of fifths", {1,4,7,3,6,2,5,1}}
    };
    return bank;
}

std::vector<Chord> realize(Scale scale, const Progression& progression, Stack stack) {
    std::vector<Chord> chords;
    for (int degree : progression.degrees) chords.push_back(degreeChord(scale, degree, stack));
    return chords;
}

std::vector<Chord> variations(const Chord& chord, VariationFamily family) {
    validate(chord);
    std::vector<Chord> result;
    const int selected = pitchClasses(chord.pitches);
    const auto name = rootSpelling(chord);
    for (const auto& q : qualities()) {
        if (family != VariationFamily::All && q.family != family) continue;
        if (!isMidi(chord.root + q.offsets.back())) continue;
        auto variation = makeChord(chord.root, q.offsets, q.symbol, name);
        if (pitchClasses(variation.pitches) == selected) result.insert(result.begin(), std::move(variation));
        else result.push_back(std::move(variation));
    }
    if (family == VariationFamily::All || family == VariationFamily::Extensions) addSlashColor(result, chord.root, name);
    return result;
}

std::vector<Choice> substitutions(Scale scale, int degree) {
    const auto source = degreeChord(scale, degree);
    std::vector<Choice> result {
        {"Third above", degreeChord(scale, (degree - 1 + 2) % 7 + 1)},
        {"Third below", degreeChord(scale, (degree - 1 + 5) % 7 + 1)}
    };
    const bool majorThird = steps(scale)[2] == 4;
    const auto borrowed = degreeChord({scale.tonic, majorThird ? Mode::NaturalMinor : Mode::Major}, degree);
    if (source.pitches != borrowed.pitches) result.push_back({"Parallel mode", borrowed});
    const auto seventh = degreeChord(scale, degree, Stack::Seventh);
    if (seventh.pitches[1] - source.root == 4 && seventh.pitches[2] - source.root == 7 &&
        seventh.pitches[3] - source.root == 10)
        result.push_back({"Tritone substitute", makeChord(source.root + 6, {0,4,7,10}, "7", noteName(source.root + 6))});
    return result;
}

std::vector<Choice> voicings(const Chord& chord, VoicingFamily family) {
    validate(chord);
    const auto closed = closePosition(chord);
    std::vector<Choice> result;
    const auto includes = [family](VoicingFamily f) { return family == VoicingFamily::All || family == f; };
    if (includes(VoicingFamily::Closed)) addVoicing(result, chord, "Closed", closed);
    if (includes(VoicingFamily::Inversions)) addInversions(result, chord, closed);
    if (includes(VoicingFamily::Open) && closed.size() >= 3) {
        addVoicing(result, chord, "Open 1", spread(closed, 1));
        addVoicing(result, chord, "Open 2", spread(closed, 2));
    }
    if (includes(VoicingFamily::Drop)) addDrops(result, chord, closed);
    if (includes(VoicingFamily::Guitar)) addGuitar(result, chord, closed);
    return result;
}

Chord dynamicVoicing(const Chord& chord, const std::vector<int>& previous) {
    validate(chord);
    requireOrderedMidi(previous);
    if (previous.empty()) return chord;
    const bool lockBass = hasSlashBass(chord);
    if (classCounts(chord.pitches) == classCounts(previous) &&
        (!lockBass || previous.front() % 12 == chord.pitches.front() % 12))
        return {chord.name, chord.root, previous};

    const auto targets = voiceTargets(previous, chord.pitches.size());
    NearestLayout nearest {targets, chord.pitches, motion(chord.pitches, 0, targets)};
    nearest.considerRegisters(chord.pitches);
    const auto closed = closePosition(chord);
    if (closed.size() == chord.pitches.size()) nearest.considerInversions(closed, lockBass);
    return {chord.name, chord.root, std::move(nearest.best)};
}

std::vector<int> foreignNotes(Scale scale, const Chord& chord) {
    validate(chord);
    int members = 0;
    for (int step : steps(scale)) members |= pitchBit(scale.tonic + step);
    Notes result;
    for (int pitch : chord.pitches) if (!(members & pitchBit(pitch))) result.push_back(pitch);
    return result;
}

bool inScale(Scale scale, const Chord& chord) { return foreignNotes(scale, chord).empty(); }

} // namespace crest::harmony
