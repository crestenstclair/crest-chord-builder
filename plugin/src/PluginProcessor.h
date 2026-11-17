#pragma once
#include <juce_audio_processors/juce_audio_processors.h>
#include "ReferenceState.h"

class ChordReferenceProcessor final : public juce::AudioProcessor
{
public:
    ChordReferenceProcessor();
    const juce::String getName() const override { return "Crest Chord Reference"; }
    void prepareToPlay(double, int) override {}
    void releaseResources() override {}
    void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    bool isBusesLayoutSupported(const BusesLayout&) const override;
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }
    bool hasEditor() const override { return true; }
    juce::AudioProcessorEditor* createEditor() override;
    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram(int) override {}
    const juce::String getProgramName(int) override { return {}; }
    void changeProgramName(int, const juce::String&) override {}
    void getStateInformation(juce::MemoryBlock&) override;
    void setStateInformation(const void*, int) override;
    juce::var frontendSnapshot() const { return state.snapshot(); }
    juce::Result updateFromFrontend(const juce::String&);

private:
    ReferenceState state;
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(ChordReferenceProcessor)
};
