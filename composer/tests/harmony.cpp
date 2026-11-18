#include "../Harmony.h"

#include <algorithm>
#include <iostream>
#include <set>
#include <stdexcept>

using namespace crest::harmony;

namespace {
using Notes = std::vector<int>;
constexpr Scale am {57, Mode::NaturalMinor};
constexpr Scale c {60, Mode::Major};

void check(bool ok, const char* failure) {
    if (!ok) throw std::runtime_error(failure);
}

template<class Exception, class F> void expectFailure(F operation) {
    try { operation(); } catch (const Exception&) { return; }
    throw std::runtime_error("expected rejected input");
}

std::vector<std::string> names(const std::vector<Chord>& chords) {
    std::vector<std::string> result;
    for (const auto& chord : chords) result.push_back(chord.name);
    return result;
}

Chord named(const std::vector<Chord>& chords, const std::string& name) {
    for (const auto& chord : chords) if (chord.name == name) return chord;
    throw std::runtime_error("missing chord: " + name);
}

Chord choice(const std::vector<Choice>& choices, const std::string& label) {
    for (const auto& item : choices) if (item.label == label) return item.chord;
    throw std::runtime_error("missing choice: " + label);
}

std::set<int> classes(const Chord& chord) {
    std::set<int> result;
    for (int n : chord.pitches) result.insert(n % 12);
    return result;
}

void verifyStacks(Scale scale) {
    const auto degrees = degreeChords(scale, Stack::Seventh);
    check(degrees.size() == 7, "incomplete degree row");
    for (const auto& chord : degrees) {
        check(classes(chord).size() == 4 && chord.pitches.size() == 4, "invalid seventh");
        check(chord.root == chord.pitches.front() && inScale(scale, chord), "diatonic stack");
    }
}

void verifyMode(Mode mode) {
    for (int tonic = 48; tonic < 60; ++tonic) verifyStacks({tonic, mode});
}

void scalesAndDegrees() {
    using Names = std::vector<std::string>;
    check(names(degreeChords(am)) == Names {"Am","Bdim","C","Dm","Em","F","G"}, "A minor pad row");
    check(degreeChord(am, 1).pitches == Notes {57,60,64}, "A minor tonic register");
    check(degreeChord(am, 7, Stack::Seventh).pitches == Notes {67,71,74,77}, "stack crosses octave");
    check(names(degreeChords(c, Stack::Seventh)) == Names {"Cmaj7","Dm7","Em7","Fmaj7","G7","Am7","Bm7b5"},
          "major seventh qualities");
    const Scale ah {57, Mode::HarmonicMinor};
    check(names(degreeChords(ah, Stack::Seventh)) == Names {"Am(maj7)","Bm7b5","Caug(maj7)","Dm7","E7","Fmaj7","G#dim7"},
          "harmonic minor raises scale degree seven, including its spelling");
    check(named(variations(degreeChord(ah, 7)), "G#maj").root == 68, "preserve scale-degree spelling");
    check(scaleNotes({62,Mode::Dorian}) == std::array<int,7> {62,64,65,67,69,71,72}, "D Dorian");
    check(scaleNotes({64,Mode::Phrygian}) == std::array<int,7> {64,65,67,69,71,72,74}, "E Phrygian");
    check(scaleNotes({65,Mode::Lydian}) == std::array<int,7> {65,67,69,71,72,74,76}, "F Lydian");
    check(scaleNotes({67,Mode::Mixolydian}) == std::array<int,7> {67,69,71,72,74,76,77}, "G Mixolydian");
    check(scaleNotes({71,Mode::Locrian}) == std::array<int,7> {71,72,74,76,77,79,81}, "B Locrian");
    for (auto mode : {Mode::Ionian, Mode::Dorian, Mode::Phrygian, Mode::Lydian, Mode::Mixolydian,
                      Mode::Aeolian, Mode::Locrian, Mode::HarmonicMinor}) verifyMode(mode);
}

void progressionsAndSubstitutions() {
    const auto& bank = commonProgressions();
    const auto loop = std::find_if(bank.begin(), bank.end(), [](const Progression& p) {
        return p.degrees == std::vector<int>{1,6,3,7};
    });
    check(loop != bank.end(), "minor loop missing");
    check(names(realize(am, *loop)) == std::vector<std::string>{"Am","F","C","G"}, "minor loop order");
    check(names(realize(c, {"cadence", {2,5,1}}, Stack::Seventh)) == std::vector<std::string>{"Dm7","G7","Cmaj7"},
          "realize in a different key and stack");
    const auto replacesAm = substitutions(am, 1);
    check(choice(replacesAm, "Third above").name == "C", "relative major");
    check(choice(replacesAm, "Third below").name == "F", "relative submediant");
    check(foreignNotes(am, choice(replacesAm, "Parallel mode")) == Notes{61}, "borrowed C#");
    check(choice(substitutions(c, 5), "Tritone substitute").name == "Db7", "G7 to Db7");
}

void variantsAndScaleFit() {
    const auto tonic = degreeChord(am, 1);
    const auto options = variations(tonic);
    check(options.front().name == "Am", "selected quality first");
    check(named(options,"Amaj").pitches == Notes {57,61,64}, "parallel major variation");
    check(named(options,"Asus2").pitches == Notes {57,59,64}, "sus2");
    check(named(options,"Asus4").pitches == Notes {57,62,64}, "sus4");
    check(named(options,"Am7").pitches == Notes {57,60,64,67}, "minor seventh");
    check(named(options,"Am9").pitches == Notes {57,60,64,67,71}, "ninth retains upper register");
    check(names(variations(tonic, VariationFamily::Suspended)) == std::vector<std::string>{"Asus2","Asus4"}, "suspension filter");
    check(inScale(am,named(options,"Am9")) && !inScale(am,named(options,"Amaj")), "major is chromatic, ninth diatonic");
    const Chord misleadingName {"Am", 57, {49,55,61,64,68}};
    check(foreignNotes(am,misleadingName) == Notes{49,61,68}, "all actual foreign octaves, root and label ignored");
    check(inScale(am,{"C#",61,{57,60,64}}), "absent root is not a sounding tone");
}

void voicingFamilies() {
    const auto tonic = degreeChord(am, 1);
    const auto options = variations(tonic);
    const auto seventh = named(options, "Am7");
    const auto inv = voicings(tonic,VoicingFamily::Inversions);
    check(inv.size() == 2 && inv[0].chord.pitches == Notes{60,64,69} && inv[1].chord.pitches == Notes{64,69,72},
          "two triad inversions");
    check(choice(voicings(inv[1].chord,VoicingFamily::Closed), "Closed").pitches == tonic.pitches, "voicing edits do not accumulate");
    const auto open = voicings(tonic,VoicingFamily::Open);
    check(open.size() == 2 && choice(open,"Open 1").pitches == Notes{57,64,72} &&
          choice(open,"Open 2").pitches == Notes{57,60,76}, "distinct root-bass spreads");
    const auto drops = voicings(seventh, VoicingFamily::Drop);
    check(choice(drops,"Drop 2").pitches == Notes{52,57,60,67}, "drop second-highest");
    check(choice(drops,"Drop 3").pitches == Notes{48,57,64,67}, "drop third-highest");
    const auto guitar = voicings(tonic, VoicingFamily::Guitar);
    check(choice(guitar,"Guitar x-0-2-2-1-0").pitches == Notes {45,52,57,60,64}, "standard open Am guitar grip");
    const auto major = named(options, "Amaj");
    for (const auto& item : voicings(major)) {
        check(item.chord.name == "Amaj" && item.chord.root == 57, "voicing preserves symbol and root");
        check(classes(item.chord) == classes(major) && !inScale(am, item.chord), "voicing keeps quality and fit");
        check(std::is_sorted(item.chord.pitches.begin(), item.chord.pitches.end()), "notes always ordered");
    }
    check(variations(inv[1].chord).front().pitches == tonic.pitches, "variation independent of inversion");
}

void extendedPalette() {
    const auto colors = variations(degreeChord(am, 1), VariationFamily::Extensions);
    check(named(colors,"Am(maj9)").pitches == Notes{57,60,64,68,71}, "minor major ninth uses G#");
    check(named(colors,"Am11(b5)").pitches == Notes{57,60,63,67,71,74}, "flat fifth in eleventh");
    check(foreignNotes(am, named(colors,"Am7 b9 b13")) == Notes{70}, "Bb outside natural minor; F natural fits");
    check(named(colors,"Am6 11").pitches == Notes{57,60,64,66,74}, "minor six add eleven");
    check(foreignNotes(am, named(colors,"Am13(b5)")) == Notes{63,78}, "altered fifth and major thirteenth");
    check(named(colors,"Am6 9").pitches == Notes{57,60,64,66,71}, "six-nine without b7");
    check(named(colors,"Am13").pitches == Notes{57,60,64,67,71,74,78}, "complete minor thirteenth stack");
    const auto slash = named(colors, "Fadd9/A");
    check(slash.root == 53 && slash.pitches == Notes{57,60,65,67}, "F harmony over A bass");
    for (const auto& layout : voicings(slash)) {
        check(layout.chord.pitches.front() % 12 == 9 && classes(layout.chord) == classes(slash), "keep slash bass in layouts");
    }
    check(named(variations(degreeChord(c,1)),"Abadd9/C").pitches == Notes{60,63,68,70}, "transpose same-bass colour");
}

void nearestVoicing() {
    const auto triad = degreeChord(c, 1);
    check(dynamicVoicing(triad,{}).pitches == triad.pitches, "empty previous voicing");
    const auto smooth = dynamicVoicing(triad, {55,59,62});
    check(smooth.name == "C" && smooth.root == 60 && smooth.pitches == Notes{55,60,64}, "keep G bass, move upper voices by 1 and 2");
    check(dynamicVoicing(triad,{79,83,86}).pitches == Notes{79,84,88}, "follow previous register");
    const auto wide = Notes{36,55,76};
    check(dynamicVoicing(triad,wide).pitches == wide, "zero movement into matching open voicing");
    const auto seventh = degreeChord(c,1,Stack::Seventh);
    const auto expanded = dynamicVoicing(seventh, {35,40,43});
    check(expanded.pitches.size() == 4 && classes(expanded) == classes(seventh) && expanded.pitches.back() < 50,
          "unequal number of voices still follows the previous chord");
    const auto slash = named(variations(degreeChord(am,1)), "Fadd9/A");
    check(dynamicVoicing(slash,{41,57,60,67}).pitches.front() % 12 == 9, "dynamic honours specified slash bass");
    check(dynamicVoicing({"C",0,{0,4,7}},{116,125,127}).pitches == Notes{120,124,127}, "highest legal C major triad");
    expectFailure<std::invalid_argument>([&]{ dynamicVoicing(triad,{64,57}); });
}

void boundaries() {
    expectFailure<std::out_of_range>([]{ degreeChord(c, 0); });
    expectFailure<std::out_of_range>([]{ realize(c, {"bad",{1,8}}); });
    expectFailure<std::out_of_range>([]{ scaleNotes({127,Mode::Major}); });
    expectFailure<std::out_of_range>([]{ degreeChord({120,Mode::Major}, 6); });
    expectFailure<std::invalid_argument>([]{ voicings({"empty",57,{}}); });
    expectFailure<std::invalid_argument>([]{ variations({"unordered",57,{64,57,60}}); });
    expectFailure<std::out_of_range>([]{ foreignNotes(am,{"over",57,{57,129}}); });
    check(voicings({"C",0,{0,4,7}}, VoicingFamily::Drop).empty(), "omit unrepresentable voicing");
    check(voicings({"C",120,{115,120,124}}, VoicingFamily::Inversions).empty(), "no clipped MIDI inversion");
}

} // namespace

int main() {
    try {
        scalesAndDegrees();
        progressionsAndSubstitutions();
        variantsAndScaleFit();
        voicingFamilies();
        extendedPalette();
        nearestVoicing();
        boundaries();
        std::cout << "Harmony tests passed\n";
        return 0;
    } catch (const std::exception& error) {
        std::cerr << "Harmony test failed: " << error.what() << '\n';
        return 1;
    }
}
