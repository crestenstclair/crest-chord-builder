#pragma once
#include "Performance.h"
#include <array>
#include <juce_audio_basics/juce_audio_basics.h>

namespace crest {
// The producer builds/sorts the clip off the audio thread. A new preview replaces
// the old one at a block boundary; displaced storage returns to the producer.
class Audition {
  public:
    struct Cursor { uint32_t preview = 0; int slot = -1; };
    uint32_t submit(const composer::PerformanceRender &);
    Cursor cursor() const { return published.load(std::memory_order_relaxed); }
    void stop();
    void prepare(double sampleRate);
    void process(juce::AudioBuffer<float> &, juce::MidiBuffer &);
    bool sounding(int n) const {
        return lit[n].load(std::memory_order_relaxed);
    }

  private:
    struct Event {
        double seconds;
        int pitch, velocity;
    };
    struct Voice {
        double phase = 0, increment = 0;
        float level = 0, target = 0;
        bool gate = false;
    };
    struct Sequence {
        std::vector<Event> notes;
        std::vector<double> boundaries; // seconds, including the end of the last slot
        uint32_t id = 0;
    };
    uint32_t post(Sequence);
    void silence(juce::MidiBuffer &);
    void synthesize(juce::AudioBuffer<float> &, int from, int to);
    void trigger(const Event &, int offset, juce::MidiBuffer &);
    juce::SpinLock mailbox;
    Sequence queued, playing;
    uint32_t serial = 0;
    std::atomic<Cursor> published{Cursor{}};
    static_assert(std::atomic<Cursor>::is_always_lock_free);
    bool pending = false;
    std::array<Voice, 128> voices{};
    std::array<std::atomic<bool>, 128> lit{};
    double rate = 48000;
    float smoothing = 0;
    int64_t elapsed = 0;
    size_t next = 0, nextBoundary = 0;
};
} // namespace crest
