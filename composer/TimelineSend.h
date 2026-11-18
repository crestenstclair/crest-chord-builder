#pragma once
#include "Sketch.h"
#include <juce_core/juce_core.h>

namespace crest {
// Editor-thread handoff to the Control Surface belonging to this host process.
// A send is published atomically and never retried implicitly.
class TimelineSend {
  public:
    TimelineSend();
    explicit TimelineSend(juce::File hostDirectory) : host(std::move(hostDirectory)) {}
    juce::String sendSketches(const Book&, double bpm);
    static bool hasSketches(const Book&);
    std::optional<juce::String> completion();
    bool pending() const { return request != juce::File{}; }

  private:
    juce::File host, request;
    int64_t deadline = 0;
};
} // namespace crest
