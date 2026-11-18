#pragma once
#include "Audition.h"
#include "BoundKeys.h"
#include "Sketch.h"
#include <juce_audio_processors/juce_audio_processors.h>

namespace crest {
class Processor final : public juce::AudioProcessor {
  public:
    Processor();
    std::pair<Book, uint64_t> snapshot() const;
    bool commit(const Book &, uint64_t expected); // ignore stale editor writes after host restore
    uint64_t revision() const {
        return generation.load();
    }
    double tempo(const Book &) const;
    Audition audition;
    bool sounding(int n) const {
        return audition.sounding(n) || boundKeys.sounds(n);
    }
    void prepareToPlay(double sr, int) override {
        audition.prepare(sr);
        boundKeys.prepare(sr);
        controller.ensureSize(2048);
    }
    void releaseResources() override {
        audition.stop();
    }
    void processBlock(juce::AudioBuffer<float> &, juce::MidiBuffer &) override;
    bool isBusesLayoutSupported(const BusesLayout &) const override;
    void getStateInformation(juce::MemoryBlock &) override;
    void setStateInformation(const void *, int) override;
    juce::AudioProcessorEditor *createEditor() override;
    bool hasEditor() const override {
        return true;
    }
    const juce::String getName() const override {
        return "Crest Composer";
    }
    bool acceptsMidi() const override {
        return JucePlugin_WantsMidiInput != 0;
    }
    bool producesMidi() const override {
        return true;
    }
    double getTailLengthSeconds() const override {
        return 0.06;
    }
    int getNumPrograms() override {
        return 1;
    }
    int getCurrentProgram() override {
        return 0;
    }
    void setCurrentProgram(int) override {}
    const juce::String getProgramName(int) override {
        return "Sketchbook";
    }
    void changeProgramName(int, const juce::String &) override {}

  private:
    mutable juce::CriticalSection mutex;
    Book book;
    BoundKeys boundKeys;
    juce::MidiBuffer controller;
    std::atomic<uint64_t> generation{0};
    std::atomic<double> hostBpm{0};
};
} // namespace crest
