#include "HarmonicAtlas.h"
#include <iostream>

using namespace crest;
using namespace juce;
namespace {
void check(bool ok, const char* message) { if (!ok) throw std::runtime_error(message); }
Component* find(Component& parent, const String& id) {
    for (auto* c : parent.getChildren()) if (c->isVisible()) {
        if (c->getComponentID() == id) return c;
        if (auto* nested = find(*c,id)) return nested;
    }
    return nullptr;
}
template<class T> T& control(Component& root, String id) {
    auto* c = dynamic_cast<T*>(find(root,"atlas." + id));
    if (!c || !c->isEnabled()) throw std::runtime_error("Missing or disabled control: " + id.toStdString());
    return *c;
}
void click(Component& root, String id) { control<Button>(root,id).onClick(); }
void snapshot(Component& atlas, const File& directory, String name) {
    if (directory == File{}) return;
    FileOutputStream stream(directory.getChildFile(name + ".png"));
    check(stream.openedOk() && stream.setPosition(0) && stream.truncate().wasOk(), "snapshot stream");
    check(PNGImageFormat().writeImageToStream(atlas.createComponentSnapshot(atlas.getLocalBounds()), stream), "snapshot");
}
void exercise(bool installed, File output) {
    HarmonicAtlas a;
    int selected = 0, inserted = 0, applied = 0;
    harmony::Chord preview, saved; harmony::Scale key;
    a.onChoose = [&](const auto& c){ preview = c; ++selected; };
    a.onInsert = [&](const auto& c){ saved = c; ++inserted; };
    a.onScale = [&](auto s){ key = s; ++applied; };
    a.setScale({57,harmony::Mode::NaturalMinor}); a.setContextChord(harmony::Chord{"Dm",50,{50,53,57}});
    check(!selected && !inserted && !applied,"host context caused callback");
    snapshot(a,output,"circle");
    auto& search = control<TextEditor>(a,"search"); search.setText("G7/B",false); search.onTextChange();
    click(a,"row.2.0"); check(preview.pitches == std::vector<int>{47,55,59,62,65},"slash chord search changed root/bass");
    control<ComboBox>(a,"octave").setSelectedId(4,sendNotificationSync); click(a,"insert");
    check(saved.pitches == std::vector<int>{59,67,71,74,77} && inserted == 1 && !applied,"octave/commit separation");
    a.setView(HarmonicAtlas::View::Modulation); click(a,"wheel.1"); snapshot(a,output,"modulation");
    check(!applied,"selecting a destination changed the song key"); click(a,"apply");
    check(applied == 1 && key.tonic%12 == 7 && key.mode == harmony::Mode::Major,"apply did not use destination");
    click(a,"row.1.1"); check(preview.root%12 == 2 && preview.pitches.size()==4,"missing dominant of G");
    a.setView(HarmonicAtlas::View::Explore);
    if (!installed) return;
    click(a,"node.0"); check(preview.pitches == std::vector<int>{48,51,56,63} && preview.root%12 == 8,"Ambient Bright centre lost voicing");
    snapshot(a,output,"explore"); a.setSize(800,300); snapshot(a,output,"explore-small");
    control<ComboBox>(a,"inversion").setSelectedId(2,sendNotificationSync);
    auto modified = preview; click(a,"node.5"); check(preview.root%12==5,"relative minor location");
    click(a,"node.0"); check(preview.pitches == modified.pitches && modified.pitches != std::vector<int>{48,51,56,63},"per-node inversion lost");
    click(a,"apply"); check(key.tonic%12 == 8 && key.mode == harmony::Mode::Major,"Explore key incorrectly follows song key");
    auto& genre = control<ComboBox>(a,"genre"); auto& mood = control<ComboBox>(a,"mood");
    check(genre.getNumItems()==27 && mood.getNumItems()==3,"incomplete Explore menu");
    for(int group=1;group<=27;++group) {
        genre.setSelectedId(group,sendNotificationSync);
        for(int feel=1;feel<=3;++feel) {
            mood.setSelectedId(feel,sendNotificationSync); click(a,"node.15");
            check(!preview.pitches.empty() && std::is_sorted(preview.pitches.begin(),preview.pitches.end()),"invalid preset");
        }
    }
    a.setView(HarmonicAtlas::View::Circle); snapshot(a,output,"circle-small");
    check(inserted==1 && applied==2,"browsing committed changes");
}
} // namespace

int main(int argc, char** argv) {
    ScopedJuceInitialiser_GUI gui;
    try {
        File output = argc>2 ? File(argv[2]) : File{};
        if (output!=File{}) check(output.createDirectory().wasOk(),"capture directory");
        exercise(argc>1 && String(argv[1])=="--installed",output);
        std::cout << "Atlas UI checks passed\n";
    } catch(const std::exception& e) { std::cerr<<e.what()<<'\n'; return 1; }
}
