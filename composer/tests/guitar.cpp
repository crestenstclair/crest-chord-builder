#include "GuitarBridge.h"

#include <iostream>
#include <stdexcept>

namespace {
using namespace crest::guitar;
using juce::String;
using Notes = std::vector<int>;

void check(bool condition, const char* message) {
    if (!condition) throw std::runtime_error(message);
}

template<typename Fn>
void expectRejection(Fn fn, const char* reason) {
    try { fn(); } catch (const std::invalid_argument&) { return; }
    throw std::runtime_error(reason);
}

const String v3 = R"({"format":"crest-chord-builder","version":3,"title":"Session",
"guitars":[{"id":"uke","name":"High G","strings":[67,60,64,69],"capo":2,"allowOpen":true,"position":0}],
"parts":[{"id":"intro","name":"Intro","guitarId":"uke","root":9,"scale":"harmonic","chords":[
{"id":"reentrant","root":2,"bass":-1,"label":"Concert chord","intervals":[0,4,7],
"fingerings":{"67,60,64,69":[-1,2,2,0],"69,62,66,71":[0,0,3,-1]}},
{"id":"unsaved","root":2,"bass":6,"label":"","intervals":[0,2,4,7,10],
"formula":["1","2","3","5","\u266d7"],"fingerings":{"67,60,64,69":[0,0,0,0]}}
]},{"id":"outro","name":"Outro","guitarId":"uke","root":3,"scale":"wholeTone","chords":[]}]})";

void importVersions() {
    // The shipped v1 file predates both the guitar settings and optional formula.
    const auto testFile = juce::File::getCurrentWorkingDirectory().getChildFile(__FILE__);
    const auto example = testFile.getSiblingFile("../../examples/first-idea.json").loadFileAsString();
    const auto old = readProject(example);
    check(old.size() == 1 && old[0].chords.size() == 4, "v1 example lost a chord");
    check(old[0].chords[0].name == "Am7" && old[0].chords[0].notes == Notes {45,52,55,60,64}, "wrong saved Am7");
    check(old[0].chords[1].name == "Fmaj7" && old[0].chords[1].notes == Notes {53,57,60,64}, "wrong v1 preview");

    for (int version : {2, 3}) {
        const auto parts = readProject(v3.replace("\"version\":3", "\"version\":" + String(version)));
        check(parts.size() == 2 && parts[0].tonic == 9 && parts[0].scale == "harmonic" && parts[1].chords.empty(), "parts or key lost");
        const auto& saved = parts[0].chords[0];
        check(saved.name == "Concert chord" && saved.root == 2 && saved.notes == Notes {62,69,69}, "capo, re-entrant bass or unison lost");
        check(parts[0].chords[1].notes == Notes {42,50,52,54,57,60}, "bass or explicit suspension lost in preview");
    }
    auto filtered = readProject(v3.replace("\"allowOpen\":true", "\"allowOpen\":false"));
    check(filtered[0].chords[0].notes == Notes {50,54,57}, "open strings bypassed a guitar filter");
    filtered = readProject(v3.replace("\"position\":0", "\"position\":7"));
    check(filtered[0].chords[0].notes == Notes {50,54,57}, "position filter ignored");
    filtered = readProject(v3.replace("[0,0,3,-1]", "[-1,-1,-1,-1]"));
    check(filtered[0].chords[0].notes == Notes {50,54,57}, "all-muted grip interpreted as a rest");
    auto inferred = readProject(v3.replace("\"2\",\"3\"", "\"9\",\"3\""));
    check(inferred[0].chords[1].notes == Notes {42,50,54,57,60,64}, "extension not raised an octave");
}

std::vector<Part> exportExample() {
    return { { "Verse", 9, "harmonic", {
        { "Am7", 9, {45,52,55,60,64} },
        { "Rootless C9/E", 0, {52,58,62,67} },
        { "Low cluster", 0, {12,13,14} }
    } }, { "Unison", 5, "major", {{ "Doubled", 4, {64,64} }} } };
}

void exportSketches() {
    const auto json = writeProject(exportExample());
    const auto parts = readProject(json);
    check(parts.size() == 2 && parts[1].name == "Unison", "export lost part or order");
    check(parts[0].chords[0].notes == Notes {45,52,55,60,64}, "reachable notes did not round trip");
    check(parts[0].chords[1].notes == Notes {52,58,62,67} && parts[0].chords[1].root == 0, "rootless slash chord changed");
    const auto doc = juce::JSON::parse(json);
    const auto& chords = doc["parts"][0]["chords"];
    check((int)chords[1]["bass"] == 4 && (int)chords[1]["intervals"][0] == 2, "invented root or wrong bass");
    check(chords[0]["fingerings"].hasProperty("40,45,50,55,59,64"), "missing standard grip");
    check(chords[2]["fingerings"].getDynamicObject()->getProperties().size() == 0, "fabricated impossible grip");
    check((int)chords[2]["intervals"].size() == 3, "lost impossible chord's tones");
    check(parts[1].chords[0].notes == Notes {64,64}, "reachable doubled MIDI pitch lost");
}

void lengthsAndErrors() {
    Part boundary { "Long", 0, "major", {} };
    boundary.chords.resize(8, { "C", 0, {60,64,67} });
    auto project = juce::JSON::parse(writeProject({boundary, exportExample()[1]}));
    // Builder allows 64 chords per part. A different, legal sketch must remain selectable.
    auto list = project["parts"][0]["chords"];
    auto ninth = list[0].clone();
    ninth.getDynamicObject()->setProperty("id", "extra");
    list.append(ninth);
    const auto imported = readProject(juce::JSON::toString(project));
    check(imported[0].chords.size() == 9 && imported[1].chords.size() == 1, "oversize silently truncated or other parts lost");
    expectRejection([&]{ writeProject(imported); }, "export accepted an oversized sketch");
    boundary.chords[3].notes.clear();
    expectRejection([&]{ writeProject({boundary}); }, "export silently omitted rest");
    boundary.chords[3].notes = {128};
    expectRejection([&]{ writeProject({boundary}); }, "export accepted invalid MIDI");
    const auto custom = readProject(v3.replace("\"wholeTone\"", "\"custom\",\"customScale\":{\"name\":\"Custom\",\"intervals\":[0,1,5]}"));
    check(custom[1].scale == "custom", "lost custom scale marker");
    expectRejection([&]{ writeProject(custom); }, "invented custom scale definition");
    auto withSheet = v3.replace("\"id\":\"outro\"", R"("sheet":{"format":"markdown","source":"# Notes","files":[{"name":"fig.png","mime":"image/png","encoding":"base64","content":"Zg=="}]},"id":"outro")");
    check(readProject(withSheet)[1].name == "Outro", "valid practice sheet prevented import");
    for (auto bad : { v3 + " invalid", v3.replace("\"version\":3", "\"version\":4"), v3.replace("\"guitarId\":\"uke\"", "\"guitarId\":\"x\""),
        v3.replace("wholeTone", "harmonicMinor"), v3.replace("\"capo\":2", "\"capo\":13"), v3.replace("67,60,64,69\":[-1", "067,60,64,69\":[-1"),
        v3.replace("[-1,2,2,0]", "[25,2,2,0]"), v3.replace("[0,2,4,7,10]", "[0,4,4,7,10]"), v3.replace("\"bass\":6", "\"bass\":8"),
        v3.replace("\\u266d7", "7"), v3.replace("\"id\":\"outro\"", "\"id\":\"intro\""), v3.replace("[0,0,3,-1]", "[0,3]"),
        v3.replace("[0,0,3,-1]", "[false,0,3,-1]"), v3.replace("[0,0,3,-1]", "[0,0,03,-1]"),
        v3.replace("\"Intro\"", "\"\\qIntro\""), v3.replace("[0,0,3,-1]", "[0,0,3,-1,]"), withSheet.replace("Zg==", "Z===") }) {
        expectRejection([&]{ readProject(bad); }, "accepted invalid Builder project");
    }
}
} // namespace

int main(int argc, char** argv) {
    try {
        if (argc == 2 && String(argv[1]) == "--emit") {
            std::cout << writeProject(exportExample()).toStdString();
            return 0;
        }
        importVersions();
        exportSketches();
        lengthsAndErrors();
        std::cout << "PASS: guitar import/export, sounding pitches, limits and validation\n";
        return 0;
    } catch (const std::exception& e) { std::cerr << e.what() << '\n'; return 1; }
}
