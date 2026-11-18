#pragma once
#include "BankBrowser.h"
#include "GuitarBridge.h"
#include "HarmonicAtlas.h"
#include "InstrumentStrip.h"
#include "Palette.h"
#include "Processor.h"
#include "SketchGrid.h"
#include "StudioChrome.h"
#include "TimelineSend.h"

namespace crest {
class MidiDragButton final : public juce::TextButton {
  public:
    MidiDragButton() : TextButton("Drag MIDI to DAW") {}
    std::function<void()> drag;
    void mouseDown(const juce::MouseEvent &e) override {
        started = false;
        TextButton::mouseDown(e);
    }
    void mouseDrag(const juce::MouseEvent &e) override {
        if (!started && e.getDistanceFromDragStart() > 4) {
            started = true;
            if (drag)
                drag();
        }
    }

  private:
    bool started = false;
};
class Editor final : public juce::AudioProcessorEditor, public juce::DragAndDropContainer, private juce::Timer {
  public:
    explicit Editor(Processor &);
    ~Editor() override;
    void resized() override;
    void paint(juce::Graphics &) override;

  private:
    Sketch &sketch() {
        return book.sketches[book.active];
    }
    void controls();
    void sketchControls();
    void transportControls();
    void refresh();
    void refreshSlots();
    void refreshBank();
    void sync();
    bool save(bool undoable = true);
    void refreshPalette();
    void transposeCandidate(int semitones);
    void timerCallback() override;
    void message(const juce::String &);
    void selectSlot(int, bool sound = true);
    void selectDegree(int);
    void choose(const harmony::Chord &);
    void keep(bool rest);
    void loadProgression();
    void moveSlot(int);
    void duplicateSketch();
    void preview(const harmony::Chord &, int lane = -1, int column = -1);
    void startPreview(const composer::PerformanceRender &, juce::StringArray chordNames, int lane = -1, int firstSlot = 0);
    void startLanePreview(const composer::PerformanceRender &, const Sketch &, int lane);
    void updatePreviewDisplay();
    void playSketch();
    void chooseFile(const juce::String &title, const juce::String &wildcard, bool writing,
                    const juce::String &suggested, std::function<void(const juce::File &)>);
    void saveMidi();
    void dragMidi();
    void sendSketchClips();
    void updateSendButton();
    void importMotion();
    void importGuitar();
    void exportGuitar();
    void applyPart(const guitar::Part &);
    void browseBank(bool progressions = false);
    void loadBank();
    void closeBank();
    void applyMotion(const juce::File &, const juce::String &, bool preview);
    void pageControls();
    void showPage(int);
    void updatePage();
    void focusLane(int);
    void openPicker(int, int);
    void setCandidate(const harmony::Chord &);
    void transposeLane(int, int);
    void bindLane(int);
    void renameLane(int);
    void copyMain(int);
    void dropChord(int, int, const harmony::Chord &);
    void actionsMenu();
    void updateFooter();
    void setPaletteScale(harmony::Scale);
    Processor &proc;
    Book book, saved;
    std::optional<Book> undoBook;
    uint64_t generation = 0;
    int slot = 0, degree = 1;
    harmony::Chord candidate;
    composer::PerformanceRender clip;
    uint32_t previewId = 0;
    juce::StringArray previewNames;
    int previewLane = -1, previewFirstSlot = 0;
    StudioLook look;
    juce::TooltipWindow tips{this, 500};
    juce::Rectangle<int> mainArea, sectionB, sectionC, footerBand;
    Palette palette;
    SketchGrid grid;
    HarmonicAtlas atlas;
    InstrumentStrip keyboard;
    std::array<PageTab, 5> nav;
    std::array<StudioPad, 7> degrees;
    std::array<StudioPad, slotLimit> slots;
    juce::ComboBox destination, stack, scaleOct, speed, swing;
    juce::TextButton pickerClose{"Back"}, menu{"More..."}, common{"Progression bank"}, bind{"Bind"},
        keysView{"Keys"}, guitarView{"Guitar"}, dockPlay{juce::String::fromUTF8("▶")};
    juce::ToggleButton perform{"Perform"}, keyLock{"Keys lock"}, voiceGroup{"Voice grouping"};
    bool picker = false;
    juce::ComboBox root, mode, progression, motion, meter, length;
    juce::Label title, workspace, summary, tempoReadout, status, detail, nowPlaying;
    juce::Slider bpm;
    juce::ToggleButton host{"Host BPM"};
    juce::TextButton play{"Play sketch"}, stop{"Stop"}, load{"Load"}, clone{"Copy to empty"}, undo{"Undo edit"},
        add{"Keep chord"}, rest{"Rest"}, remove{"Remove"}, earlier{"<"}, later{">"},
        openGuitar{"Open guitar part..."}, writeGuitar{"Save guitar parts..."}, openMotion{"Import motion..."},
        writeMidi{"Save MIDI..."};
    MidiDragButton drag;
    TimelineSend timeline;
    juce::TextButton sendClips{"Send Sketch Clips"};
    juce::TextButton octaveDown{"Oct -"}, octaveUp{"Oct +"}, semiDown{"Semi -"}, semiUp{"Semi +"};
    juce::TextButton bankButton{"Performances"};
    std::optional<LocalBank> localBank;
    juce::TextButton shade;
    std::unique_ptr<BankBrowser> browser;
    std::unique_ptr<juce::FileChooser> chooser;
};
} // namespace crest
