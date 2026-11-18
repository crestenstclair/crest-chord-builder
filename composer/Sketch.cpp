#include "Sketch.h"
#include <algorithm>
#include <stdexcept>

namespace crest {
using namespace juce;
namespace {
void require(bool condition, const char *reason) {
    if (!condition)
        throw std::invalid_argument(reason);
}
int number(const XmlElement &xml, const String &key, int low, int high) {
    const auto text = xml.getStringAttribute(key);
    int result = text.getIntValue();
    require(text == String(result) && low <= result && result <= high, "Invalid numeric property in sketch");
    return result;
}
std::unique_ptr<XmlElement> saveSketch(const Sketch &sketch) {
    auto xml = std::make_unique<XmlElement>("sketch");
    xml->setAttribute("name", sketch.name);
    xml->setAttribute("tonic", sketch.scale.tonic);
    xml->setAttribute("mode", static_cast<int>(sketch.scale.mode));
    xml->setAttribute("performance", String(sketch.performance));
    xml->setAttribute("perform", int(sketch.perform));
    xml->setAttribute("groupVoices", int(sketch.groupVoices));
    xml->setAttribute("speed", sketch.speed);
    xml->setAttribute("swing", sketch.swing);
    if (!sketch.templateMidi.empty()) {
        xml->setAttribute("template", Base64::toBase64(sketch.templateMidi.data(), sketch.templateMidi.size()));
        xml->setAttribute("templateName", sketch.templateName);
    }
    for (const auto &slot : sketch.slots) {
        auto *item = xml->createNewChildElement("slot");
        item->setAttribute("name", String(slot.chord.name));
        item->setAttribute("root", slot.chord.root);
        item->setAttribute("quarterBars", slot.quarterBars);
        StringArray notes;
        for (int pitch : slot.chord.pitches)
            notes.add(String(pitch));
        item->setAttribute("notes", notes.joinIntoString(","));
    }
    return xml;
}
Slot readSlot(const XmlElement &item) {
    require(item.hasTagName("slot"), "Unknown slot type");
    Slot slot;
    slot.quarterBars = number(item, "quarterBars", 1, 16);
    slot.chord.root = number(item, "root", 0, 127);
    slot.chord.name = item.getStringAttribute("name").substring(0, 120).toStdString();
    auto notes = StringArray::fromTokens(item.getStringAttribute("notes"), ",", "");
    notes.removeEmptyStrings();
    require(notes.size() <= 16, "Too many pitches");
    for (const auto &text : notes) {
        const auto pitch = text.getIntValue();
        require(text == String(pitch) && pitch >= 0 && pitch < 128, "Invalid saved pitch");
        slot.chord.pitches.push_back(pitch);
    }
    require(std::is_sorted(slot.chord.pitches.begin(), slot.chord.pitches.end()), "Unordered saved pitches");
    return slot;
}
Sketch readSketch(const XmlElement &xml) {
    require(xml.hasTagName("sketch") && xml.getNumChildElements() <= slotLimit, "Invalid sketch length");
    Sketch sketch;
    sketch.name = xml.getStringAttribute("name").substring(0, 120);
    sketch.scale = {number(xml, "tonic", 36, 71), static_cast<harmony::Mode>(number(xml, "mode", 0, 7))};
    sketch.performance = xml.getStringAttribute("performance").toStdString();
    if (xml.hasAttribute("perform"))
        sketch.perform = number(xml, "perform", 0, 1) != 0;
    if (xml.hasAttribute("groupVoices"))
        sketch.groupVoices = number(xml, "groupVoices", 0, 1) != 0;
    if (xml.hasAttribute("speed"))
        sketch.speed = number(xml, "speed", 0, 2);
    if (xml.hasAttribute("swing"))
        sketch.swing = number(xml, "swing", 50, 75);
    if (xml.hasAttribute("template")) {
        MemoryOutputStream midi;
        require(Base64::convertFromBase64(midi, xml.getStringAttribute("template")) &&
                    midi.getDataSize() <= maxTemplateBytes,
                "Invalid template data");
        auto *start = static_cast<const uint8_t *>(midi.getData());
        sketch.templateMidi.assign(start, start + midi.getDataSize());
        composer::importPerformanceMidi(sketch.templateMidi);
        sketch.templateName = xml.getStringAttribute("templateName").substring(0, 120);
    }
    const auto &bank = composer::performanceCatalog();
    const bool factory =
        std::any_of(bank.begin(), bank.end(), [&](const auto &p) { return p.id == sketch.performance; });
    require(factory || (sketch.performance == "import" && !sketch.templateMidi.empty()), "Unknown performance");
    for (auto *slot : xml.getChildIterator())
        sketch.slots.push_back(readSlot(*slot));
    return sketch;
}
} // namespace

Book::Book() {
    for (int i = 0; i < sketchCount; ++i)
        sketches[i].name = "Sketch " + String(i + 1);
    sketches[mainLane].name = "Main Track";
}
const std::array<ModeInfo, 8> &modes() {
    using M = harmony::Mode;
    static const std::array<ModeInfo, 8> items{{{"Major", "major", M::Major},
                                                {"Dorian", "dorian", M::Dorian},
                                                {"Phrygian", "phrygian", M::Phrygian},
                                                {"Lydian", "lydian", M::Lydian},
                                                {"Mixolydian", "mixolydian", M::Mixolydian},
                                                {"Natural minor", "minor", M::NaturalMinor},
                                                {"Locrian", "locrian", M::Locrian},
                                                {"Harmonic minor", "harmonic", M::HarmonicMinor}}};
    return items;
}
String performanceName(const Sketch &sketch) {
    if (!sketch.perform)
        return "Block chords";
    if (sketch.performance == "import")
        return sketch.templateName.isEmpty() ? String("Imported MIDI") : sketch.templateName;
    for (const auto &p : composer::performanceCatalog())
        if (p.id == sketch.performance) return p.name;
    return "Block chords";
}
composer::PerformanceRender render(const Sketch &sketch, double bpm, int meter) {
    std::vector<composer::PerformanceSlot> slots;
    const double speed = sketch.perform ? std::array{.5, 1., 2.}.at(size_t(sketch.speed)) : 1.;
    std::vector<int> previous;
    for (const auto &slot : sketch.slots) {
        auto notes = slot.chord.pitches;
        if (sketch.groupVoices && !notes.empty()) {
            notes = harmony::dynamicVoicing(slot.chord, previous).pitches;
            previous = notes;
        }
        slots.push_back({std::move(notes), speed * meter * slot.quarterBars / 4.0});
    }
    auto clip =
        sketch.perform && sketch.performance == "import"
            ? composer::renderPerformance(slots, composer::importPerformanceMidi(sketch.templateMidi), bpm, meter)
            : composer::renderPerformance(slots, sketch.perform ? sketch.performance : "block", bpm, meter);
    if (speed == 1. && sketch.swing == 50)
        return clip;
    clip.totalTicks = int(std::lround(clip.totalTicks / speed));
    const auto warp = [&](int source) {
        const double tick = source / speed;
        const int ppq = composer::performancePPQ;
        const double f = std::fmod(tick, ppq) / ppq, mid = sketch.swing / 100.;
        return int(std::lround(
            (std::floor(tick / ppq) + (f < .5 ? 2 * f * mid : mid + 2 * (f - .5) * (1. - mid))) * ppq));
    };
    for (auto &tick : clip.slotStarts)
        tick = std::clamp(warp(tick), 0, clip.totalTicks - 1);
    for (auto &n : clip.notes) {
        n.startTick = std::clamp(warp(n.startTick), 0, clip.totalTicks - 1);
        n.endTick = std::clamp(warp(n.endTick), n.startTick + 1, clip.totalTicks);
    }
    return clip;
}
String encode(const Book &book) {
    XmlElement xml("CrestComposer");
    xml.setAttribute("version", 2);
    xml.setAttribute("bound", book.bound);
    xml.setAttribute("page", book.page);
    xml.setAttribute("colors", book.colorSettings);
    xml.setAttribute("active", book.active);
    xml.setAttribute("bpm", book.bpm);
    xml.setAttribute("meter", book.meter);
    xml.setAttribute("host", int(book.hostTempo));
    for (const auto &sketch : book.sketches)
        xml.addChildElement(saveSketch(sketch).release());
    return xml.toString();
}
Book decode(const String &text) {
    require(text.length() < 2000000, "Project exceeds size limit");
    auto xml = parseXML(text);
    require(xml && xml->hasTagName("CrestComposer"), "Invalid sketchbook");
    const int version = number(*xml, "version", 1, 2), rows = version == 1 ? sketchCount : laneCount;
    require(xml->getNumChildElements() == rows, "Invalid sketchbook lanes");
    Book book;
    if (version >= 2) {
        book.bound = number(*xml, "bound", -1, mainLane);
        book.page = number(*xml, "page", 0, 4);
        book.colorSettings = xml->getStringAttribute("colors").substring(0, 2048);
    }
    book.active = number(*xml, "active", 0, rows - 1);
    book.bpm = number(*xml, "bpm", 30, 300);
    book.meter = number(*xml, "meter", 3, 4);
    book.hostTempo = number(*xml, "host", 0, 1) != 0;
    int i = 0;
    for (auto *row : xml->getChildIterator())
        book.sketches[i++] = readSketch(*row);
    return book;
}
} // namespace crest
