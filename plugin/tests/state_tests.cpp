#include "ReferenceState.h"
#include <iostream>
#include <stdexcept>

void check(bool condition, const char* message)
{
    if (!condition) throw std::runtime_error(message);
}

juce::String payload(const juce::String& project, juce::int64 generation, const char* part)
{
    auto value = juce::var(new juce::DynamicObject());
    value.getDynamicObject()->setProperty("generation", generation);
    value.getDynamicObject()->setProperty("projectJSON", project);
    auto ui = juce::var(new juce::DynamicObject());
    ui.getDynamicObject()->setProperty("partId", part);
    ui.getDynamicObject()->setProperty("labels", "intervals");
    value.getDynamicObject()->setProperty("ui", ui);
    return juce::JSON::toString(value, true);
}

int main(int argc, char** argv)
{
    try
    {
        check(argc == 2, "Pass the example project path.");
        const auto project = juce::File(argv[1]).loadFileAsString();
        ReferenceState first, second;
        check(first.updateFromFrontend(payload(project, 1, "verse")).wasOk(), "valid project rejected");
        check(second.snapshot()["projectJSON"].toString().isEmpty(), "instances shared project data");
        juce::MemoryBlock saved;
        first.serialize(saved);
        check(second.restore(saved.getData(), static_cast<int>(saved.getSize())).wasOk(), "state recall failed");
        check(second.snapshot()["projectJSON"].toString() == project, "project did not round-trip exactly");
        check(second.snapshot()["ui"]["partId"].toString() == "verse", "selected part was not recalled");
        check(second.updateFromFrontend(payload("", 1, "")).failed(), "stale editor overwrote recalled state");
        check(second.updateFromFrontend(payload("{broken", 2, "")).failed(), "broken JSON replaced the state");
        check(second.restore("not a preset", 12).failed(), "corrupt host state was accepted");
        check(second.snapshot()["projectJSON"].toString() == project, "invalid input changed the project");
        check(second.updateFromFrontend(payload("", 2, "")).wasOk(), "valid empty state failed");
        check(first.snapshot()["projectJSON"].toString() == project, "editing the clone changed its source");
        std::cout << "PASS: independent instances, exact state recall, preferences, stale-write and malformed-state protection\n";
        return 0;
    }
    catch (const std::exception& error) { std::cerr << error.what() << '\n'; return 1; }
}
