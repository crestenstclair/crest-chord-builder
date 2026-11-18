#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace crest::composer {

inline constexpr int performancePPQ = 480; // ticks per quarter note

struct PerformanceSlot {
    std::vector<int> pitches; // absolute MIDI numbers in voicing order; empty = rest
    double beats = 4.0;       // quarter notes; bars * beatsPerBar for bar-based slots
};

struct PerformanceInfo {
    std::string id, family, name;
};

// Stable IDs for storage; first item is "block". Original performances only.
const std::vector<PerformanceInfo>& performanceCatalog();

struct PerformanceNote {
    int startTick, endTick; // half-open, relative to the start of the sketch
    int pitch, velocity;
};

struct PerformanceRender {
    std::vector<PerformanceNote> notes; // sorted by startTick, then pitch
    int totalTicks = 0;                 // includes trailing rests and release gaps
    double bpm = 120.0;
    int beatsPerBar = 4;                // 3 or 4, denominator always 4
    std::vector<int> slotStarts;        // rendered tick of each chord or explicit rest
};

// Ordinary MIDI uses rank across the slot range; local bank metadata can
// request an indexed selector instead. All three retain source velocity.
enum class TemplateMapping { Ranked, Performances, Rhythms };
struct TemplateNote {
    // pitchRank is the unmodified source noteIndex for indexed selectors.
    int startTick, endTick, pitchRank, velocity;
};
struct PerformanceTemplate {
    int ticksPerQuarter = 480, loopTicks = 0, pitchCount = 0;
    std::vector<TemplateNote> notes;
    TemplateMapping mapping = TemplateMapping::Ranked;
    int octaveDiff = -1;
    std::vector<int> sourcePitches{}; // exact stored order for indexed selectors only
};

// All operations are deterministic, perform no file I/O, and throw
// std::invalid_argument for invalid/unsupported input. Pass the same render
// to the audition scheduler and to performanceMidi() for identical phrasing.
PerformanceRender renderPerformance(const std::vector<PerformanceSlot>& slots,
                                    const std::string& performanceId = "block",
                                    double bpm = 120.0, int beatsPerBar = 4);
PerformanceRender renderPerformance(const std::vector<PerformanceSlot>& slots,
                                    const PerformanceTemplate& performance,
                                    double bpm = 120.0, int beatsPerBar = 4);
std::vector<std::uint8_t> performanceMidi(const PerformanceRender& render);
PerformanceTemplate importPerformanceMidi(const std::vector<std::uint8_t>& bytes);

} // namespace crest::composer
