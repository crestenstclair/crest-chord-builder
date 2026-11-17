#pragma once
#include <juce_gui_extra/juce_gui_extra.h>
#include "PluginProcessor.h"

class ReferenceBrowser final : public juce::WebBrowserComponent
{
public:
    explicit ReferenceBrowser(const Options& options) : WebBrowserComponent(options) {}
    bool pageAboutToLoad(const juce::String&) override;
    void newWindowAttemptingToLoad(const juce::String&) override {}
};

class ChordReferenceEditor final : public juce::AudioProcessorEditor, private juce::Timer
{
public:
    explicit ChordReferenceEditor(ChordReferenceProcessor&);
    void resized() override;
    void paint(juce::Graphics&) override;

private:
    friend struct ReferenceEditorProbe;
    juce::WebBrowserComponent::Options browserOptions();
    void timerCallback() override;
    ChordReferenceProcessor& ownerProcessor;
    ReferenceBrowser browser;
    juce::int64 deliveredGeneration = 0;
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(ChordReferenceEditor)
};
