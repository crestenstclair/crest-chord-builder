#include "ColorRecipes.h"
#include "Editor.h"
#include <iostream>
#include <set>
using namespace juce;
using namespace crest;
void require(bool condition, const char *why) {
    if (!condition)
        throw std::runtime_error(why);
}

TextButton *findButton(Component &parent, const String &name) {
    for (auto *child : parent.getChildren())
        if (child->isVisible()) {
            if (auto *button = dynamic_cast<TextButton *>(child); button && button->getButtonText() == name)
                return button;
            if (auto *nested = findButton(*child, name))
                return nested;
        }
    return nullptr;
}
void press(Component &parent, const String &name) {
    auto *b = findButton(parent, name);
    if (!b || !b->isEnabled() || !b->onClick) {
        StringArray visible;
        for (auto *child : parent.getChildren())
            if (auto *button = dynamic_cast<TextButton *>(child); button && button->isVisible())
                visible.add(button->getButtonText());
        throw std::runtime_error("Unavailable control: " + name.toStdString() +
                                 ". Visible: " + visible.joinIntoString(" | ").toStdString());
    }
    b->onClick();
}
Component *visibleId(Component &parent, const String &id) {
    for (auto *c : parent.getChildren())
        if (c->isVisible()) {
            if (c->getComponentID() == id)
                return c;
            if (auto *nested = visibleId(*c, id))
                return nested;
        }
    return nullptr;
}
void pressId(Component &parent, const String &id) {
    auto *b = dynamic_cast<TextButton *>(visibleId(parent, id));
    require(b && b->onClick, "Missing slot");
    b->onClick();
}
void capture(Component &editor, const File &output) {
    if (output == File{})
        return;
    output.getParentDirectory().createDirectory();
    output.deleteFile();
    FileOutputStream stream(output);
    require(stream.openedOk() && PNGImageFormat().writeImageToStream(
                                     editor.createComponentSnapshot(editor.getLocalBounds()), stream),
            "page capture failed");
}
void capturePage(Component &editor, const String &directory, const String &page) {
    if (directory.isNotEmpty())
        capture(editor, File(directory).getChildFile(page + ".png"));
}
void testPreviewIndicator(const String &gallery) {
    Processor p;
    p.prepareToPlay(48000, 256);
    auto [book, revision] = p.snapshot();
    book.bpm = 120; book.meter = 3;
    auto &lane = book.sketches[2];
    lane.name = "Chorus";
    lane.performance = "arp-switchback"; lane.swing = 75; lane.speed = 2;
    lane.slots = {{{"Am9", 57, {57,60,64,67,71}},1}, {{"Rest",0,{}},1}, {{"F/A",53,{57,60,65}},2}};
    require(p.commit(book, revision), "could not prepare preview test");
    std::unique_ptr<AudioProcessorEditor> editor(p.createEditor());
    auto *label = dynamic_cast<Label *>(editor->findChildWithID("preview-chord"));
    auto pad = [&](int n) { return dynamic_cast<StudioPad *>(visibleId(*editor, "sketch-3-slot-" + String(n))); };
    require(label && pad(1) && pad(2) && pad(3), "preview UI unavailable");
    auto process = [&](int frames) {
        while (frames > 0) {
            const int size = std::min(256, frames);
            AudioBuffer<float> audio(2, size); MidiBuffer midi; p.processBlock(audio,midi);
            frames -= size;
        }
    };
    auto checkDisplay = [&](int expected, String chord) {
        const double deadline = Time::getMillisecondCounterHiRes() + 1500;
        do {
            Timer::callPendingTimersSynchronously();
            if (label->isVisible() == (expected > 0) && (expected <= 0 || label->getText().endsWith(chord)) &&
                pad(1)->isPlaying() == (expected == 1) && pad(2)->isPlaying() == (expected == 2) &&
                pad(3)->isPlaying() == (expected == 3)) return;
            Thread::sleep(5);
        } while (Time::getMillisecondCounterHiRes() < deadline);
        throw std::runtime_error("Wrong preview display: expected " + chord.toStdString() + ", saw " + label->getText().toStdString());
    };
    pressId(*editor, "sketch-3-play");
    // At this tempo one tick is 50 samples. Two 3/4 quarter-bar slots end at swung ticks 420 and 840.
    process(420 * 50); checkDisplay(1,"Am9");
    process(1); checkDisplay(2,"Rest");
    process(420 * 50); checkDisplay(3,"F/A");
    capturePage(*editor, gallery, "preview-playing");
    process(600 * 50); checkDisplay(-1,{});
    pressId(*editor, "sketch-3-play"); process(64); checkDisplay(1,"Am9");
    press(*editor, "Stop"); process(64); checkDisplay(-1,{});
}
TextButton *matchingPad(Component &parent, const String &symbol) {
    for (auto *child : parent.getChildren())
        if (child->isVisible()) {
            if (auto *b = dynamic_cast<TextButton *>(child);
                b && (b->getButtonText() == symbol || b->getButtonText().startsWith(symbol + " ")))
                return b;
            if (auto *result = matchingPad(*child, symbol))
                return result;
        }
    return nullptr;
}
void testGuiAndRecall(const String &imagePath, const String &gallery) {
    Processor p;
    p.prepareToPlay(48000, 128);
    std::unique_ptr<AudioProcessorEditor> editor(p.createEditor());
    press(*editor, "Load");
    auto initial = p.snapshot().first;
    auto count = initial.sketches[0].slots.size();
    require(count == 4, "load progression");
    for (int row = 1; row <= 7; ++row)
        for (int col = 1; col <= 8; ++col)
            require(visibleId(*editor, "sketch-" + String(row) + "-slot-" + String(col)),
                    "56 slots must be visible together");
    pressId(*editor, "sketch-6-slot-4");
    press(*editor, "Back");
    require(p.snapshot().first.sketches[5].slots.empty(), "cancel filled a gap");
    pressId(*editor, "sketch-1-slot-1");
    capturePage(*editor, gallery, "slot-picker");
    auto *palette = editor->findParentComponentOfClass<Palette>();
    for (auto *child : editor->getChildren())
        if (auto *pComponent = dynamic_cast<Palette *>(child))
            palette = pComponent;
    require(palette != nullptr, "missing variations palette");
    auto *am9 = matchingPad(*palette, "Am9");
    require(am9 && am9->onClick, "Am9 must be available directly from the Am picker");
    am9->onClick();
    press(*editor, "Replace slot 1");
    auto book = p.snapshot().first;
    require(book.sketches[0].slots[0].chord.pitches.size() == 5, "slot variation not retained");
    press(*editor, "Copy to empty");
    press(*editor, "Remove");
    book = p.snapshot().first;
    require(book.active == 1 && book.sketches[1].slots.size() == count - 1 &&
                book.sketches[0].slots.size() == count,
            "copy was not independent");
    press(*editor, "Undo edit");
    capturePage(*editor, gallery, "sketch");
    for (auto page : {"Circle of Fifths", "Modulation", "Explore", "Colors"}) {
        press(*editor, page);
        capturePage(*editor, gallery, String(page).toLowerCase().replace(" ", "-"));
    }
    pressId(*editor,"color-row-4-recipe");capturePage(*editor,gallery,"color-chooser");
    press(*editor,"Sketch");press(*editor,"Colors");pressId(*editor,"color-row-1-octave-up");
    require(p.snapshot().first.colorSettings.isNotEmpty(),"Colors setup must be saved in host state");
    if (imagePath.isNotEmpty()) {
        auto image = editor->createComponentSnapshot(editor->getLocalBounds());
        File target(imagePath);
        target.deleteFile();
        FileOutputStream stream(target);
        require(stream.openedOk() && PNGImageFormat().writeImageToStream(image, stream),
                "screenshot write failed");
    }
    press(*editor, "Play sketch");
    AudioBuffer<float> out(2, 128);
    MidiBuffer midi;
    p.processBlock(out, midi);
    require(midi.getNumEvents() == 5 && out.getMagnitude(0, 128) > 0.001f,
            "preview has wrong first chord or no audio");
    press(*editor, "Stop");
    p.processBlock(out, midi);
    int offs = 0;
    for (auto meta : midi)
        offs += meta.getMessage().isNoteOff();
    require(offs == 5, "stuck notes on stop");
    MemoryBlock bytes;
    p.getStateInformation(bytes);
    Processor recalled;
    recalled.setStateInformation(bytes.getData(), int(bytes.getSize()));
    auto text = encode(p.snapshot().first);
    require(encode(recalled.snapshot().first) == text, "host recall changed content");
    recalled.setStateInformation("invalid", 7);
    require(encode(recalled.snapshot().first) == text, "invalid restore replaced user work");
}
void testMidiHandoff() {
    Sketch sketch;
    sketch.slots = {{{"Am", 57, {57, 60, 64}}, 4}, {{"Rest", 0, {}}, 4}};
    sketch.performance = "strum-reed";
    auto clip = render(sketch, 120, 3);
    auto bytes = composer::performanceMidi(clip);
    MemoryInputStream in(bytes.data(), bytes.size(), false);
    MidiFile file;
    require(file.readFrom(in) && file.getTimeFormat() == 480 && file.getLastTimestamp() == 2880,
            "exported file length/PPQ wrong");
    std::multiset<std::tuple<int, int, int>> exported, played;
    auto *track = file.getTrack(0);
    for (int i = 0; i < track->getNumEvents(); ++i) {
        auto &m = track->getEventPointer(i)->message;
        if (m.isNoteOnOrOff())
            exported.emplace(int(m.getTimeStamp() * 50), m.getNoteNumber(), m.isNoteOn() ? m.getVelocity() : 0);
    }
    // At 48 kHz / 120 BPM / 480 PPQ one tick is exactly 50 samples. Blocks intentionally do not align with ticks.
    Audition audio;
    audio.prepare(48000);
    audio.submit(clip);
    AudioBuffer<float> block(2, 127);
    MidiBuffer midi;
    for (int offset = 0; offset < 144000; offset += 127) {
        audio.process(block, midi);
        for (auto meta : midi) {
            auto m = meta.getMessage();
            played.emplace(offset + meta.samplePosition, m.getNoteNumber(), m.isNoteOn() ? m.getVelocity() : 0);
        }
    }
    require(played == exported, "preview MIDI and saved MIDI differ");
}
void testSessionSketchSend() {
    TemporaryFile temp;
    auto host = temp.getFile();
    TimelineSend bridge(host);
    Book book;
    book.active = mainLane;
    book.meter = 3;
    book.sketches[mainLane].slots = {{{"F", 53, {53, 57, 60}}, 4}};
    require(!TimelineSend::hasSketches(book), "Main Track alone must not enable Session export");
    auto &sketch = book.sketches[0];
    sketch.name = "Verse";
    sketch.slots = {{{"Am",57,{57,60,64}},4},{{"Rest",0,{}},4}};
    sketch.performance="strum-reed";
    auto &rest = book.sketches[6];
    rest.slots = {{{"", 0, {}}, 2}};
    rest.perform = false;
    const auto clip=render(sketch,97,3);
    require(bridge.sendSketches(book,97).contains("Enable CrestTimeline"),"missing Live receiver must not queue a clip");
    String token="11112222333344445555666677778888";auto inbox=host.getChildFile(token);
    require(inbox.createDirectory().wasOk(),"temporary timeline inbox");
    require(host.getChildFile("active.json").replaceWithText("{\"version\":1,\"session\":\""+token+"\"}"),"timeline manifest");
    require(bridge.sendSketches(book,97).contains("restart Live") && !bridge.pending(), "old Arrangement surface must not receive a Session batch");
    require(host.getChildFile("active.json").replaceWithText("{\"version\":1,\"session_clips\":1,\"session\":\""+token+"\"}"),"Session surface manifest");
    bridge.sendSketches(book, 97);
    bridge.sendSketches(book, 97);
    auto requests=inbox.findChildFiles(File::findFiles,false,"*.request");
    require(bridge.pending() && requests.size()==1,"a double-click must only send once");
    auto payload = JSON::parse(requests[0]);
    auto records = payload["clips"];
    require(payload["op"].toString() == "session-sketches" && payload["session"].toString() == token && records.size() == 2,
            "only used Sketch lanes must be included regardless of active lane");
    auto data = records[0];
    auto rows = data["notes"];
    auto* notes = rows.getArray();
    require(data["name"].toString() == "Verse | Am - Rest | Reed brush" &&
            records[1]["name"].toString() == "Sketch 7 | Rest | Block chords" &&
            int(records[1]["ticks"]) == 720 && records[1]["notes"].isArray() && records[1]["notes"].size() == 0,
            "sketch labels, lane order or rest-only length changed");
    require(int(data["ticks"])==2880 && int(data["ppq"])==480 && int(data["meter"])==3 && notes && notes->size()==int(clip.notes.size()),"Session length, meter or note count changed");
    for(int i=0;i<notes->size();++i){auto& expected=clip.notes[size_t(i)];auto& row=notes->getReference(i);require(int(row[0])==expected.startTick && int(row[1])==expected.endTick && int(row[2])==expected.pitch && int(row[3])==expected.velocity,"timeline changed a performed note");}
    require(requests[0].withFileExtension(".reply").replaceWithText("{\"message\":\"Placed Verse\"}"),"timeline reply");
    require(bridge.completion().value_or(String{})=="Placed Verse" && !bridge.pending(),"missing confirmation");
    host.deleteRecursively();
}
void verifyRowPlay(Processor &processor, Component &editor, int index, const Book &book) {
    const double bpm = processor.tempo(book);
    auto rendered = render(book.sketches[index], bpm, book.meter);
    std::multiset<std::tuple<int,int,int>> expected, actual;
    const double samplesPerTick = 48000 * 60.0 / (bpm * composer::performancePPQ);
    for (const auto &n : rendered.notes) {
        expected.emplace(int(std::lround(n.startTick * samplesPerTick)), n.pitch, n.velocity);
        expected.emplace(int(std::lround(n.endTick * samplesPerTick)), n.pitch, 0);
    }
    pressId(editor, "sketch-" + String(index + 1) + "-play");
    AudioBuffer<float> block(2, 128);
    MidiBuffer midi;
    for (int offset = 0; offset <= std::lround(rendered.totalTicks * samplesPerTick); offset += 128) {
        midi.clear();
        processor.processBlock(block, midi);
        for (auto m : midi) {
            auto msg = m.getMessage();
            actual.emplace(offset + m.samplePosition, msg.getNoteNumber(), msg.isNoteOn() ? msg.getVelocity() : 0);
        }
    }
    require(!expected.empty() && actual == expected, "Sketch row Play differs from its performed export");
}
void testInstalledBank(const String &gallery) {
    auto bank = LocalBank::read(LocalBank::defaultFolder());
    size_t performances = 0, notes = 0;
    for (const auto &item : bank.motions) {
        MemoryBlock data;
        require(item.midi.loadFileAsData(data), "missing bank MIDI");
        auto *start = static_cast<const uint8_t *>(data.getData());
        auto source = composer::importPerformanceMidi({start, start + data.getSize()});
        auto clip = composer::renderPerformance({{{57, 60, 64}, 4}}, source, 90, 4);
        notes += clip.notes.size();
        performances += item.family == "Performances";
    }
    for (const auto &set : bank.progressions) {
        auto chords = set.transposeTo(9);
        require(!chords.empty() && chords.size() <= 8, "invalid local progression");
    }
    for (const auto &color : bank.colors)
        for (int degree = 0; degree < 7; ++degree)
            require(color.colorDegree({57, harmony::Mode::NaturalMinor}, degree).has_value(),
                    "missing local color");
    require(performances > 0 && notes > 0 && !bank.progressions.empty(), "empty local bank");
    Processor p;
    p.prepareToPlay(48000, 128);
    std::unique_ptr<AudioProcessorEditor> editor(p.createEditor());
    press(*editor, "Load");
    pressId(*editor, "sketch-2-performance");
    BankBrowser *browser = nullptr;
    for (auto *child : editor->getChildren())
        if (auto *b = dynamic_cast<BankBrowser *>(child))
            browser = b;
    require(browser && browser->isVisible(), "local browser not visible");
    auto *results = dynamic_cast<ListBox *>(visibleId(*browser, "bank.items"));
    auto *model = results ? results->getListBoxModel() : nullptr;
    require(model && performances == 233 && model->getNumRows() == int(performances),
            "Performances must initially display all 233 indexed templates");
    std::set<String> displayed, expected;
    for (int i = 0; i < model->getNumRows(); ++i) displayed.insert(model->getNameForRow(i));
    for (const auto &item : bank.motions) if (item.family == "Performances") expected.insert(item.name);
    require(expected.size() == performances && displayed == expected, "Performances missing or duplicated in direct browser");
    capturePage(*editor, gallery, "motions");
    for (auto *child : browser->getChildren())
        if (auto *query = dynamic_cast<TextEditor *>(child)) {
            query->setText("Accento", false);
            query->onTextChange();
        }
    require(model->getNumRows() == 1 && model->getNameForRow(0) == "Accento", "scoped Accento search");
    press(*browser, "Apply to Sketch 2");
    require(p.snapshot().first.sketches[1].slots.empty(), "Assigning a performance must not invent chords");
    press(*editor, "Load");
    const auto restored = decode(encode(p.snapshot().first));
    require(restored.sketches[1].templateName == "Accento" && restored.sketches[0].performance == "block",
            "wrong Sketch row assigned or selection lost on recall");
    auto *rowButton = dynamic_cast<TextButton *>(visibleId(*editor, "sketch-2-performance"));
    require(rowButton && rowButton->getButtonText() == "Accento", "performance name missing from its sketch row");
    const auto raw = render(restored.sketches[0], 90, 4), performed = render(restored.sketches[1], 90, 4);
    require(raw.totalTicks == performed.totalTicks && raw.notes.size() != performed.notes.size(),
            "two rows with the same chords did not play different performances");
    verifyRowPlay(p, *editor, 0, restored);
    verifyRowPlay(p, *editor, 1, restored);
    capturePage(*editor, gallery, "sketch-performances");
    pressId(*editor, "sketch-2-performance");
    require(model->getNameForRow(results->getSelectedRow()) == "Accento", "reopen lost assigned selection");
    press(*browser, "Block chords");
    require(p.snapshot().first.sketches[1].performance == "block", "cannot remove a row performance");
    press(*editor, "Progression bank");
    capturePage(*editor, gallery, "progressions");
    std::cout << bank.motions.size() << " templates, " << performances << " Performances, "
              << bank.progressions.size() << " progressions and " << bank.colors.size()
              << " color sets verified\n";
}
void testBindingAndMigration() {
    Processor p;
    p.prepareToPlay(48000, 128);
    auto [book, rev] = p.snapshot();
    book.bound = 2;
    book.sketches[2].slots = {{{"Am", 57, {57, 60, 64}}, 4}};
    require(p.commit(book, rev), "bind");
    AudioBuffer<float> audio(2, 128);
    MidiBuffer midi;
    midi.addEvent(MidiMessage::noteOn(1, 36, uint8_t(96)), 22);
    p.processBlock(audio, midi);
    require(midi.getNumEvents() == 3, "bound key must sound actual chord");
    for (auto e : midi)
        require(e.samplePosition == 22 && e.getMessage().isNoteOn(), "binding onset");
    book.bound = -1;
    require(p.commit(book, rev + 1), "unbind");
    midi.clear();
    p.processBlock(audio, midi);
    require(midi.getNumEvents() == 3, "unbind must release held notes");
    auto xml = parseXML(encode(book));
    xml->setAttribute("version", 1);
    xml->removeChildElement(xml->getChildElement(mainLane), true);
    auto migrated = decode(xml->toString());
    require(migrated.sketches[2].slots[0].chord.pitches == book.sketches[2].slots[0].chord.pitches &&
                migrated.sketches[mainLane].slots.empty() && migrated.bound == -1,
            "legacy host state migration");
}
void testColors() {
    for (const auto &m : modes())
        for (size_t recipe = 0; recipe < colorRecipes().size(); ++recipe)
            for (int d = 1; d <= 7; ++d) {
                auto c = recipeChord({57, m.mode}, d, recipe);
                if (c) {
                    require(!c->pitches.empty(), "empty Colors pad");
                    harmony::foreignNotes({57, m.mode}, *c);
                }
            }
}
int main(int argc, char **argv) {
    try {
        ScopedJuceInitialiser_GUI gui;
        StringArray args(argv, argc);
        testMidiHandoff();
        testSessionSketchSend();
        testColors();
        testBindingAndMigration();
        const auto gallery = args.contains("--gallery") ? args[args.indexOf("--gallery") + 1] : String{};
        testPreviewIndicator(gallery);
        testGuiAndRecall(args.contains("--png") ? args[args.indexOf("--png") + 1] : String{}, gallery);
        if (args.contains("--local-bank"))
            testInstalledBank(gallery);
        std::cout << "PASS: sketch remix, independent copies, recall, sample-exact audition vs SMF, note offs and "
                     "trailing rest\n";
        return 0;
    } catch (const std::exception &e) {
        std::cerr << e.what() << '\n';
        return 1;
    }
}
