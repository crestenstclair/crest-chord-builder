#pragma once
#include <juce_core/juce_core.h>

// Requires a macOS GUI session; opens temporary test windows, never a user's DAW set.
void testEmbeddedWebView(const juce::String& projectJSON);
