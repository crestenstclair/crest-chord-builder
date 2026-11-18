#include "Performance.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <deque>
#include <map>
#include <optional>
#include <stdexcept>
#include <string_view>
#include <tuple>
#include <utility>

namespace crest::composer {
namespace {

using Bytes = std::vector<std::uint8_t>;
constexpr int maxSketchTicks = 16384 * performancePPQ;
constexpr int maxSourceTick = 0x0fffffff; // maximum four-byte SMF delta
constexpr std::size_t maxRenderNotes = 262144, maxTemplateNotes = 65536;

void require(bool condition, const char* message) {
    if (!condition) throw std::invalid_argument(message);
}

void checkClock(double bpm, int beatsPerBar) {
    require(std::isfinite(bpm) && bpm >= 4 && bpm <= 1000, "Tempo must be 4 to 1000 BPM");
    require(beatsPerBar == 3 || beatsPerBar == 4, "Choose 3/4 or 4/4");
}

enum class VoicingOrder { LowToHigh, AsPlayed };

std::vector<int> checkedVoicing(const std::vector<int>& pitches, VoicingOrder order) {
    require(pitches.size() <= 128, "Too many voices in a slot");
    for (int p : pitches) require(p >= 0 && p < 128, "Pitches must be MIDI numbers");
    if (order == VoicingOrder::AsPlayed) return pitches;
    auto voices = pitches;
    std::sort(voices.begin(), voices.end());
    voices.erase(std::unique(voices.begin(), voices.end()), voices.end());
    return voices;
}

struct SlotWindow {
    const std::vector<int>& voices;
    int start, end;
    std::vector<PerformanceNote>& notes;

    void play(int startTick, int endTick, int pitch, int velocity) const {
        if (startTick >= end) return;
        require(notes.size() < maxRenderNotes, "Performance exceeds the rendered note limit");
        notes.push_back({startTick, std::clamp(endTick, startTick + 1, end), pitch, velocity});
    }
};

bool byOnsetAndPitch(const PerformanceNote& a, const PerformanceNote& b) {
    return std::tie(a.startTick, a.pitch) < std::tie(b.startTick, b.pitch);
}

// Several mapped fingers can land on the same key. Simultaneous attacks fuse;
// a later attack releases the previous voice first, just as a keyboard would.
void reconcileKeys(std::vector<PerformanceNote>& notes) {
    std::sort(notes.begin(), notes.end(), byOnsetAndPitch);
    std::array<int, 128> last{};
    last.fill(-1);
    std::size_t count = 0;
    for (const auto note : notes) {
        int& index = last[note.pitch];
        if (index >= 0) {
            auto& prior = notes[static_cast<std::size_t>(index)];
            if (prior.startTick == note.startTick) {
                prior.endTick = std::max(prior.endTick, note.endTick);
                prior.velocity = std::max(prior.velocity, note.velocity);
                continue;
            }
            prior.endTick = std::min(prior.endTick, note.startTick);
        }
        index = static_cast<int>(count);
        notes[count++] = note;
    }
    notes.resize(count);
}

template <typename PlaySlot>
PerformanceRender renderSlots(const std::vector<PerformanceSlot>& slots, double bpm,
                              int beatsPerBar, VoicingOrder order, PlaySlot playSlot) {
    checkClock(bpm, beatsPerBar);
    PerformanceRender result{{}, 0, bpm, beatsPerBar, {}};
    double exactEnd = 0;
    for (const auto& slot : slots) {
        require(std::isfinite(slot.beats) && slot.beats > 0, "Slot length must be positive and finite");
        exactEnd += slot.beats * performancePPQ;
        require(exactEnd <= maxSketchTicks, "Sketch exceeds 16384 quarter notes");
        const int end = static_cast<int>(std::lround(exactEnd));
        require(end > result.totalTicks, "Slot length is shorter than the MIDI resolution");
        result.slotStarts.push_back(result.totalTicks);
        const auto voices = checkedVoicing(slot.pitches, order);
        if (!voices.empty()) playSlot(SlotWindow{voices, result.totalTicks, end, result.notes});
        result.totalTicks = end;
    }
    reconcileKeys(result.notes);
    return result;
}

enum Voice { bass, lower, middle, penultimate, top, chord, upperPair, edges, downstroke, upstroke };
struct Gesture {
    double beat, gate; // quarter notes from local downbeat / held for
    Voice voice;
    int velocity;
};
using Score = std::vector<Gesture>;
using ScoreForBar = Score (*)(int meter, bool answer);

// Each score is a single local measure. The end-relative pickups below fall
// on beat 3 in a waltz and beat 4 in common time; they are never time-stretched.
Score felt(int meter, bool answer) {
    return {{0, meter - 0.35, bass, 79}, {0.16, 0.85, middle, 61},
            {0.37, meter - 1.0, top, answer ? 74 : 69}, {meter - 0.72, 0.45, lower, 60}};
}
Score bell(int meter, bool answer) {
    return {{0, 0.72, chord, 103}, {1.5, 0.19, upperPair, 67},
            {meter - 1.0, 0.64, edges, answer ? 97 : 92}, {meter - 0.25, 0.12, middle, 54}};
}
Score switchback(int meter, bool answer) {
    Score s;
    constexpr Voice path[] = {bass, lower, top, middle, lower, penultimate, top, middle};
    constexpr int accents[] = {91, 62, 76, 67, 84, 65, 79, 57};
    for (int i = 0; i < meter * 2; ++i) {
        const int step = answer && i > 0 ? 8 - i : i;
        s.push_back({i * 0.5 + (i % 2 ? 0.035 : 0.0), i % 2 ? 0.34 : 0.46, path[step], accents[i]});
    }
    return s;
}
Score rain(int meter, bool answer) {
    Score s;
    constexpr Voice descent[] = {top, middle, lower, penultimate, middle, bass};
    for (int i = 0; i < meter * 3; ++i)
        s.push_back({i / 3.0, i % 3 == 2 ? 0.24 : 0.61, descent[(i + (answer ? 3 : 0)) % 6],
                     87 - (i % 3) * 9 - i / 3});
    return s;
}
Score shutters(int meter, bool answer) {
    return {{0, 0.23, bass, 102}, {0.75, 0.14, upperPair, 75}, {1.5, 0.31, chord, 93},
            {meter - 0.75, 0.15, upperPair, 69}, {meter - 0.5, 0.21, edges, answer ? 99 : 85}};
}
Score afterbeat(int meter, bool) {
    Score s{{0, 0.71, bass, 92}};
    for (int beat = 0; beat < meter; ++beat)
        s.push_back({beat + 0.58, beat == meter - 1 ? 0.12 : 0.27, chord, beat % 2 ? 88 : 72});
    return s;
}
Score keel(int meter, bool answer) {
    return {{0, 1.36, bass, 101}, {1.5, 0.29, bass, 72},
            {meter - 1.0, 0.62, lower, 87}, {meter - 0.25, 0.17, answer ? lower : bass, 62}};
}
Score skyline(int meter, bool answer) {
    if (answer) return {{0, 0.86, penultimate, 81}, {1, 0.43, middle, 75},
                        {1.5, meter - 1.83, top, 93}};
    return {{0.5, 0.45, middle, 72}, {1, 0.73, penultimate, 84},
            {meter - 1.0, 0.47, top, 96}, {meter - 0.5, 0.32, penultimate, 76}};
}
Score dialogue(int meter, bool answer) {
    if (answer) return {{0, 0.75, top, 89}, {0.75, 0.19, penultimate, 73},
                        {1, meter - 1.38, edges, 85}};
    return {{0, meter - 0.64, bass, 81}, {0.5, 0.27, lower, 62}, {0.83, 0.48, middle, 75},
            {meter - 1.0, 0.71, top, 92}, {meter - 0.25, 0.17, penultimate, 66}};
}
Score reedBrush(int meter, bool answer) {
    return {{0, 1.31, downstroke, 91}, {1.5, 0.33, upstroke, 72},
            {meter - 1.0, 0.76, downstroke, answer ? 98 : 86},
            {meter - 0.5, 0.29, upstroke, 66}};
}
Score wideBrush(int meter, bool) {
    return {{0, 0.78, bass, 94}, {0.67, meter - 1.04, upstroke, 76},
            {meter - 0.67, 0.51, downstroke, 84}};
}

struct Preset { PerformanceInfo info; ScoreForBar score; };
const std::vector<Preset>& presets() {
    static const std::vector<Preset> list{
        {{"block", "Chords", "Block chords"}, nullptr},
        {{"slow-felt", "Slow articulations", "Felt lantern"}, felt},
        {{"accent-bell", "Accents", "Bell and echo"}, bell},
        {{"arp-switchback", "Arpeggios", "Switchback eights"}, switchback},
        {{"arp-rain", "Arpeggios", "Triplet rain"}, rain},
        {{"rhythm-shutters", "Rhythms", "Shutter cuts"}, shutters},
        {{"rhythm-afterbeat", "Rhythms", "Late afterbeat"}, afterbeat},
        {{"bass-keel", "Basslines", "Keel steps"}, keel},
        {{"melody-skyline", "Melodies", "Skyline reply"}, skyline},
        {{"phrase-dialogue", "Phrases", "Window dialogue"}, dialogue},
        {{"strum-reed", "Strums", "Reed brush"}, reedBrush},
        {{"strum-wide", "Strums", "Thumb and fan"}, wideBrush}};
    return list;
}

int beatTicks(double beat) { return static_cast<int>(std::lround(beat * performancePPQ)); }

bool usesVoice(Voice voice, int index, int count) {
    switch (voice) {
        case bass: return index == 0;
        case lower: return index == std::min(1, count - 1);
        case middle: return index == (count - 1) / 2;
        case penultimate: return index == std::max(0, count - 2);
        case top: return index == count - 1;
        case upperPair: return index >= count - 2;
        case edges: return index == 0 || index == count - 1;
        default: return true;
    }
}

void playGesture(const SlotWindow& slot, int downbeat, int barEnd, const Gesture& g) {
    const int count = static_cast<int>(slot.voices.size());
    const bool brushed = g.voice == downstroke || g.voice == upstroke;
    // Compact voicings speak string-by-string. Wide ones still fit the stroke.
    const int spread = std::min(68, (count - 1) * (g.voice == upstroke ? 9 : 15));
    const int onset = downbeat + beatTicks(g.beat);
    for (int i = 0; i < count; ++i) {
        if (!usesVoice(g.voice, i, count)) continue;
        const int finger = g.voice == upstroke ? count - 1 - i : i;
        const int delay = brushed ? spread * finger / std::max(1, count - 1) : 0;
        const int attenuation = brushed ? std::min(16, finger * 3) : 0;
        slot.play(onset + delay, std::min(barEnd, onset + beatTicks(g.gate)),
                  slot.voices[i], g.velocity - attenuation);
    }
}

void playPreset(const SlotWindow& slot, ScoreForBar score, int meter) {
    if (!score) {
        for (int pitch : slot.voices) slot.play(slot.start, slot.end, pitch, 88);
        return;
    }
    const int barTicks = meter * performancePPQ;
    const Score call = score(meter, false), reply = score(meter, true);
    auto playBar = [&](int tick, const Score& bar) {
        for (const auto& gesture : bar) playGesture(slot, tick, tick + barTicks, gesture);
    };
    for (int tick = slot.start; tick < slot.end; tick += barTicks)
        playBar(tick, (tick / barTicks) % 2 == 0 ? call : reply);
}

void checkSelector(const PerformanceTemplate& source) {
    if (source.mapping == TemplateMapping::Ranked) {
        require(source.sourcePitches.empty() && source.octaveDiff == -1, "Ranked MIDI cannot carry indexed mapping fields");
        return;
    }
    require(source.mapping == TemplateMapping::Performances || source.mapping == TemplateMapping::Rhythms,
            "Unknown template selector");
    require(source.octaveDiff >= -128 && source.octaveDiff <= 127, "Invalid selector octave difference");
    require(source.pitchCount <= 127 && source.sourcePitches.size() == static_cast<std::size_t>(source.pitchCount),
            "Invalid selector palette length");
    std::array<bool, 128> seen{};
    for (int p : source.sourcePitches) {
        require(p >= 0 && p < 128 && !seen[p], "Expected distinct MIDI keys in the selector palette");
        seen[p] = true;
    }
}

void checkTemplate(const PerformanceTemplate& source) {
    require(source.ticksPerQuarter > 0 && source.ticksPerQuarter <= 32767, "Invalid source PPQ");
    require(source.loopTicks > 0 && source.loopTicks <= maxSourceTick, "Invalid MIDI template length");
    require(source.pitchCount >= 1 && source.pitchCount <= 128, "Invalid template pitch count");
    checkSelector(source);
    require(!source.notes.empty() && source.notes.size() <= maxTemplateNotes, "Invalid template note count");
    for (const auto& note : source.notes) {
        bool validGate = note.endTick > note.startTick || (source.mapping != TemplateMapping::Ranked && note.endTick == note.startTick);
        require(note.startTick >= 0 && validGate && note.endTick <= source.loopTicks,
                "Invalid MIDI template note range");
        require(note.pitchRank >= 0 && note.pitchRank < source.pitchCount && note.velocity > 0 && note.velocity < 128,
                "Invalid MIDI template note");
    }
}

int mappedVoice(int rank, int pitchCount, int voiceCount) {
    if (pitchCount == 1) return 0;
    return ((rank * (voiceCount - 1)) * 2 + pitchCount - 1) / (2 * (pitchCount - 1));
}

// Entry i lists every destination for raw source index i. Rhythm extension
// can clone a hit; dropping a pitch leaves that entry empty without shifting
// the following indices. The lookup is built once per slot, never per tick.
using Targets = std::vector<std::vector<int>>;

void addShiftedPitch(std::vector<int>& targets, int pitch, int octaveDiff) {
    const auto shifted = static_cast<std::uint8_t>(pitch + 12 * (octaveDiff + 1));
    // The selector stores a byte. Crest's MIDI boundary cannot emit 128..255.
    if (shifted < 128) targets.push_back(shifted);
}

using OctaveGroups = std::vector<std::vector<int>>;

OctaveGroups sourceOctaves(const std::vector<int>& palette) {
    std::array<int, 12> byClass{};
    byClass.fill(-1);
    OctaveGroups groups;
    for (int pitch : palette) {
        int& group = byClass[pitch % 12];
        if (group < 0) {
            group = static_cast<int>(groups.size());
            groups.emplace_back();
        }
        groups[group].push_back((pitch - palette.front()) / 12); // signed truncation, also for unsorted sources
    }
    return groups;
}

void absorbOccurrences(std::vector<int>& octaves, std::size_t count) {
    for (std::size_t i = 0; i < count; ++i) {
        if (octaves.back() <= 7) octaves.push_back(octaves.back() + 1);
        else if (octaves.front() >= -1) octaves.push_back(octaves.front() - 1);
    }
}

void fitGroups(OctaveGroups& groups, std::size_t voiceCount) {
    if (groups.size() <= voiceCount) return;
    if (voiceCount > 2) {
        for (std::size_t j = voiceCount; j < groups.size(); ++j)
            absorbOccurrences(groups[j % voiceCount], groups[j].size());
    }
    groups.resize(voiceCount);
}

std::vector<int> classesAsPlayed(const std::vector<int>& chord) {
    std::vector<int> classes;
    std::array<bool,12> seen{};
    for (int p : chord) {
        if (!seen[p % 12]) classes.push_back(p % 12);
        seen[p % 12] = true;
    }
    return classes;
}

void appendOctaves(std::vector<int>& generated, int basePitch, const std::vector<int>& octaves) {
    for (int octave : octaves) generated.push_back(static_cast<std::uint8_t>(basePitch + 12 * octave));
}

Targets performanceTargets(const PerformanceTemplate& source, const std::vector<int>& chord) {
    const auto classes = classesAsPlayed(chord);
    auto groups = sourceOctaves(source.sourcePitches);
    fitGroups(groups, classes.size());
    std::vector<int> generated;
    const int base = chord.front() / 12;
    int wrap = 0;
    for (std::size_t i = 0; i < groups.size(); ++i) {
        if (classes[i] < classes.front()) wrap = 1; // latched even if the next class is higher
        appendOctaves(generated, 12 * (base + wrap) + classes[i], groups[i]);
    }
    std::sort(generated.begin(), generated.end());
    Targets targets(source.pitchCount);
    for (std::size_t i = 0; i < generated.size(); ++i) addShiftedPitch(targets[i], generated[i], source.octaveDiff);
    return targets;
}

struct RhythmVoice { int sourcePitch, originalIndex; };

std::vector<RhythmVoice> rhythmVoices(const std::vector<int>& palette, std::size_t width) {
    std::array<bool,128> present{};
    std::vector<RhythmVoice> voices;
    for (int pitch : palette) {
        present[pitch] = true;
        voices.push_back({pitch, static_cast<int>(voices.size())});
    }
    if (voices.size() >= width) return voices; // ordinary lookup uses exact incoming order
    for (std::size_t i = 0; i < voices.size() && voices.size() < width; ++i) {
        const int next = voices[i].sourcePitch + 12;
        if (next >= 128 || present[next]) continue;
        present[next] = true;
        voices.push_back({next, voices[i].originalIndex}); // appended voices may themselves be extended
    }
    std::sort(voices.begin(), voices.end(), [](auto a, auto b) { return a.sourcePitch < b.sourcePitch; });
    return voices;
}

Targets pitchTargets(const PerformanceTemplate& source, const std::vector<int>& chord) {
    if (source.mapping == TemplateMapping::Performances) return performanceTargets(source, chord);
    Targets targets(source.pitchCount);
    if (source.mapping == TemplateMapping::Rhythms) {
        const auto voices = rhythmVoices(source.sourcePitches, chord.size());
        for (std::size_t i = 0; i < std::min(voices.size(), chord.size()); ++i)
            addShiftedPitch(targets[voices[i].originalIndex], chord[i], source.octaveDiff);
    } else {
        for (int i = 0; i < source.pitchCount; ++i)
            targets[i].push_back(chord[mappedVoice(i, source.pitchCount, static_cast<int>(chord.size()))]);
    }
    return targets;
}

std::int64_t sourceToRenderTick(std::int64_t tick, int sourcePPQ) {
    return (tick * performancePPQ + sourcePPQ / 2) / sourcePPQ;
}

struct MappedHit { const TemplateNote& note; const std::vector<int>& pitches; };

std::vector<MappedHit> audibleHits(const PerformanceTemplate& source, const Targets& targets, int duration) {
    std::vector<MappedHit> hits;
    for (const auto& n : source.notes) {
        if (sourceToRenderTick(n.startTick, source.ticksPerQuarter) >= duration) break;
        if (n.endTick != n.startTick && !targets[n.pitchRank].empty()) hits.push_back({n, targets[n.pitchRank]});
    }
    return hits;
}

void strikeTargets(const SlotWindow& slot, const MappedHit& hit, int start, int end) {
    for (int pitch : hit.pitches) slot.play(start, end, pitch, hit.note.velocity);
}

void playLoop(const SlotWindow& slot, const std::vector<MappedHit>& hits, int ppq, int origin, std::int64_t sourceStart) {
    for (const auto& hit : hits) {
        const auto start = origin + sourceToRenderTick(sourceStart + hit.note.startTick, ppq);
        if (start >= slot.end) break;
        const auto end = origin + sourceToRenderTick(sourceStart + hit.note.endTick, ppq);
        if (start < slot.start && end <= slot.start) continue;
        strikeTargets(slot, hit, static_cast<int>(std::max<std::int64_t>(start, slot.start)),
                      static_cast<int>(std::min<std::int64_t>(end, slot.end)));
    }
}

void playTemplate(const SlotWindow& slot, const PerformanceTemplate& source) {
    // A Scaler Performance belongs to the sketch lane. Keep its place in the phrase through
    // chord changes and rests. Plain imported MIDI and rhythms retain their slot retrigger.
    const int origin = source.mapping == TemplateMapping::Performances ? 0 : slot.start;
    const int duration = slot.end - origin;
    const auto targets = pitchTargets(source, slot.voices);
    const auto hits = audibleHits(source, targets, duration);
    if (hits.empty()) return;
    const auto elapsed = std::int64_t(slot.start - origin) * source.ticksPerQuarter / performancePPQ;
    for (auto start = elapsed / source.loopTicks * source.loopTicks;
         sourceToRenderTick(start, source.ticksPerQuarter) < duration; start += source.loopTicks)
        playLoop(slot, hits, source.ticksPerQuarter, origin, start);
}

} // namespace

const std::vector<PerformanceInfo>& performanceCatalog() {
    static const auto catalog = [] {
        std::vector<PerformanceInfo> result;
        for (const auto& preset : presets()) result.push_back(preset.info);
        return result;
    }();
    return catalog;
}

PerformanceRender renderPerformance(const std::vector<PerformanceSlot>& slots,
                                    const std::string& performanceId, double bpm, int beatsPerBar) {
    const auto& list = presets();
    auto entry = std::find_if(list.begin(), list.end(), [&](const auto& p) { return p.info.id == performanceId; });
    require(entry != list.end(), "Unknown performance ID");
    return renderSlots(slots, bpm, beatsPerBar, VoicingOrder::LowToHigh,
                       [&](const SlotWindow& slot) { playPreset(slot, entry->score, beatsPerBar); });
}

PerformanceRender renderPerformance(const std::vector<PerformanceSlot>& slots,
                                    const PerformanceTemplate& source, double bpm, int beatsPerBar) {
    checkTemplate(source);
    const auto order = source.mapping == TemplateMapping::Ranked ? VoicingOrder::LowToHigh : VoicingOrder::AsPlayed;
    const auto byStart = [](const auto& a, const auto& b) { return a.startTick < b.startTick; };
    if (std::is_sorted(source.notes.begin(), source.notes.end(), byStart))
        return renderSlots(slots, bpm, beatsPerBar, order, [&](const SlotWindow& slot) { playTemplate(slot, source); });
    auto sorted = source;
    std::sort(sorted.notes.begin(), sorted.notes.end(), byStart);
    return renderSlots(slots, bpm, beatsPerBar, order, [&](const SlotWindow& slot) { playTemplate(slot, sorted); });
}

namespace {

void putBigEndian(Bytes& bytes, std::uint32_t value, int width) {
    for (int shift = (width - 1) * 8; shift >= 0; shift -= 8)
        bytes.push_back(static_cast<std::uint8_t>(value >> shift));
}

void putDelta(Bytes& bytes, int ticks) {
    int shift = 0;
    while ((ticks >> shift) > 127) shift += 7;
    for (; shift >= 0; shift -= 7)
        bytes.push_back(static_cast<std::uint8_t>(((ticks >> shift) & 127) | (shift ? 128 : 0)));
}

struct MidiEdge { int tick, velocity, pitch; };

std::vector<MidiEdge> keyEdges(const PerformanceRender& render) {
    require(render.notes.size() <= maxRenderNotes, "Too many render notes");
    std::vector<MidiEdge> edges;
    edges.reserve(render.notes.size() * 2);
    for (const auto& n : render.notes) {
        require(n.startTick >= 0 && n.endTick <= render.totalTicks && n.startTick < n.endTick, "Invalid rendered note range");
        require(n.pitch >= 0 && n.pitch <= 127 && n.velocity > 0 && n.velocity <= 127, "Invalid rendered key or velocity");
        edges.push_back({n.startTick, n.velocity, n.pitch});
        edges.push_back({n.endTick, 0, n.pitch});
    }
    std::sort(edges.begin(), edges.end(), [](auto a, auto b) {
        // All note-offs before all attacks at a boundary, including same-key retriggers.
        return std::make_tuple(a.tick, a.velocity != 0, a.pitch) < std::make_tuple(b.tick, b.velocity != 0, b.pitch);
    });
    return edges;
}

Bytes encodeTrack(const PerformanceRender& render) {
    Bytes data{0, 0xff, 0x51, 3};
    putBigEndian(data, static_cast<std::uint32_t>(std::lround(60000000.0 / render.bpm)), 3);
    data.insert(data.end(), {0, 0xff, 0x58, 4, static_cast<std::uint8_t>(render.beatsPerBar), 2, 24, 8});
    int cursor = 0;
    std::array<bool, 128> active{};
    for (const auto& e : keyEdges(render)) {
        const bool attack = e.velocity != 0;
        require(attack != active[e.pitch], "Overlapping same-key notes cannot be encoded on one channel");
        active[e.pitch] = attack;
        putDelta(data, e.tick - cursor);
        data.push_back(attack ? 0x90 : 0x80);
        data.push_back(static_cast<std::uint8_t>(e.pitch));
        data.push_back(static_cast<std::uint8_t>(e.velocity));
        cursor = e.tick;
    }
    putDelta(data, render.totalTicks - cursor);
    data.insert(data.end(), {0xff, 0x2f, 0});
    return data;
}

// A cursor cannot read beyond its own chunk even if a corrupt delta, SysEx,
// or meta-event claims bytes from the following track.
class Reader {
public:
    explicit Reader(const Bytes& bytes) : bytes_(bytes), limit_(bytes.size()) {}
    bool empty() const { return pos_ == limit_; }
    std::size_t remaining() const { return limit_ - pos_; }
    bool consumePrefix(std::string_view prefix) {
        if (remaining() < prefix.size() || !std::equal(prefix.begin(), prefix.end(), bytes_.begin() + pos_)) return false;
        pos_ += prefix.size();
        return true;
    }
    std::uint8_t byte() {
        require(!empty(), "Truncated MIDI data");
        return bytes_[pos_++];
    }
    int dataByte() {
        int next = byte();
        require(next <= 127, "Invalid MIDI data byte");
        return next;
    }
    std::uint32_t bigEndian(int width) {
        std::uint32_t value = 0;
        for (int i = 0; i < width; ++i) value = (value << 8) | byte();
        return value;
    }
    int variableLength() {
        int value = 0;
        for (int i = 0; i < 4; ++i) {
            int next = byte();
            value = (value << 7) | (next & 127);
            if (!(next & 128)) return value;
        }
        throw std::invalid_argument("Invalid MIDI variable-length quantity");
    }
    void expectTag(const char* tag) {
        for (int i = 0; i < 4; ++i) require(byte() == tag[i], "Expected a standard MIDI file chunk");
    }
    Reader take(std::uint32_t length) {
        require(length <= limit_ - pos_, "Truncated MIDI chunk or payload");
        Reader part = *this;
        pos_ += length;
        part.limit_ = pos_;
        return part;
    }
private:
    const Bytes& bytes_;
    std::size_t pos_ = 0, limit_;
};

// The standard track stays independently playable. The indexed payload is
// authoritative for these families (the fallback track can contain 1-tick
// notes in place of zero gates and does not carry the raw palette order).
void readMapping(Reader payload, int tick, std::optional<PerformanceTemplate>& mapping) {
    if (!payload.consumePrefix("CRESTMAP1")) return; // unrelated sequencer metadata
    require(!mapping && tick == 0, "Expected exactly one CRESTMAP1 event at tick zero");
    PerformanceTemplate result;
    int family = payload.byte();
    require(family == 1 || family == 2, "Unknown CRESTMAP1 family");
    result.mapping = family == 1 ? TemplateMapping::Performances : TemplateMapping::Rhythms;
    int octaveByte = payload.byte();
    result.octaveDiff = octaveByte < 128 ? octaveByte : octaveByte - 256;
    result.pitchCount = payload.dataByte();
    require(result.pitchCount > 0, "CRESTMAP1 has an empty palette");
    for (int i = 0; i < result.pitchCount; ++i) result.sourcePitches.push_back(payload.dataByte());
    const auto count = payload.bigEndian(4);
    require(count > 0 && count <= maxTemplateNotes && payload.remaining() == count * 10,
            "Invalid CRESTMAP1 event count or payload length");
    result.notes.reserve(count);
    for (std::uint32_t i = 0; i < count; ++i) {
        const auto start = payload.bigEndian(4), duration = payload.bigEndian(4);
        require(start <= maxSourceTick && duration <= maxSourceTick - start, "Invalid CRESTMAP1 event tick range");
        result.notes.push_back({static_cast<int>(start), static_cast<int>(start + duration), payload.dataByte(), payload.dataByte()});
    }
    mapping = std::move(result); // validate indices, velocity and ranges against EOT after reading the tracks
}

// Notes are paired within each track/channel. Matching repeated key attacks
// FIFO retains their individual durations until mapping resolves collisions.
class TrackReader {
public:
    TrackReader(Reader data, std::vector<PerformanceNote>& notes, std::optional<PerformanceTemplate>& mapping)
        : data_(data), notes_(notes), mapping_(mapping) {}

    int parse() {
        while (!data_.empty()) {
            const int delta = data_.variableLength();
            require(delta <= maxSourceTick - tick_, "Template track is too long");
            tick_ += delta;
            int status = data_.byte();
            if (status == 0xff) {
                if (metaEvent()) return tick_;
            } else if (status == 0xf0 || status == 0xf7) {
                running_ = 0;
                data_.take(data_.variableLength());
            } else channelEvent(status);
        }
        throw std::invalid_argument("MIDI track is missing End of Track");
    }
private:
    Reader data_;
    std::vector<PerformanceNote>& notes_;
    std::optional<PerformanceTemplate>& mapping_;
    std::map<int, std::deque<std::size_t>> held_;
    int tick_ = 0, running_ = 0;

    bool metaEvent() {
        running_ = 0;
        int type = data_.dataByte(), length = data_.variableLength();
        auto payload = data_.take(length);
        if (type == 0x7f) readMapping(payload, tick_, mapping_);
        if (type != 0x2f) return false;
        require(length == 0 && data_.empty(), "Malformed End of Track event");
        require(held_.empty(), "MIDI template contains notes without note-offs");
        return true;
    }
    void channelEvent(int first) {
        if (first >= 128) {
            require(first <= 0xef, "Unsupported MIDI system event");
            running_ = first;
            first = data_.dataByte();
        }
        require(running_ != 0, "MIDI running status has no preceding channel event");
        int type = running_ >> 4;
        if (type == 0xc || type == 0xd) return; // one data byte only
        int second = data_.dataByte();
        if ((running_ & 15) == 9 || (type != 8 && type != 9)) return;
        int key = (running_ & 15) * 128 + first;
        if (type == 9 && second > 0) {
            require(notes_.size() < maxTemplateNotes, "MIDI template exceeds 65536 note attacks");
            held_[key].push_back(notes_.size());
            notes_.push_back({tick_, tick_, first, second});
        } else {
            const auto held = held_.find(key);
            if (held == held_.end()) return; // stray release before the clip's first attack
            notes_[held->second.front()].endTick = tick_;
            held->second.pop_front();
            if (held->second.empty()) held_.erase(held);
        }
    }
};

PerformanceTemplate rankTemplate(std::vector<PerformanceNote>& notes, int ppq, int length) {
    notes.erase(std::remove_if(notes.begin(), notes.end(), [](auto n) { return n.startTick == n.endTick; }), notes.end());
    require(!notes.empty(), "MIDI template has no pitched notes of positive duration");
    std::array<bool, 128> used{};
    for (const auto& n : notes) used[n.pitch] = true;
    std::array<int, 128> ranks{};
    int count = 0;
    for (int pitch = 0; pitch < 128; ++pitch) if (used[pitch]) ranks[pitch] = count++;
    std::sort(notes.begin(), notes.end(), byOnsetAndPitch);
    PerformanceTemplate result{ppq, length, count, {}};
    result.notes.reserve(notes.size());
    for (const auto& n : notes) result.notes.push_back({n.startTick, n.endTick, ranks[n.pitch], n.velocity});
    return result;
}

} // namespace

std::vector<std::uint8_t> performanceMidi(const PerformanceRender& render) {
    checkClock(render.bpm, render.beatsPerBar);
    require(render.totalTicks >= 0 && render.totalTicks <= maxSketchTicks, "Invalid rendered sketch length");
    const auto track = encodeTrack(render);
    Bytes bytes{'M', 'T', 'h', 'd', 0, 0, 0, 6, 0, 0, 0, 1};
    putBigEndian(bytes, performancePPQ, 2);
    bytes.insert(bytes.end(), {'M', 'T', 'r', 'k'});
    putBigEndian(bytes, static_cast<std::uint32_t>(track.size()), 4);
    bytes.insert(bytes.end(), track.begin(), track.end());
    return bytes;
}

PerformanceTemplate importPerformanceMidi(const std::vector<std::uint8_t>& bytes) {
    require(bytes.size() <= 4 * 1024 * 1024, "MIDI template exceeds 4 MiB");
    Reader file(bytes);
    file.expectTag("MThd");
    auto header = file.take(file.bigEndian(4));
    auto format = header.bigEndian(2), tracks = header.bigEndian(2), ppq = header.bigEndian(2);
    require(format <= 1, "Template must be a type 0 or type 1 MIDI file");
    require(tracks >= 1 && tracks <= 64 && (format != 0 || tracks == 1), "Invalid MIDI track count (maximum 64)");
    require(ppq >= 1 && ppq <= 32767, "Template requires quarter-note time, not SMPTE");
    std::vector<PerformanceNote> notes;
    std::optional<PerformanceTemplate> mapping;
    int length = 0;
    for (unsigned i = 0; i < tracks; ++i) {
        file.expectTag("MTrk");
        TrackReader track(file.take(file.bigEndian(4)), notes, mapping);
        length = std::max(length, track.parse());
    }
    require(file.empty(), "Unexpected bytes after MIDI tracks");
    if (mapping) {
        mapping->ticksPerQuarter = static_cast<int>(ppq);
        mapping->loopTicks = length;
        checkTemplate(*mapping);
        return std::move(*mapping);
    }
    return rankTemplate(notes, static_cast<int>(ppq), length);
}

} // namespace crest::composer
