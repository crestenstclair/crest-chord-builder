#include "../Performance.h"

#include <algorithm>
#include <array>
#include <fstream>
#include <iostream>
#include <iterator>
#include <limits>
#include <set>
#include <stdexcept>
#include <tuple>

using namespace crest::composer;
namespace {
using Bytes = std::vector<std::uint8_t>;
using Slots = std::vector<PerformanceSlot>;

void check(bool ok, const char* why) { if (!ok) throw std::runtime_error(why); }

template<typename F> void rejects(F&& operation, const char* why) {
    try { operation(); } catch (const std::invalid_argument&) { return; }
    throw std::runtime_error(why);
}

bool same(PerformanceNote a, PerformanceNote b) {
    return std::tie(a.startTick, a.endTick, a.pitch, a.velocity) == std::tie(b.startTick, b.endTick, b.pitch, b.velocity);
}

void waltzMidiGolden() {
    const auto render = renderPerformance({{{60, 60}, 1}, {{}, 2}}, "block", 96, 3);
    check(render.notes.size() == 1 && same(render.notes[0], {0, 480, 60, 88}), "Block should sound MIDI 60 once for one beat");
    // One track, 480 PPQ; 96 BPM (625000 us/q); 3/4; one attack, one
    // release; EOT two quarter notes AFTER release. Independently written SMF.
    const Bytes expected{'M','T','h','d', 0,0,0,6, 0,0, 0,1, 1,0xe0,
                         'M','T','r','k', 0,0,0,29,
                         0,0xff,0x51,3,0x09,0x89,0x68,
                         0,0xff,0x58,4, 3,2,24,8,
                         0,0x90,60,88, 0x83,0x60,0x80,60,0, 0x87,0x40,0xff,0x2f,0};
    check(performanceMidi(render) == expected, "Waltz MIDI or trailing delta is incorrect");
    const auto silent = performanceMidi(renderPerformance({{{}, 8}}, "block", 120, 4));
    check(silent[33] == 4 && silent[34] == 2, "Expected 4/4 time signature");
    const Bytes silentEnding{0x9e,0,0xff,0x2f,0}; // EOT at 3840
    check(std::equal(silentEnding.rbegin(), silentEnding.rend(), silent.rbegin()), "All-rest sketch lost its duration");
}

// Realistic DAW file: conductor reserves four beats, shorter music track uses
// 96 PPQ, running status, velocity-zero releases, SysEx, program change, drums.
Bytes userClip() {
    Bytes melody{0,0xc0,8, 0,0xf0,2,0x7d,0xf7, 0,0x99,36,120,
                 24,0x90,48,98, 48,48,0, 0,55,70, 18,55,0,
                 30,64,88, 72,0x80,64,35, 0,0x89,36,64, 0,0xff,0x2f,0};
    Bytes bytes{'M','T','h','d',0,0,0,6,0,1,0,2,0,96,
                'M','T','r','k',0,0,0,5, 0x83,0,0xff,0x2f,0,
                'M','T','r','k',0,0,0,static_cast<std::uint8_t>(melody.size())};
    bytes.insert(bytes.end(), melody.begin(), melody.end());
    return bytes;
}

void importAndRevoiceUserClip() {
    const auto clip = importPerformanceMidi(userClip());
    check(clip.loopTicks == 384 && clip.ticksPerQuarter == 96 && clip.pitchCount == 3, "Bad source timing or pitched-note selection");
    auto revoiced = renderPerformance({{{76,65,69,72},5},{{},1},{{55},1}}, clip, 116, 4);
    const std::vector<PerformanceNote> expected{
        {120,360,65,98}, {360,450,72,70}, {600,960,76,88},
        {2040,2280,65,98}, {2280,2370,72,70}, // repeat after trailing silence
        {3000,3240,55,98}, {3240,3330,55,70}};
    check(std::equal(expected.begin(), expected.end(), revoiced.notes.begin(), revoiced.notes.end(), same), "Wrong mapped pitches, groove, rest, or gate");
    check(revoiced.totalTicks == 3360, "Revoicing changed the slot lengths");
}

void appendWord(Bytes& bytes, std::uint32_t value) {
    for (int shift : {24,16,8,0}) bytes.push_back(static_cast<std::uint8_t>(value >> shift));
}

struct RawHit { std::uint32_t tick, gate; std::uint8_t index, velocity; };

Bytes indexedMetadata(int family, int octaveDiff, const Bytes& palette, const std::vector<RawHit>& hits) {
    Bytes bytes{'C','R','E','S','T','M','A','P','1', static_cast<std::uint8_t>(family),
                static_cast<std::uint8_t>(octaveDiff), static_cast<std::uint8_t>(palette.size())};
    bytes.insert(bytes.end(), palette.begin(), palette.end());
    appendWord(bytes, static_cast<std::uint32_t>(hits.size()));
    for (auto h : hits) {
        appendWord(bytes,h.tick); appendWord(bytes,h.gate);
        bytes.push_back(h.index); bytes.push_back(h.velocity);
    }
    return bytes;
}

// Independent type-0 fixture at 480 PPQ. The playable fallback is just one
// note: listening to the wrong (generic) representation makes these tests fail.
Bytes mappedMidi(const Bytes& payload, int delta = 0, bool duplicate = false) {
    Bytes track;
    for (int i = 0; i < (duplicate ? 2 : 1); ++i) {
        track.insert(track.end(), {static_cast<std::uint8_t>(delta),0xff,0x7f});
        if (payload.size() >= 128) track.push_back(static_cast<std::uint8_t>(128 | (payload.size() >> 7)));
        track.push_back(static_cast<std::uint8_t>(payload.size() & 127));
        track.insert(track.end(), payload.begin(), payload.end());
    }
    track.insert(track.end(), {0,0x90,36,12, 1,0x80,36,0, 0x83,0x5f,0xff,0x2f,0});
    Bytes bytes{'M','T','h','d',0,0,0,6,0,0,0,1,1,0xe0,'M','T','r','k'};
    appendWord(bytes,static_cast<std::uint32_t>(track.size()));
    bytes.insert(bytes.end(),track.begin(),track.end());
    return bytes;
}

std::vector<int> playedKeys(const PerformanceRender& clip) {
    std::vector<int> pitches;
    for (const auto& n : clip.notes) pitches.push_back(n.pitch);
    return pitches;
}

void performance12_8_8() {
    // 12-8-8-Performance.json: the first three indices make a spread Dm,
    // not the three notes of Dm. Later diagnostic hits probe the whole palette.
    auto bytes = indexedMetadata(1,-1,{48,55,60,64,67,72},{{0,121,0,121},{0,121,1,121},{0,241,2,127},
                                 {260,30,3,66},{300,20,4,85},{340,10,5,12},{355,0,0,104}});
    const auto source = importPerformanceMidi(mappedMidi(bytes));
    auto triad = renderPerformance({{{62,65,69,74},1}},source);
    check(playedKeys(triad) == std::vector<int>({62,65,74,77,81,86}), "12-8-8 Performance class/occurrence mapping");
    check(same(triad.notes[2],{0,241,74,127}) && same(triad.notes[5],{340,350,86,12}), "Indexed transform must retain source velocities and gates");
    auto dyad = renderPerformance({{{62,65},1}},source);
    check(playedKeys(dyad) == std::vector<int>({62,65,74,77,86}), "12-8-8 dyad should drop, not clamp, out-of-range indices");
}

void performance5_4_7AndFolding() {
    // 5-4-7-Performance.json: the stored pitch 100, not its minimum 57,
    // establishes the octave reference. Synthetic one-at-a-time probe events.
    const Bytes palette{100,105,108,57,60,64,69,72,76,81,84,88,93,96};
    std::vector<RawHit> probe;
    for (std::uint8_t i = 0; i < palette.size(); ++i) probe.push_back({10u*i,8,i,82});
    auto source = importPerformanceMidi(mappedMidi(indexedMetadata(1,1,palette,probe)));
    check(playedKeys(renderPerformance({{{62,65,69},1}},source)) == std::vector<int>({50,53,57,62,65,69,74,77,81,86,89,89,93,93}),
          "5-4-7 stored palette order, signed truncation, or octave offset is wrong");

    // Four source classes fold into three: the surplus fourth occurrence
    // extends the first class. Wrap latches after A->G, including the later B.
    source = importPerformanceMidi(mappedMidi(indexedMetadata(1,-1,{48,52,55,59},{{0,4,0,80},{10,4,1,80},{20,4,2,80},{30,4,3,80}})));
    check(playedKeys(renderPerformance({{{69,67,71},1}},source)) == std::vector<int>({69,79,81,83}), "Performance fold or destination wrap reset");
    check(playedKeys(renderPerformance({{{69,67,71,72,74},1}},source)) == std::vector<int>({69,72,79,83}), "Performance fabricated occurrences for unused chord classes");
}

void rhythmCommon7() {
    auto source = importPerformanceMidi(mappedMidi(indexedMetadata(2,-1,{60,64,67},{{0,360,0,100},{0,360,1,100},{0,360,2,100}})));
    check(playedKeys(renderPerformance({{{62,65},1}},source)) == std::vector<int>({62,65}), "Common-7 should drop the third hit on a dyad");
    auto extended = renderPerformance({{{62,65,69,74},1}},source);
    check(playedKeys(extended) == std::vector<int>({62,65,69,74}) && same(extended.notes[3],{0,360,74,100}), "Common-7 should clone its first hit for a fourth voice");

    // Unsorted source, partial hit and nonascending destination expose the
    // distinction between extension+reindex and merely repeating index 0.
    source = importPerformanceMidi(mappedMidi(indexedMetadata(2,-2,{67,60},{{0,30,1,25},{60,0,0,90}})));
    check(playedKeys(renderPerformance({{{65,55},1}},source)) == std::vector<int>({43}), "Direct rhythm lookup reordered the original chord");
    // Extended source [60,67,72,79,84,91]; 60's event is cloned at 72 and 84.
    check(playedKeys(renderPerformance({{{67,55,71,60,48,74},1}},source)) == std::vector<int>({36,55,59}), "Rhythm extension must sort and reindex cloned generations");
    source = importPerformanceMidi(mappedMidi(indexedMetadata(2,0,{126},{{0,48,0,88}})));
    check(renderPerformance({{{120,100},1}},source).notes.empty(), "Unextendable rhythm palette or output beyond MIDI range mishandled");
}

void lanePerformanceKeepsItsPlace() {
    PerformanceTemplate source{480,1920,1,{{0,120,0,85},{440,580,0,74},{1000,1080,0,67},{1520,1540,0,91}},
                               TemplateMapping::Performances,-1,{60}};
    auto clip=renderPerformance({{{60},1},{{64},1},{{},1},{{67},1},{{69},1}},source);
    const std::vector<PerformanceNote> expected{{0,120,60,85},{440,480,60,74},{480,580,64,74},
                                                {1520,1540,67,91},{1920,2040,69,85},{2360,2400,69,74}};
    check(clip.totalTicks==2400 && std::equal(clip.notes.begin(),clip.notes.end(),expected.begin(),expected.end(),same),
          "Lane phrase must revoice a held gate, advance over rests, and loop only at its source end");
}

void invalidMapping() {
    const auto valid = indexedMetadata(1,-1,{60,67},{{0,25,1,121}});
    auto badField = [&](std::size_t pos, int value) {
        auto corrupt = valid; corrupt.at(pos) = static_cast<std::uint8_t>(value);
        rejects([&]{importPerformanceMidi(mappedMidi(corrupt));}, "Corrupt CRESTMAP1 field accepted");
    };
    badField(9,3); badField(11,0); badField(11,128); badField(12,128); badField(13,60); // family and palette
    badField(14,255); badField(17,0); badField(17,2); // oversized, empty or inconsistent count
    badField(18,255); badField(22,255); badField(24,2); // start, duration, end after EOT
    badField(26,2); badField(27,0); badField(27,128); // raw index and velocity
    auto extra = valid; extra.push_back(0);
    rejects([&]{importPerformanceMidi(mappedMidi(extra));}, "Surplus payload byte accepted");
    for (std::size_t n = 9; n < valid.size(); ++n)
        rejects([&]{importPerformanceMidi(mappedMidi(Bytes(valid.begin(),valid.begin()+n)));}, "Truncated indexed template silently fell back");
    rejects([&]{importPerformanceMidi(mappedMidi(valid,1));}, "Mapped event after tick zero accepted");
    rejects([&]{importPerformanceMidi(mappedMidi(valid,0,true));}, "Ambiguous duplicate mapping accepted");
    check(importPerformanceMidi(mappedMidi({'a','b','c'})).mapping == TemplateMapping::Ranked, "Foreign sequencer metadata should be ignored");
    const auto zero = importPerformanceMidi(mappedMidi(indexedMetadata(1,-1,{60},{{0,0,0,88}})));
    check(renderPerformance({{{60},4}},zero).notes.empty(), "Zero-gate mapping should render silence, not fallback events");
}

// Optional local integration; the repository does not contain factory MIDI.
void checkIndexedBank(const std::string& bank) {
    auto firstAttack = [&](const char* uuid, const std::vector<int>& chord) {
        std::ifstream file(bank + "/motions/" + uuid + ".mid", std::ios::binary);
        check(file.good(), "Indexed MIDI fixture missing");
        const Bytes bytes{std::istreambuf_iterator<char>(file),{}};
        const auto source = importPerformanceMidi(bytes);
        check(source.mapping != TemplateMapping::Ranked, "Local bank needs the CRESTMAP1 adapter");
        return playedKeys(renderPerformance({{chord,1.0/480}},source));
    };
    check(firstAttack("ab932340-4b4b-4912-80b6-e88551fa3e04",{62,65,69}) == std::vector<int>({62,65,74}),"Installed 12-8-8 first onset");
    check(firstAttack("8f40ad8b-a60e-45ca-9441-4b66f37d275e",{62,65,69,74}) == std::vector<int>({62,65,69,74}),"Installed Common-7 first onset");
    check(firstAttack("a1384322-12cc-4bf8-a1e4-2b3ca67f04f6",{62,65,69}) == std::vector<int>({57,93}),"Installed 5-4-7 first onset");
}

void roundTrip(const PerformanceRender& original) {
    const auto bytes = performanceMidi(original);
    auto imported = importPerformanceMidi(bytes);
    std::set<int> pitches;
    for (auto n : original.notes) pitches.insert(n.pitch);
    Slots slots{{{pitches.begin(), pitches.end()}, original.totalTicks / double(performancePPQ)}};
    const auto played = renderPerformance(slots, imported, original.bpm, original.beatsPerBar);
    check(played.totalTicks == original.totalTicks && imported.loopTicks == original.totalTicks, "Round trip lost loop length");
    check(std::equal(original.notes.begin(), original.notes.end(), played.notes.begin(), played.notes.end(), same), "Round trip differed from audition events");
    check(bytes == performanceMidi(played), "File encoding is not stable across round trip");
}

void exerciseEachStyle(int meter) {
    const std::vector<int> low{36, 40, 43, 47}, high{64, 67, 70};
    Slots slots{{low, double(meter)}, {{}, 0.5}, {high, meter - 0.5}, {{}, double(meter)}};
    std::set<Bytes> identities;
    for (const auto& style : performanceCatalog()) {
        const auto played = renderPerformance(slots, style.id, 132, meter);
        check(played.totalTicks == 3 * meter * 480 && !played.notes.empty(), "Gesture changed duration or made no sound");
        int lastTick = -1;
        std::array<int, 128> released{};
        for (const auto& n : played.notes) {
            const bool first = n.startTick < meter * 480;
            const auto& available = first ? low : high;
            check(first || n.startTick >= meter * 480 + 240, "Note onset inside a rest");
            check(n.endTick <= (first ? meter : meter * 2) * 480, "Gate rings across slot or trailing rest");
            check(std::binary_search(available.begin(), available.end(), n.pitch), "Style changed the harmony");
            check(lastTick <= n.startTick && released[n.pitch] <= n.startTick && n.startTick < n.endTick, "Unordered or overlapping same-key note");
            released[n.pitch] = n.endTick;
            lastTick = n.startTick;
        }
        const auto bytes = performanceMidi(played);
        check(identities.insert(bytes).second, "Two presets produced identical playback");
        check(bytes == performanceMidi(renderPerformance(slots, style.id, 132, meter)), "Style varies between audition and export");
        roundTrip(played);
    }
}

void articulationIsAudible() {
    const Slots twoBars{{{48,55,59,64}, 8}};
    const auto block = renderPerformance(twoBars);
    check(block.notes.size() == 4 && block.notes.front().endTick == 3840, "Block subdivides a held chord");

    const auto brush = renderPerformance(twoBars, "strum-reed");
    check(brush.notes[0].pitch == 48 && brush.notes[3].pitch == 64 && brush.notes[0].startTick < brush.notes[3].startTick,
          "Downstroke lacks a rolled attack");
    check(brush.notes[4].pitch == 64 && brush.notes[7].pitch == 48 && brush.notes[4].velocity > brush.notes[7].velocity,
          "Upstroke should reverse string order and lean into the first string");

    const auto triplets = renderPerformance(twoBars, "arp-rain");
    check(triplets.notes[1].startTick == 160 && triplets.notes[2].startTick == 320 && triplets.notes[0].endTick > 160,
          "Cascade should ring between triplet attacks");
    const auto clipped = renderPerformance(twoBars, "rhythm-shutters");
    check(clipped.notes[0].endTick < 240 && clipped.notes[1].startTick == 360 && clipped.notes[1].velocity < clipped.notes[0].velocity,
          "Muted rhythm should leave space for the quiet syncopation");
    const auto bassline = renderPerformance(twoBars, "bass-keel");
    check(std::all_of(bassline.notes.begin(), bassline.notes.end(), [](auto n){ return n.pitch <= 55; }), "Bassline escaped low voices");
    const auto dialogue = renderPerformance(twoBars, "phrase-dialogue");
    const auto answer = std::find_if(dialogue.notes.begin(), dialogue.notes.end(), [](auto n){ return n.startTick == 1920; });
    check(dialogue.notes.front().pitch == 48 && answer != dialogue.notes.end() && answer->pitch == 64, "Phrase needs a contrasting second bar");
}

void repeatedKeysAndRounding() {
    const PerformanceTemplate crowded{96,96,3,{{20,60,2,73},{0,50,0,84},{0,29,1,99}}};
    const auto mono = renderPerformance({{{60},1}}, crowded);
    check(mono.notes.size() == 2 && same(mono.notes[0], {0,100,60,99}) && same(mono.notes[1], {100,300,60,73}), "Same-key collapse or retrigger failed");
    roundTrip(mono);

    // Rounding each cycle or slot length independently would accumulate error.
    Slots septuplets(7, {{61}, 1.0 / 7});
    check(renderPerformance(septuplets).totalTicks == 480, "Rounded slot boundaries drifted");
    const PerformanceTemplate unusualPPQ{7,1,1,{{0,1,0,80}}};
    const auto seven = renderPerformance({{{61}, 1}}, unusualPPQ);
    check(seven.notes.size() == 7 && seven.notes[6].startTick == 411 && seven.notes[6].endTick == 480, "Loop repetitions drifted on conversion to 480 PPQ");
}

void invalidInput() {
    rejects([]{renderPerformance({{{128},1}});}, "Out-of-bounds MIDI key accepted");
    rejects([]{renderPerformance({{{60},0}});}, "Zero slot accepted");
    rejects([]{renderPerformance({}, "block", std::numeric_limits<double>::quiet_NaN());}, "Nonfinite BPM accepted");
    rejects([]{renderPerformance({}, "block", 120, 7);}, "Unexpected meter accepted");
    rejects([]{renderPerformance({}, "nonexistent");}, "Unknown style accepted");
    rejects([]{performanceMidi({{{0,480,60,90},{100,200,60,70}},480,120,4});}, "Ambiguous same-key export accepted");
    rejects([]{renderPerformance({{{60},4}}, PerformanceTemplate{480,0,1,{{0,1,0,99}}});}, "Zero repeat length accepted");

    auto clip = userClip();
    for (std::size_t cut = 0; cut < clip.size(); ++cut)
        rejects([&]{importPerformanceMidi(Bytes(clip.begin(), clip.begin() + cut));}, "Partial file accepted");
    auto smpte = clip;
    smpte[12] = 0xe7;
    rejects([&]{importPerformanceMidi(smpte);}, "SMPTE division accepted");
    std::fill_n(clip.begin() + 22, 4, 0xff);
    rejects([&]{importPerformanceMidi(clip);}, "Long delta escaped its track");
    rejects([]{importPerformanceMidi(performanceMidi(renderPerformance({{{},3}})));}, "Pure silence is not a playable note template");
}
} // namespace

int main(int argc, char** argv) {
    try {
        waltzMidiGolden();
        importAndRevoiceUserClip();
        performance12_8_8();
        performance5_4_7AndFolding();
        rhythmCommon7();
        lanePerformanceKeepsItsPlace();
        invalidMapping();
        if (argc == 2) checkIndexedBank(argv[1]);
        exerciseEachStyle(3);
        exerciseEachStyle(4);
        articulationIsAudible();
        repeatedKeysAndRounding();
        invalidInput();
        std::cout << "Passed performance tests for " << performanceCatalog().size() << " styles in 3/4 and 4/4\n";
        return 0;
    } catch (const std::exception& e) {
        std::cerr << "Performance test failed: " << e.what() << '\n';
        return 1;
    }
}
