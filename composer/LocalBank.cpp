#include "LocalBank.h"
using namespace juce;
namespace crest {
namespace {
int integer(const var &value, int low, int high) {
    const int n = static_cast<int>(value);
    if (!value.isInt() || n < low || n > high)
        throw std::invalid_argument("Invalid integer in bank index");
    return n;
}
const Array<var> &items(const var &value, int limit) {
    const auto *array = value.getArray();
    if (!array || array->size() > limit)
        throw std::invalid_argument("Invalid list in bank index");
    return *array;
}
BankSet readSet(const var &data) {
    BankSet set;
    set.name = data["name"].toString();
    set.group = data["group"].toString();
    set.tonic = integer(data.getProperty("tonic", 0), 0, 11);
    for (auto &item : items(data["slots"], 8)) {
        harmony::Chord chord;
        chord.root = 48 + integer(item["root"], 0, 11);
        chord.name = item["name"].toString().toStdString();
        for (auto &n : items(item["notes"], 16))
            chord.pitches.push_back(integer(n, 12, 115));
        std::sort(chord.pitches.begin(), chord.pitches.end());
        chord.pitches.erase(std::unique(chord.pitches.begin(), chord.pitches.end()), chord.pitches.end());
        if (chord.pitches.empty())
            throw std::invalid_argument("Empty chord in local bank");
        set.reference.push_back(std::move(chord));
    }
    return set;
}
std::string labelFor(const harmony::Chord &chord) {
    const auto signature = [&](const auto &p) {
        int mask = 0;
        for (int n : p)
            mask |= (1 << ((n % 12 - chord.root % 12 + 12) % 12));
        return mask;
    };
    const int notes = signature(chord.pitches);
    auto root = harmony::noteName(chord.root);
    auto name = root + " color";
    for (auto &c : harmony::variations({root, chord.root, {chord.root}}))
        if (c.root == chord.root && signature(c.pitches) == notes) {
            name = c.name;
            break;
        }
    const int bass = chord.pitches.front() % 12;
    if (bass != chord.root % 12)
        name += "/" + harmony::noteName(bass);
    return name;
}
} // namespace
std::vector<harmony::Chord> BankSet::transposeTo(int pc) const {
    int shift = (pc - tonic + 18) % 12 - 6;
    auto result = reference;
    for (auto &chord : result) {
        for (int &pitch : chord.pitches)
            pitch += shift;
        chord.root += shift;
        chord.name = labelFor(chord);
    }
    return result;
}
std::optional<harmony::Chord> BankSet::colorDegree(harmony::Scale scale, int column) const {
    // Most reference rows start in C major; two start in C natural minor.
    // Rotate through the source mode before transposing the actual grip.
    constexpr int starts[]{0, 1, 2, 3, 4, 5, 6, 5};
    if (reference.size() < 7 || column < 0 || column > 6)
        return {};
    const int sourceMode = (reference[2].root - reference[0].root + 12) % 12 == 3 ? 5 : 0;
    const int first = (starts[int(scale.mode)] - sourceMode + 7) % 7;
    const int sourceTonic = (scale.tonic - reference[first].root % 12 + tonic + 12) % 12;
    auto chord = transposeTo(sourceTonic)[size_t((first + column) % 7)];
    if (scale.mode == harmony::Mode::HarmonicMinor) {
        const int plainSeventh = (scale.tonic + 10) % 12;
        for (auto &pitch : chord.pitches)
            if (pitch % 12 == plainSeventh)
                ++pitch;
        if (chord.root % 12 == plainSeventh)
            ++chord.root;
        std::sort(chord.pitches.begin(), chord.pitches.end());
        chord.pitches.erase(std::unique(chord.pitches.begin(), chord.pitches.end()), chord.pitches.end());
        chord.name = labelFor(chord);
    }
    return chord;
}
File LocalBank::defaultFolder() {
    return File::getSpecialLocation(File::userHomeDirectory)
        .getChildFile("Library/Application Support/Crest Composer/Local Bank");
}
LocalBank LocalBank::read(const File &directory) {
    auto file = directory.getChildFile("index.json");
    if (!file.existsAsFile())
        throw std::runtime_error(
            "Local bank missing. Run python3 composer/tools/index_scaler.py, then reopen Local bank.");
    if (file.getSize() > 4 * 1024 * 1024)
        throw std::runtime_error("Local bank index exceeds size limit.");
    auto index = JSON::parse(file);
    integer(index["version"], 1, 1);
    LocalBank bank;
    auto motionDir = directory.getChildFile("motions");
    for (auto &m : items(index["motions"], 10000)) {
        auto path = m["midi"].toString();
        auto leaf = path.fromLastOccurrenceOf("/", false, false);
        if (path != "motions/" + leaf || !leaf.endsWithIgnoreCase(".mid") || leaf.containsAnyOf(":\\"))
            throw std::invalid_argument("Invalid MIDI path in bank");
        bank.motions.push_back(
            {m["name"].toString(), m["family"].toString(), m["group"].toString(), motionDir.getChildFile(leaf)});
    }
    for (auto &p : items(index["progressions"], 1000))
        bank.progressions.push_back(readSet(p));
    if (index.hasProperty("colors"))
        for (auto &p : items(index["colors"], 100))
            bank.colors.push_back(readSet(p));
    return bank;
}
} // namespace crest
