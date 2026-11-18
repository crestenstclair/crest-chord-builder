#pragma once
#include "Sketch.h"
#include <juce_audio_basics/juce_audio_basics.h>

namespace crest {
// The bind buttons arm a lane independently of the lane displayed in Section C.
// Channel 2 keeps held controller chords and Section C playback independently releasable.
class BoundKeys {
  public:
    void publish(const Book &);
    void prepare(double);
    void process(const juce::MidiBuffer &, juce::AudioBuffer<float> &, juce::MidiBuffer &);
    bool sounds(int note) const {
        return sounding[note].load(std::memory_order_relaxed);
    }
    static int slotFor(int note);

  private:
    using Mapping = std::array<std::array<uint8_t, 17>, slotLimit>; // count followed by at most 16 pitches
    void release(int, int, juce::MidiBuffer &);
    void releaseAll(int, juce::MidiBuffer &);
    void playEvent(const juce::MidiMessage &, int, juce::MidiBuffer &);
    void synth(juce::AudioBuffer<float> &, int, int);
    Mapping published{}, current{};
    std::array<bool, slotLimit> held{};
    std::array<int, 128> refs{};
    std::array<float, 128> level{};
    std::array<double, 128> inc{}, phase{};
    std::array<std::atomic<bool>, 128> sounding{};
    juce::SpinLock mutex;
};
} // namespace crest
