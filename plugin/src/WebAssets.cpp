#include "WebAssets.h"
#include "ReferenceWebAssets.h"
#include <map>
#include <cstring>

namespace
{
juce::String mimeType(const juce::String& name)
{
    if (name.endsWith(".html")) return "text/html";
    if (name.endsWith(".js")) return "text/javascript";
    if (name.endsWith(".css")) return "text/css";
    if (name.endsWith(".svg")) return "image/svg+xml";
    if (name.endsWith(".json")) return "application/json";
    if (name.endsWith(".wasm")) return "application/wasm";
    return "application/octet-stream";
}

auto loadAssets()
{
    std::map<juce::String, juce::WebBrowserComponent::Resource> assets;
    juce::MemoryInputStream input(ReferenceWebAssets::web_zip, ReferenceWebAssets::web_zipSize, false);
    juce::ZipFile archive(input);
    for (int index = 0; index < archive.getNumEntries(); ++index)
    {
        const auto name = archive.getEntry(index)->filename;
        auto stream = archive.createStreamForEntry(index);
        if (!stream) continue;
        juce::MemoryBlock bytes;
        stream->readIntoMemoryBlock(bytes);
        std::vector<std::byte> data(bytes.getSize());
        std::memcpy(data.data(), bytes.getData(), bytes.getSize());
        assets.emplace("/" + name, juce::WebBrowserComponent::Resource { std::move(data), mimeType(name) });
    }
    return assets;
}
}

std::optional<juce::WebBrowserComponent::Resource> referenceResource(const juce::String& requestedPath)
{
    static const auto assets = loadAssets();
    auto path = requestedPath.upToFirstOccurrenceOf("?", false, false);
    if (path == "/") path = "/reference.html";
    const auto entry = assets.find(path);
    if (entry == assets.end()) return std::nullopt;
    return entry->second;
}
