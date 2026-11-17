#include "ReferenceState.h"
#include <cstring>

namespace
{
constexpr auto magic = "CREST-REFERENCE/1\n";
constexpr int maximumStateBytes = ReferenceState::maximumProjectBytes * 4;

juce::var object()
{
    return juce::var(new juce::DynamicObject());
}

juce::var cleanUI(const juce::var& input)
{
    auto result = object();
    auto* properties = result.getDynamicObject();
    properties->setProperty("theme", input["theme"].toString() == "light" ? "light" : "dark");
    properties->setProperty("labels", input["labels"].toString() == "notes" ? "notes" : "intervals");
    properties->setProperty("zoom", input.hasProperty("zoom") ? juce::jlimit(80, 150, static_cast<int>(input["zoom"])) : 100);
    properties->setProperty("start", juce::jlimit(0, 12, static_cast<int>(input["start"])));
    properties->setProperty("partId", input["partId"].toString().substring(0, 80));
    return result;
}
}

juce::Result ReferenceState::parseContent(const juce::var& input, Content& result)
{
    if (!input.isObject() || !input["projectJSON"].isString())
        return juce::Result::fail("Expected a project JSON string.");
    const auto projectJSON = input["projectJSON"].toString();
    if (projectJSON.getNumBytesAsUTF8() > maximumProjectBytes)
        return juce::Result::fail("Project JSON exceeds 2 MB.");
    if (projectJSON.isNotEmpty())
    {
        const auto project = juce::JSON::parse(projectJSON);
        const auto version = static_cast<int>(project["version"]);
        if (!project.isObject() || project["format"].toString() != "crest-chord-builder"
            || version < 1 || version > 3 || !project["guitars"].isArray() || !project["parts"].isArray()
            || project["guitars"].size() == 0 || project["parts"].size() == 0)
            return juce::Result::fail("Not a supported Crest Chord Builder project.");
    }
    // Full musical/schema validation happens before the frontend calls this boundary.
    result = { projectJSON, cleanUI(input["ui"]) };
    return juce::Result::ok();
}

juce::var ReferenceState::snapshotUnlocked() const
{
    auto result = object();
    result.getDynamicObject()->setProperty("generation", generation);
    result.getDynamicObject()->setProperty("projectJSON", content.projectJSON);
    result.getDynamicObject()->setProperty("ui", content.ui.isObject() ? content.ui.clone() : cleanUI({}));
    return result;
}

juce::var ReferenceState::snapshot() const
{
    const std::lock_guard lock(mutex);
    return snapshotUnlocked();
}

juce::Result ReferenceState::updateFromFrontend(const juce::String& payload)
{
    if (payload.getNumBytesAsUTF8() > maximumStateBytes)
        return juce::Result::fail("Plug-in state exceeds its size limit.");
    const auto input = juce::JSON::parse(payload);
    Content next;
    if (const auto valid = parseContent(input, next); valid.failed()) return valid;
    const std::lock_guard lock(mutex);
    if (static_cast<juce::int64>(input["generation"]) != generation)
        return juce::Result::fail("The host restored a different state. Old editor changes were not applied.");
    content = std::move(next);
    return juce::Result::ok();
}

void ReferenceState::serialize(juce::MemoryBlock& destination) const
{
    auto state = snapshot();
    state.getDynamicObject()->removeProperty("generation");
    state.getDynamicObject()->setProperty("format", "crest-chord-reference");
    state.getDynamicObject()->setProperty("version", 1);
    const auto text = juce::String(magic) + juce::JSON::toString(state, true);
    destination.replaceAll(text.toRawUTF8(), text.getNumBytesAsUTF8());
}

juce::Result ReferenceState::restore(const void* data, int size)
{
    const auto prefixLength = static_cast<int>(std::strlen(magic));
    if (data == nullptr || size <= prefixLength || size > maximumStateBytes || std::memcmp(data, magic, static_cast<size_t>(prefixLength)) != 0)
        return juce::Result::fail("Unrecognised plug-in state; the current project was preserved.");
    const auto input = juce::JSON::parse(juce::String::fromUTF8(static_cast<const char*>(data) + prefixLength, size - prefixLength));
    if (input["format"].toString() != "crest-chord-reference" || static_cast<int>(input["version"]) != 1)
        return juce::Result::fail("Unsupported plug-in state version.");
    Content next;
    if (const auto valid = parseContent(input, next); valid.failed()) return valid;
    const std::lock_guard lock(mutex);
    content = std::move(next);
    ++generation;
    return juce::Result::ok();
}
