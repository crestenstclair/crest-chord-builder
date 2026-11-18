#include "GuitarBridge.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstring>
#include <map>
#include <set>
#include <stdexcept>

namespace crest::guitar {
namespace {
using juce::String;
using juce::var;
using Notes = std::vector<int>;

constexpr size_t maxBytes = 2 * 1024 * 1024;
constexpr auto standardKey = "40,45,50,55,59,64";
constexpr std::array standardTuning { 40, 45, 50, 55, 59, 64 };
constexpr auto idChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";

void require(bool ok, const String& message) {
    if (!ok) throw std::invalid_argument(message.toStdString());
}

void require(bool ok, const char* message) {
    if (!ok) throw std::invalid_argument(message);
}

const juce::Array<var>& list(const var& v, int low, int high, const String& field) {
    require(v.isArray() && v.size() >= low && v.size() <= high, "Invalid " + field + " count.");
    return *v.getArray();
}

int number(const var& v, int low, int high, const String& field) {
    require(v.isInt() || v.isInt64() || v.isDouble(), "Expected number for " + field + ".");
    const auto n = static_cast<double>(v);
    require(n >= low && n <= high && n == std::floor(n), "Invalid " + field + ".");
    return static_cast<int>(n);
}

String text(const var& v, const String& field, bool blankAllowed = false, size_t limit = 120) {
    require(v.isString(), "Expected text for " + field + ".");
    const auto s = v.toString();
    // JavaScript's string.length counts UTF-16 code units.
    require((blankAllowed || s.trim().isNotEmpty()) &&
            juce::CharPointer_UTF16::getBytesRequiredFor(s.getCharPointer()) <= 2 * limit,
            "Invalid " + field + ".");
    return s;
}

String identifier(const var& v) {
    const auto id = text(v, "ID", false, 80);
    require(id.containsOnly(idChars), "Invalid ID characters.");
    return id;
}

bool namedScale(const String& id) {
    // Keys in web/music.js SCALES (not the display names).
    static const juce::StringArray ids { "minor", "major", "dorian", "phrygian", "lydian", "mixolydian", "locrian",
        "harmonic", "melodic", "majorPentatonic", "minorPentatonic", "minorBlues", "majorBlues", "harmonicMajor",
        "phrygianDominant", "lydianDominant", "altered", "doubleHarmonic", "hungarianMinor", "wholeTone",
        "diminishedWH", "diminishedHW", "chromatic" };
    return ids.contains(id);
}

Notes readNumbers(const var& v, int minSize, int maxSize, int low, int high, const String& field) {
    Notes result;
    for (const auto& n : list(v, minSize, maxSize, field)) result.push_back(number(n, low, high, field));
    return result;
}

Notes intervalsOf(const var& definition) {
    auto result = readNumbers(definition["intervals"], 1, 12, 0, 11, "intervals");
    std::sort(result.begin(), result.end());
    require(std::adjacent_find(result.begin(), result.end()) == result.end(), "Duplicate intervals.");
    return result;
}

struct Guitar {
    String tuningKey;
    int minFret, maxFret;
    bool open;
};

String joinNumbers(const Notes& numbers) {
    juce::StringArray words;
    for (auto n : numbers) words.add(String(n));
    return words.joinIntoString(",");
}

Guitar readGuitar(const var& v) {
    text(v["name"], "guitar name");
    auto strings = readNumbers(v["strings"], 1, 8, 0, 103, "guitar strings");
    const auto maxCapo = std::min(12, 103 - *std::max_element(strings.begin(), strings.end()));
    const int capo = number(v.getProperty("capo", 0), 0, maxCapo, "capo");
    for (auto& pitch : strings) pitch += capo;
    const auto position = v.getProperty("position", "any");
    const bool any = position.isString() && position.toString() == "any";
    const auto first = any ? 0 : number(position, 0, 21 - capo, "hand position");
    const auto allowOpen = v.getProperty("allowOpen", true);
    require(allowOpen.isBool(), "Invalid open-string setting.");
    return { joinNumbers(strings), std::max(1, first), any ? 24 - capo : std::max(4, first + 3), (bool) allowOpen };
}

Notes parseTuningKey(const String& key) {
    require(key.length() <= 31, "Invalid fingering tuning."); // 8 pitches of <=3 digits and 7 commas
    const auto words = juce::StringArray::fromTokens(key, ",", "");
    require(!words.isEmpty() && words.size() <= 8, "Invalid fingering tuning.");
    Notes tuning;
    for (const auto& word : words) {
        require(word.length() <= 3 && word.isNotEmpty() && word.containsOnly("0123456789"), "Invalid tuning key.");
        const auto pitch = word.getIntValue();
        require(pitch <= 103 && String(pitch) == word, "Invalid tuning key.");
        tuning.push_back(pitch);
    }
    return tuning;
}

Notes soundingPitches(const Notes& tuning, const Notes& frets, const Guitar& guitar) {
    Notes result;
    for (size_t i = 0; i < frets.size(); ++i) {
        const auto fret = frets[i];
        if (fret < 0) continue;
        if (fret == 0 ? !guitar.open : (fret < guitar.minFret || fret > guitar.maxFret)) return {};
        result.push_back(tuning[i] + fret);
    }
    std::sort(result.begin(), result.end()); // Re-entrant strings need not be ordered by pitch.
    return result;
}

Notes savedPitches(const var& value, const Guitar& guitar) {
    auto* snapshots = value.getDynamicObject();
    require(snapshots && snapshots->getProperties().size() <= 32, "Invalid fingering snapshots.");
    Notes result;
    for (const auto& property : snapshots->getProperties()) {
        const auto key = property.name.toString();
        auto tuning = parseTuningKey(key);
        const auto count = static_cast<int>(tuning.size());
        auto frets = readNumbers(property.value, count, count, -1, 24, "fingering frets");
        if (key == guitar.tuningKey) result = soundingPitches(tuning, frets, guitar);
    }
    return result;
}

bool has(const Notes& sorted, int pitch) {
    return std::binary_search(sorted.begin(), sorted.end(), pitch);
}

// As in web/music.js previewPitches: explicit extensions sit an octave higher.
// In the absence of spelling, infer those columns as in web/chord-formula.js.
bool inferredExtension(int interval, const Notes& tones) {
    const auto third = has(tones, 3) || has(tones, 4);
    switch (interval) {
        case 1: return true;
        case 2: return third || has(tones, 10) || has(tones, 11);
        case 3: return has(tones, 4);
        case 5: return third;
        case 6: return has(tones, 7);
        case 8: return !has(tones, 4) || has(tones, 7);
        case 9: return !(has(tones, 3) && has(tones, 6) && !has(tones, 10) && !has(tones, 11));
        default: return false;
    }
}

Notes extensionIntervals(const var& chord, const Notes& tones) {
    Notes extensions;
    if (!chord.hasProperty("formula")) {
        for (const auto tone : tones) if (inferredExtension(tone, tones)) extensions.push_back(tone);
        return extensions;
    }
    static const std::map<std::string, int> labels { {"1",0}, {"2",2}, {"♭3",3}, {"3",4}, {"4",5}, {"♭5",6},
        {"5",7}, {"♯5",8}, {"♭♭7",9}, {"♭7",10}, {"7",11}, {"♭9",1}, {"9",2}, {"♯9",3},
        {"11",5}, {"♯11",6}, {"♭13",8}, {"13",9} };
    Notes pitches;
    for (const auto& value : list(chord["formula"], 1, 12, "formula")) {
        const auto label = value.toString();
        const auto it = labels.find(label.toStdString());
        require(value.isString() && it != labels.end(), "Invalid chord formula label.");
        pitches.push_back(it->second);
        if (label.endsWith("9") || label.endsWith("11") || label.endsWith("13")) extensions.push_back(it->second);
    }
    std::sort(pitches.begin(), pitches.end());
    require(pitches == tones, "Chord formula does not match its intervals.");
    std::sort(extensions.begin(), extensions.end());
    return extensions;
}

Notes previewPitches(int root, int bass, const Notes& tones, const Notes& extensions) {
    Notes result;
    if (bass >= 0) result.push_back(36 + bass);
    for (auto tone : tones) result.push_back(48 + root + tone + (has(extensions, tone) ? 12 : 0));
    std::sort(result.begin(), result.end());
    return result;
}

String defaultName(int root, int bass, const Notes& tones) {
    static const juce::StringArray names { "C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B" };
    static const std::map<Notes, String> qualities { {{0,4,7},""}, {{0,3,7},"m"}, {{0,7},"5"}, {{0,3,6},"dim"},
        {{0,4,8},"aug"}, {{0,2,7},"sus2"}, {{0,5,7},"sus4"}, {{0,3,7,10},"m7"}, {{0,4,7,10},"7"},
        {{0,4,7,11},"maj7"}, {{0,3,6,9},"dim7"}, {{0,3,6,10},"m7b5"} };
    const auto found = qualities.find(tones);
    const auto suffix = found != qualities.end() ? found->second : " [" + joinNumbers(tones) + "]";
    return names[root] + suffix + (bass >= 0 && bass != root ? "/" + names[bass] : "");
}

Chord readChord(const var& v, const Guitar& guitar) {
    const auto root = number(v["root"], 0, 11, "chord root");
    const auto bass = number(v["bass"], -1, 11, "bass");
    const auto tones = intervalsOf(v);
    require(bass < 0 || has(tones, (bass - root + 12) % 12), "Bass is not a chord tone.");
    const auto extensions = extensionIntervals(v, tones);
    auto notes = savedPitches(v["fingerings"], guitar);
    const auto soundingBass = notes.empty() ? bass : notes.front() % 12;
    if (notes.empty()) notes = previewPitches(root, bass, tones, extensions);
    const auto label = text(v["label"], "chord label", true);
    return { label.isEmpty() ? defaultName(root, soundingBass, tones) : label, root, std::move(notes) };
}

// Validate optional sheet data as inert text; no attachment is decoded or run.
void validateAttachment(const var& file, std::set<String>& names) {
    const auto name = text(file["name"], "attachment name");
    require(name.substring(0, 1).containsOnly("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_") &&
            name.containsOnly(String(idChars) + " .") && names.insert(name).second, "Invalid or repeated attachment filename.");
    static const juce::StringArray mimes { "application/json", "text/plain", "text/markdown", "text/html", "text/css",
        "text/javascript", "image/svg+xml", "image/png", "image/jpeg", "image/webp" };
    auto mime = text(file["mime"], "attachment type");
    require(mimes.contains(mime), "Unsupported attachment type.");
    const bool binary = mime == "image/png" || mime == "image/jpeg" || mime == "image/webp";
    require(text(file["encoding"], "attachment encoding") == (binary ? "base64" : "utf8"), "Incorrect attachment encoding.");
    const auto content = text(file["content"], "attachment content", true, maxBytes);
    if (!binary) {
        require(content.getNumBytesAsUTF8() <= 512 * 1024, "Attachment exceeds 512 KiB.");
        return;
    }
    int n = content.length();
    int padding = content.endsWith("==") ? 2 : int(content.endsWithChar('='));
    require(n % 4 == 0 && n * 3 / 4 <= 512 * 1024 && content.substring(0, n - padding).containsOnly(
                "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/"), "Invalid base64 image attachment.");
}

void validateSheet(const var& sheet) {
    const auto format = text(sheet["format"], "sheet format");
    require(format == "markdown" || format == "html", "Unsupported sheet format.");
    const auto& layout = sheet["layout"];
    require(layout.isVoid() || (layout.isString() && (layout.toString() == "append" || layout.toString() == "replace")), "Unknown sheet layout.");
    text(sheet["source"], "sheet source", true, 200000);
    if (const auto& files = sheet["files"]; !files.isVoid()) {
        std::set<String> names;
        for (const auto& file : list(files, 0, 32, "sheet attachments")) validateAttachment(file, names);
    }
}

Part readPart(const var& v, const std::map<String, Guitar>& guitars) {
    const auto guitar = guitars.find(identifier(v["guitarId"]));
    require(guitar != guitars.end(), "Part refers to a missing guitar.");
    Part part { text(v["name"], "part name"), number(v["root"], 0, 11, "scale tonic"), text(v["scale"], "scale ID"), {} };
    if (part.scale == "custom") {
        const auto& scale = v["customScale"];
        text(scale["name"], "custom scale name");
        require(has(intervalsOf(scale), 0), "Custom scale must include the tonic.");
    } else require(namedScale(part.scale), "Unknown Builder scale ID: " + part.scale);
    if (v.hasProperty("sheet")) validateSheet(v["sheet"]);
    std::set<String> ids;
    for (const auto& chord : list(v["chords"], 0, 64, "part chords")) {
        require(ids.insert(identifier(chord["id"])).second, "Duplicate chord ID in " + part.name + ".");
        part.chords.push_back(readChord(chord, guitar->second));
    }
    return part;
}

const char* afterString(const char* p) {
    while (*p != '"') {
        const auto c = static_cast<unsigned char>(*p++);
        require(c >= 0x20, "Unterminated JSON string or invalid control character.");
        if (c != '\\') continue;
        const char escape = *p++;
        require(escape && std::strchr("\"\\/bfnrtu", escape), "Unknown JSON escape sequence.");
        if (escape == 'u') {
            for (int i = 0; i < 4; ++i, ++p)
                require(*p && std::strchr("0123456789abcdefABCDEF", *p), "Invalid JSON Unicode escape.");
        }
    }
    return p + 1;
}

bool digit(char c) { return c >= '0' && c <= '9'; }

const char* afterNumber(const char* p) {
    if (*p == '-') ++p;
    require(digit(*p), "Invalid JSON number.");
    auto first = p;
    if (*p == '0') ++p;
    else while (digit(*p)) ++p;
    // JUCE accumulates the initial digits in an int64 before looking for '.' or 'e'.
    require(p - first <= 18, "Project integer is too large.");
    if (*p == '.') {
        require(digit(*++p), "Invalid JSON fraction.");
        while (digit(*p)) ++p;
    }
    if (*p == 'e' || *p == 'E') {
        ++p;
        if (*p == '+' || *p == '-') ++p;
        require(digit(*p), "Invalid JSON exponent.");
        while (digit(*p)) ++p;
    }
    require(std::strchr(" \t\r\n,}]", *p) != nullptr, "Invalid JSON number terminator.");
    return p;
}

// JUCE handles the object/array grammar, but accepts some non-JSON tokens and
// trailing text. Check strict token spelling and cap depth before it recurses.
void checkEnvelope(const String& json) {
    require(json.getNumBytesAsUTF8() <= maxBytes, "Project exceeds 2 MiB.");
    int depth = 0;
    bool complete = false;
    char previous = 0;
    for (const char* p = json.toRawUTF8(); *p;) {
        char c = *p++;
        if (std::strchr(" \t\r\n", c)) continue;
        require(!complete, "Trailing text after project JSON.");
        if (c == '"') p = afterString(p);
        else if (c == '-' || digit(c)) p = afterNumber(p - 1);
        else require(std::strchr("{}[]:,truefalsn", c) != nullptr, "Invalid JSON token.");
        if (c == '{' || c == '[') require(++depth <= 64, "Project JSON nested too deeply.");
        if (c == '}' || c == ']') {
            require(previous != ',' && depth > 0, "Invalid JSON delimiter.");
            complete = (--depth == 0);
        }
        previous = c;
    }
    require(complete, "Incomplete project JSON.");
}

using Grip = std::array<int, 6>;

// Up to four independent fretted notes, or a barre at the lowest fret plus
// up to three others. The barre cannot cross a sounding open string.
bool reachable(const Grip& grip) {
    const int fingers = (int) std::count_if(grip.begin(), grip.end(), [](int f) { return f > 0; });
    if (fingers <= 4) return true;
    int lowest = 25;
    for (auto f : grip) if (f > 0) lowest = std::min(lowest, f);
    int barred = 0;
    for (auto f : grip) {
        if (f == 0) barred = 0;
        if (f == lowest && fingers - ++barred + 1 <= 4) return true;
    }
    return false;
}

bool placeNotes(const Notes& notes, size_t index, int position, Grip& grip) {
    if (index == notes.size()) return reachable(grip);
    for (size_t s = 0; s < grip.size(); ++s) {
        const int fret = notes[index] - standardTuning[s];
        if (grip[s] != -1 || (fret != 0 && (fret < position || fret >= position + 4))) continue;
        grip[s] = fret;
        if (placeNotes(notes, index + 1, position, grip)) return true;
        grip[s] = -1;
    }
    return false;
}

template<typename Range>
var numbers(const Range& range) {
    juce::Array<var> result;
    for (auto n : range) result.add(n);
    return var(std::move(result));
}

var object(std::initializer_list<std::pair<juce::Identifier, var>> fields = {}) {
    auto result = var(new juce::DynamicObject());
    for (const auto& [key, value] : fields) result.getDynamicObject()->setProperty(key, value);
    return result;
}

var standardFingering(const Notes& pitches) {
    Grip grip { -1, -1, -1, -1, -1, -1 };
    if (pitches.size() <= grip.size()) {
        for (int position = 1; position <= 21; ++position)
            if (placeNotes(pitches, 0, position, grip)) return object({ { standardKey, numbers(grip) } });
    }
    return object();
}

var writeChord(const Chord& chord, int index) {
    require(!chord.notes.empty(), "Builder chords cannot represent a rest. Remove the rest before exporting.");
    const auto root = number(chord.root, 0, 11, "chord root pitch class");
    std::set<int> tones;
    for (auto pitch : chord.notes) {
        require(pitch >= 0 && pitch <= 127, "Chord pitch outside MIDI 0-127.");
        tones.insert((pitch - root + 12) % 12);
    }
    const int bass = *std::min_element(chord.notes.begin(), chord.notes.end()) % 12;
    return object({ {"id", "chord-" + String(index)}, {"root", root}, {"intervals", numbers(tones)}, {"bass", bass},
        {"label", text(chord.name, "chord label", true)}, {"fingerings", standardFingering(chord.notes)} });
}

var writePart(const Part& part, int index) {
    require(part.chords.size() <= 8, "A Composer sketch can contain at most eight chords.");
    require(namedScale(part.scale), "Cannot export a custom or unknown scale without its Builder definition.");
    juce::Array<var> chords;
    for (const auto& chord : part.chords) chords.add(writeChord(chord, chords.size() + 1));
    return object({ {"id", "part-" + String(index)}, {"name", text(part.name, "part name")}, {"guitarId", "standard"},
        {"root", number(part.tonic, 0, 11, "scale tonic pitch class")}, {"scale", part.scale}, {"chords", var(std::move(chords))} });
}
} // namespace

std::vector<Part> readProject(const String& json) {
    checkEnvelope(json);
    var project;
    const auto parsed = juce::JSON::parse(json, project);
    require(parsed.wasOk(), "Invalid project JSON: " + parsed.getErrorMessage());
    require(project["format"].isString() && project["format"].toString() == "crest-chord-builder", "Expected a Crest Chord Builder project.");
    number(project["version"], 1, 3, "Builder version (expected 1, 2 or 3)");
    text(project["title"], "project title");
    std::map<String, Guitar> guitars;
    for (const auto& v : list(project["guitars"], 1, 16, "guitars")) {
        require(guitars.emplace(identifier(v["id"]), readGuitar(v)).second, "Duplicate guitar ID.");
    }
    std::vector<Part> parts;
    std::set<String> ids;
    for (const auto& v : list(project["parts"], 1, 100, "parts")) {
        require(ids.insert(identifier(v["id"])).second, "Duplicate part ID.");
        parts.push_back(readPart(v, guitars));
    }
    return parts;
}

String writeProject(const std::vector<Part>& parts) {
    require(!parts.empty() && parts.size() <= 100, "Export requires 1-100 parts.");
    juce::Array<var> result;
    for (const auto& part : parts) result.add(writePart(part, result.size() + 1));
    auto guitar = object({ {"id", "standard"}, {"name", "Standard six"}, {"strings", numbers(standardTuning)} });
    auto project = object({ {"format", "crest-chord-builder"}, {"version", 3}, {"title", "Composer sketch"},
        {"guitars", var(juce::Array<var> { guitar })}, {"parts", var(std::move(result))} });
    auto json = juce::JSON::toString(project);
    require(json.getNumBytesAsUTF8() <= maxBytes, "Export exceeds Builder's 2 MiB limit.");
    return json;
}

} // namespace crest::guitar
