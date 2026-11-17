#pragma once
#include <juce_core/juce_core.h>
#include <mutex>

// Owned by one processor, independent of editor lifetime. Never used in processBlock.
class ReferenceState
{
public:
    static constexpr int maximumProjectBytes = 2 * 1024 * 1024;
    juce::var snapshot() const;
    juce::Result updateFromFrontend(const juce::String& payload);
    void serialize(juce::MemoryBlock& destination) const;
    juce::Result restore(const void* data, int size);

private:
    struct Content { juce::String projectJSON; juce::var ui; };
    static juce::Result parseContent(const juce::var& input, Content& content);
    juce::var snapshotUnlocked() const;
    mutable std::mutex mutex;
    Content content;
    juce::int64 generation = 1;
};
