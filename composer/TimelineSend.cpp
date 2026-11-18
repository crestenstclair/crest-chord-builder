#include "TimelineSend.h"
#include <unistd.h>
using namespace juce;
namespace crest {
TimelineSend::TimelineSend()
    : TimelineSend(File::getSpecialLocation(File::userHomeDirectory)
                       .getChildFile("Library/Application Support/Crest Composer/Timeline")
                       .getChildFile(String(int(getpid())))) {}

namespace {
String shorten(const String &s, int limit) {
    return s.length() <= limit ? s : s.substring(0, limit - 1) + String::fromUTF8("…");
}
String clipLabel(const Sketch &sketch, int index) {
    auto name = shorten(sketch.name.trim(), 40);
    if (name.isEmpty())
        name = "Sketch " + String(index + 1);
    StringArray chords;
    for (const auto &slot : sketch.slots)
        chords.add(slot.chord.pitches.empty() ? String("Rest") : String(slot.chord.name));
    const String style = shorten(performanceName(sketch), 32), separator = " | ";
    const int chordBudget = 128 - name.length() - style.length() - 2 * separator.length();
    return name + separator + shorten(chords.joinIntoString(" - "), chordBudget) + separator + style;
}
var clipRecord(const Sketch &sketch, int index, double bpm, int meter) {
    auto clip = render(sketch, bpm, meter);
    if (clip.notes.size() > 65536)
        throw std::invalid_argument("A sketch exceeds the 65,536-note transfer limit.");
    Array<var> rows;
    rows.ensureStorageAllocated(int(clip.notes.size()));
    for (const auto &n : clip.notes)
        rows.add(Array<var>{n.startTick, n.endTick, n.pitch, n.velocity});
    auto obj = std::make_unique<DynamicObject>();
    obj->setProperty("ppq", composer::performancePPQ);
    obj->setProperty("ticks", clip.totalTicks);
    obj->setProperty("meter", clip.beatsPerBar);
    obj->setProperty("name", clipLabel(sketch, index));
    obj->setProperty("notes", var(std::move(rows)));
    return var(obj.release());
}
} // namespace
bool TimelineSend::hasSketches(const Book &book) {
    return std::any_of(book.sketches.begin(), book.sketches.begin() + sketchCount,
                       [](const Sketch &sketch) { return !sketch.slots.empty(); });
}
String TimelineSend::sendSketches(const Book &book, double bpm) {
    if (pending())
        return "Waiting for Live to finish the previous send.";
    if (!hasSketches(book))
        return "Add chords or rests to a Sketch lane first.";
    auto active = JSON::parse(host.getChildFile("active.json"));
    auto token = active["session"].toString();
    if (int(active["version"]) != 1 || token.length() != 32 || !token.containsOnly("0123456789abcdef"))
        return "Enable CrestTimeline in Live Settings > Link, Tempo & MIDI > Control Surface.";
    if (int(active["session_clips"]) != 1)
        return "Save your Set and restart Live to load the Session Clips update for CrestTimeline.";
    auto inbox = host.getChildFile(token);
    if (!inbox.isDirectory())
        return "CrestTimeline is not ready. Re-select the Control Surface in Live.";
    Array<var> clips;
    for (int i = 0; i < sketchCount; ++i)
        if (!book.sketches[i].slots.empty())
            clips.add(clipRecord(book.sketches[i], i, bpm, book.meter));
    auto obj = std::make_unique<DynamicObject>();
    obj->setProperty("op", "session-sketches");
    obj->setProperty("clips", var(std::move(clips)));
    obj->setProperty("session", token);
    deadline = Time::currentTimeMillis() + 10000;
    obj->setProperty("expires", var(int64(deadline)));
    auto path = inbox.getChildFile(Uuid().toString() + ".request");
    auto bytes = JSON::toString(var(obj.release()), true);
    if (bytes.getNumBytesAsUTF8() > 3 * 1024 * 1024)
        return "Sketch batch exceeds the 3 MiB Session transfer limit.";
    if (!path.replaceWithText(bytes))
        return "Could not hand the sketch clips to Live.";
    request = path;
    return "Sending labeled sketches to the selected Session clip slots...";
}
std::optional<String> TimelineSend::completion() {
    if (!pending())
        return {};
    auto reply = request.withFileExtension(".reply");
    if (reply.existsAsFile()) {
        auto result = JSON::parse(reply)["message"].toString();
        reply.deleteFile();
        request = File{};
        return result.isEmpty() ? String("No confirmation from Live. Check Session View before resending.")
                                : result;
    }
    if (Time::currentTimeMillis() <= deadline + 1000)
        return {};
    bool cancelled = request.existsAsFile() && request.deleteFile();
    request = File{};
    return cancelled ? String("Send expired. Check that CrestTimeline is enabled in this Live instance.")
                     : String("No confirmation from Live. Check Session View before resending.");
}
} // namespace crest
