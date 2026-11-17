#include "PluginProcessor.h"
#include "PluginEditor.h"

ChordReferenceProcessor::ChordReferenceProcessor()
    : AudioProcessor(BusesProperties().withInput("Input", juce::AudioChannelSet::stereo(), true)
                                     .withOutput("Output", juce::AudioChannelSet::stereo(), true))
{
}

void ChordReferenceProcessor::processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&)
{
    // A reference utility, not an audio effect. Leave every input sample unchanged.
    // No browser calls, locks, allocation, or state access on the audio thread.
}

bool ChordReferenceProcessor::isBusesLayoutSupported(const BusesLayout& layout) const
{
    const auto output = layout.getMainOutputChannelSet();
    return (output == juce::AudioChannelSet::mono() || output == juce::AudioChannelSet::stereo())
        && output == layout.getMainInputChannelSet();
}

juce::AudioProcessorEditor* ChordReferenceProcessor::createEditor()
{
    return new ChordReferenceEditor(*this);
}

void ChordReferenceProcessor::getStateInformation(juce::MemoryBlock& destination)
{
    state.serialize(destination);
}

void ChordReferenceProcessor::setStateInformation(const void* data, int size)
{
    state.restore(data, size); // Malformed state never replaces the current document.
}

juce::Result ChordReferenceProcessor::updateFromFrontend(const juce::String& payload)
{
    auto result = state.updateFromFrontend(payload);
    if (result.wasOk()) updateHostDisplay(ChangeDetails().withNonParameterStateChanged(true));
    return result;
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() { return new ChordReferenceProcessor(); }
