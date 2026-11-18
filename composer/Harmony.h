#pragma once

#include <array>
#include <string>
#include <vector>

namespace crest::harmony {

enum class Mode { Major, Dorian, Phrygian, Lydian, Mixolydian, NaturalMinor, Locrian,
                  HarmonicMinor, Ionian = Major, Aeolian = NaturalMinor };
struct Scale { int tonic = 57; Mode mode = Mode::NaturalMinor; }; // absolute MIDI tonic (A3)
enum class Stack { Triad, Seventh };
struct Chord {
    std::string name;
    int root = 0;             // harmonic root as an absolute MIDI note, not necessarily the bass
    std::vector<int> pitches; // sounding MIDI notes, low to high
};

std::string noteName(int midi); // pitch class only
std::array<int, 7> scaleNotes(Scale scale);
Chord degreeChord(Scale scale, int degree, Stack stack = Stack::Triad); // degrees 1..7
std::vector<Chord> degreeChords(Scale scale, Stack stack = Stack::Triad);

struct Progression { std::string name; std::vector<int> degrees; };
const std::vector<Progression>& commonProgressions();
std::vector<Chord> realize(Scale scale, const Progression& progression, Stack stack = Stack::Triad);

enum class VariationFamily { All, Triads, Suspended, Extensions };
std::vector<Chord> variations(const Chord& chord, VariationFamily family = VariationFamily::All);
struct Choice { std::string label; Chord chord; };
std::vector<Choice> substitutions(Scale scale, int degree);

enum class VoicingFamily { All, Closed, Inversions, Open, Drop, Guitar };
std::vector<Choice> voicings(const Chord& chord, VoicingFamily family = VoicingFamily::All);
// Choose an inversion/register near the previous ordered MIDI pitches; no previous = unchanged.
Chord dynamicVoicing(const Chord& chord, const std::vector<int>& previous);

// Tests sounding notes, not the chord symbol; preserves absolute octaves of foreign notes.
std::vector<int> foreignNotes(Scale scale, const Chord& chord);
bool inScale(Scale scale, const Chord& chord);

} // namespace crest::harmony
