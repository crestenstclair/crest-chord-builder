#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "WebAssets.h"
#include "web_tests.h"
#include <cstring>
#include <iostream>
#include <stdexcept>

static void require(bool condition, const char* message)
{
    if (!condition) throw std::runtime_error(message);
}

int main(int argc, char** argv)
{
    juce::ScopedJuceInitialiser_GUI initialiser;
    try
    {
        const bool webTests = argc == 3 && juce::String(argv[1]) == "--web";
        require(argc == 2 || webTests, "Pass [--web] and a project file.");
        ChordReferenceProcessor processor;
        for (const int channels : { 1, 2 })
        {
            juce::AudioProcessor::BusesLayout layout;
            layout.inputBuses.add(juce::AudioChannelSet::canonicalChannelSet(channels));
            layout.outputBuses.add(juce::AudioChannelSet::canonicalChannelSet(channels));
            require(processor.setBusesLayout(layout), "mono/stereo bus rejected");
            processor.prepareToPlay(48000, 512);
            juce::AudioBuffer<float> audio(channels, 512);
            for (int channel = 0; channel < channels; ++channel)
                for (int sample = 0; sample < audio.getNumSamples(); ++sample)
                    audio.setSample(channel, sample, static_cast<float>(channel * 512 + sample) / 1024.0f);
            juce::AudioBuffer<float> expected;
            expected.makeCopyOf(audio);
            juce::MidiBuffer midi;
            processor.processBlock(audio, midi);
            for (int channel = 0; channel < channels; ++channel)
                require(std::memcmp(audio.getReadPointer(channel), expected.getReadPointer(channel), 512 * sizeof(float)) == 0, "audio was altered");
        }
        require(referenceResource("/").has_value(), "embedded viewer missing");
        require(referenceResource("/reference-app.js").has_value(), "embedded JavaScript missing");
        require(!referenceResource("/../../etc/passwd").has_value(), "resource path escaped the bundle");
        juce::MemoryBlock state;
        processor.getStateInformation(state);
        ChordReferenceProcessor restored;
        restored.setStateInformation(state.getData(), static_cast<int>(state.getSize()));
        require(restored.frontendSnapshot()["projectJSON"].toString().isEmpty(), "blank processor state did not restore");
        std::cout << "PASS: mono/stereo bit-identical audio, embedded offline assets, processor state restore\n";
        if (webTests) testEmbeddedWebView(juce::File(argv[2]).loadFileAsString());
        return 0;
    }
    catch (const std::exception& error) { std::cerr << error.what() << '\n'; return 1; }
}
