#include "BankBrowser.h"
#include "MotionRoll.h"

using namespace juce;
namespace crest {
namespace {
class Heart final : public Button {
  public:
    Heart() : Button("Favourite") { setMouseCursor(MouseCursor::PointingHandCursor); }
    void paintButton(Graphics &g, bool over, bool) override {
        Path p;
        p.startNewSubPath(8, 14);
        p.cubicTo(5, 11.5f, .5f, 8, .5f, 5);
        p.cubicTo(.5f, .6f, 5.5f, -.6f, 8, 3.4f);
        p.cubicTo(10.5f, -.6f, 15.5f, .6f, 15.5f, 5);
        p.cubicTo(15.5f, 8, 11, 11.5f, 8, 14);
        p.closeSubPath();
        p.applyTransform(AffineTransform::translation(getWidth() / 2.f - 8, getHeight() / 2.f - 7));
        g.setColour(getToggleState() || over ? motion::teal : motion::dim);
        if (getToggleState()) g.fillPath(p);
        else g.strokePath(p, PathStrokeType(over ? 1.7f : 1.15f));
    }
};
String chordNames(const BankSet &set) {
    StringArray names;
    for (auto &chord : set.reference) names.add(String(chord.name));
    return names.joinIntoString("   /   ");
}
String referencePitches(const BankSet &set) {
    StringArray slots;
    for (const auto &chord : set.reference) {
        StringArray pitches;
        for (auto pitch : chord.pitches) pitches.add(String(pitch));
        slots.add(pitches.joinIntoString(" "));
    }
    return slots.joinIntoString("   /   ");
}
void styleLabel(Label &label, float height, Colour colour, bool bold = false) {
    label.setFont(FontOptions(height, bold ? Font::bold : Font::plain));
    label.setColour(Label::textColourId, colour);
    label.setInterceptsMouseClicks(false, false);
}
} // namespace

// The ListBox recycles this component for visible rows only. Decode the new
// source at bind time; painting never opens files or parses MIDI.
class BankBrowser::Row final : public Component, public SettableTooltipClient {
  public:
    explicit Row(BankBrowser &owner) : browser(owner) {
        addAndMakeVisible(heart);
        heart.setComponentID("bank.heart");
        heart.onClick = [this] { browser.toggleHeart(row); };
        setMouseCursor(MouseCursor::PointingHandCursor);
    }
    void bind(int number, bool active) {
        row = number;
        selected = active;
        name = browser.getNameForRow(row);
        setName(name);
        auto index = browser.matches[size_t(row)];
        if (browser.progressions) {
            const auto &set = browser.bank.progressions[size_t(index)];
            name = set.name.upToFirstOccurrenceOf(" (", false, false);
            detail = chordNames(set);
            source = File{};
            roll = motion::Roll::voicings(set.reference);
            setTooltip(set.name + "\n" + referencePitches(set));
        } else {
            const auto &m = browser.bank.motions[size_t(index)];
            if (source != m.midi) {
                source = m.midi;
                roll = motion::Roll::read(source);
            }
            auto &tags = browser.catalogue.tags(m);
            detail = m.family + (m.group.isEmpty() ? String{} : " / " + m.group);
            setTooltip(detail + "\n" + tags.genres.joinIntoString(", ") + "  " + tags.moods.joinIntoString(", "));
            heart.setToggleState(browser.catalogue.isFavourite(m), dontSendNotification);
            heart.setName("Favourite " + m.name);
            heart.setTooltip(heart.getToggleState() ? "Remove from Favourites" : "Add to Favourites");
        }
        heart.setVisible(!browser.progressions);
        resized();
        repaint();
    }
    void resized() override { heart.setBounds(getLocalBounds().removeFromRight(32)); }
    void paint(Graphics &g) override {
        g.fillAll(selected ? motion::selectedRow : motion::surface);
        g.setColour(motion::line);
        g.drawHorizontalLine(getHeight() - 1, 0, float(getWidth()));
        auto box = getLocalBounds().reduced(9, 2);
        if (browser.progressions) {
            auto title = box.removeFromLeft(jmin(150, box.getWidth() / 3));
            g.setFont(FontOptions(14.f, Font::bold));
            g.setColour(motion::text);
            g.drawText(name, title, Justification::centredLeft);
            auto diagram = box.removeFromLeft(jmin(120, box.getWidth() / 4)).reduced(2, 1);
            roll.draw(g, diagram.toFloat(), selected ? motion::teal : motion::dim);
            box.removeFromLeft(12);
            g.setColour(motion::dim);
            g.setFont(12.5f);
            g.drawFittedText(detail, box, Justification::centredLeft, 1);
            return;
        }
        box.removeFromRight(26);
        auto thumbnail = box.removeFromLeft(jlimit(70, 142, box.getWidth() / 3)).reduced(1, 3);
        if (roll.available())
            roll.draw(g, thumbnail.toFloat(), selected ? motion::teal : motion::dim);
        else {
            g.setColour(motion::dim);
            g.setFont(11.f);
            g.drawText("No MIDI preview", thumbnail, Justification::centredLeft);
        }
        box.removeFromLeft(13);
        const bool showPath = browser.filter.byTag() || browser.filter.branch == "All families"
                           || browser.filter.group == "All subgroups";
        g.setColour(motion::text);
        g.setFont(FontOptions(13.5f, selected ? Font::bold : Font::plain));
        g.drawText(name, showPath ? box.removeFromTop(14) : box, Justification::centredLeft);
        if (showPath) {
            g.setColour(motion::dim);
            g.setFont(10.5f);
            g.drawText(detail, box, Justification::centredLeft);
        }
    }
    void mouseDown(const MouseEvent &) override {
        dragging = false;
        browser.results.selectRow(row);
        browser.results.grabKeyboardFocus();
    }
    void mouseDrag(const MouseEvent &e) override {
        if (dragging || browser.progressions || e.getDistanceFromDragStart() < 6) return;
        dragging = true;
        if (!source.existsAsFile()) {
            browser.hint.setText("Source MIDI file is missing from the bank.", dontSendNotification);
            return;
        }
        if (!DragAndDropContainer::performExternalDragDropOfFiles({source.getFullPathName()}, false, this))
            browser.hint.setText("The host could not start the MIDI drag.", dontSendNotification);
    }
    void mouseUp(const MouseEvent &e) override {
        if (!dragging && e.getNumberOfClicks() == 1 && getLocalBounds().contains(e.getPosition()))
            browser.use(row, true);
    }
    void mouseDoubleClick(const MouseEvent &) override { browser.use(row, false); }

  private:
    BankBrowser &browser;
    int row = -1;
    bool selected = false, dragging = false;
    String name, detail;
    File source;
    motion::Roll roll;
    Heart heart;
};

BankBrowser::BankBrowser(const LocalBank &source) : bank(source), catalogue(source) {
    for (auto *c : std::initializer_list<Component*>{&categories, &branches, &groups, &results, &query, &heading,
                                                       &count, &hint, &empty, &close, &preview, &apply})
        addAndMakeVisible(*c);
    for (auto &h : headers) { addAndMakeVisible(h); styleLabel(h, 11.f, motion::dim, true); }
    styleLabel(heading, 18.f, motion::text, true);
    heading.setJustificationType(Justification::centred);
    styleLabel(count, 12.5f, motion::teal, true);
    styleLabel(hint, 12.f, motion::dim);
    styleLabel(empty, 14.f, motion::dim);
    empty.setJustificationType(Justification::centred);
    query.setComponentID("bank.search");
    query.setName("Search library");
    query.setColour(TextEditor::backgroundColourId, motion::surface);
    query.setColour(TextEditor::outlineColourId, motion::line);
    query.setColour(TextEditor::focusedOutlineColourId, motion::teal);
    query.setColour(TextEditor::textColourId, motion::text);
    query.onTextChange = [this] { searchChanged(); };
    query.onEscapeKey = [this] { if (query.isEmpty()) { if (onClose) onClose(); } else query.clear(); };
    motion::styleList(results, "bank.items");
    results.setModel(this);
    close.onClick = [this] { if (onClose) onClose(); };
    apply.setColour(TextButton::buttonColourId, motion::teal);
    apply.setColour(TextButton::textColourOffId, motion::darkText);
    apply.onClick = [this] { use(results.getSelectedRow(), false); };
    addChildComponent(block);
    block.onClick = [this] { if (onBlockChords) onBlockChords(); };
    preview.onClick = [this] { use(results.getSelectedRow(), true); };
    categories.onSelect = [this](String value) {
        filter = {value, value == "Articulations" ? "Passages" : String{}, {}};
        if (value == "Favourites") catalogue.reloadFavourites();
        rebuildBranches();
    };
    branches.onSelect = [this](String value) {
        filter.branch = value;
        filter.group.clear();
        rebuildGroups();
    };
    groups.onSelect = [this](String value) {
        if (progressions) pattern = value; else filter.group = value;
        rebuildItems();
    };
    setOpaque(true);
    setWantsKeyboardFocus(true);
    showMotions();
}
BankBrowser::~BankBrowser() { results.setModel(nullptr); }
void BankBrowser::showMotions(const String &destination, const String &currentMotion) {
    progressions = false;
    targetName = destination;
    apply.setButtonText(targetName.isEmpty() ? "Use in sketch" : "Apply to " + targetName);
    apply.setTooltip(apply.getButtonText());
    block.setVisible(true);
    filter = {};
    query.setText({}, false);
    query.setTextToShowWhenEmpty("Search this collection...", motion::dim);
    catalogue.reloadFavourites();
    categories.setChoices(motion::categories, filter.category);
    groups.setComponentID("bank.groups");
    groups.setName("bank.groups");
    rebuildBranches();
    for (int row = 0; row < getNumRows(); ++row)
        if (getNameForRow(row) == currentMotion) { results.selectRow(row); break; }
    resized();
}
void BankBrowser::showProgressions() {
    progressions = true;
    apply.setButtonText("Use in sketch");
    apply.setTooltip({});
    block.setVisible(false);
    query.setText({}, false);
    query.setTextToShowWhenEmpty("Search patterns or variants...", motion::dim);
    pattern = "i-VI-III-VII";
    groups.setComponentID("bank.patterns");
    groups.setName("bank.patterns");
    rebuildPatterns();
    resized();
}
void BankBrowser::searchChanged() {
    if (progressions) { rebuildPatterns(); return; }
    rebuildItems();
}
void BankBrowser::rebuildBranches() {
    filter.branch = branches.setChoices(filter.branches(bank, catalogue), filter.branch);
    rebuildGroups();
}
void BankBrowser::rebuildGroups() {
    filter.group = groups.setChoices(filter.groups(bank, catalogue), filter.group);
    rebuildItems();
}
void BankBrowser::rebuildPatterns() {
    StringArray names;
    const auto term = query.getText().trim();
    for (auto &p : bank.progressions)
        if ((p.name + " " + p.group).containsIgnoreCase(term) || term.isEmpty()) names.addIfNotAlreadyThere(p.group);
    names.sortNatural();
    pattern = groups.setChoices(names, pattern);
    rebuildItems();
}
void BankBrowser::rebuildItems() {
    matches.clear();
    const auto term = query.getText().trim();
    if (progressions) {
        for (size_t i = 0; i < bank.progressions.size(); ++i) {
            const auto &p = bank.progressions[i];
            if (p.group == pattern && (term.isEmpty() || (p.name + " " + p.group).containsIgnoreCase(term)))
                matches.push_back(int(i));
        }
    } else {
        for (size_t i = 0; i < bank.motions.size(); ++i)
            if (filter.accepts(bank.motions[i], catalogue, term)) matches.push_back(int(i));
        std::stable_sort(matches.begin(), matches.end(), [this](int a, int b) {
            return bank.motions[size_t(a)].name.compareNatural(bank.motions[size_t(b)].name) < 0;
        });
    }
    results.updateContent();
    results.deselectAllRows();
    if (!matches.empty()) results.selectRow(0);
    results.repaint();
    count.setText(String(int(matches.size())) + (progressions ? " variant" : filter.branch=="Performances" ? " performance" : " motion")
                  + (matches.size() == 1 ? "" : "s"), dontSendNotification);
    empty.setText(matches.empty() ? emptyMessage() : String{}, dontSendNotification);
    empty.setVisible(matches.empty());
    apply.setEnabled(!matches.empty());
    preview.setEnabled(!matches.empty());
    updateHeadings();
}
String BankBrowser::emptyMessage() const {
    if (!progressions && filter.byTag() && !catalogue.hasTagIndex())
        return "No local tag index\nRun composer/tools/index_motion_tags.py, then reopen the editor.";
    if (!progressions && filter.category == "Articulations" && filter.branch != "Passages")
        return filter.branch + " is a Scaler playback articulation.\nNo source MIDI template in this bank.";
    if (!progressions && filter.category == "Favourites" && query.isEmpty())
        return "No favourites here yet.\nClick a heart beside a motion to keep it.";
    return "No matches. Try a different name or category.";
}
void BankBrowser::updateHeadings() {
    heading.setText(progressions ? "Common progressions" : filter.branch=="Performances" ? "Scaler Performances" : "Motions", dontSendNotification);
    headers[0].setText("BROWSE", dontSendNotification);
    headers[1].setText(filter.byTag() ? filter.category.toUpperCase() : "FAMILY", dontSendNotification);
    headers[2].setText(progressions ? "PATTERN" : (filter.byTag() ? "FAMILY" : "SUBGROUP"), dontSendNotification);
    headers[3].setText(progressions ? "VARIANT   /   REFERENCE CHORDS" : "SOURCE MIDI   /   MOTION", dontSendNotification);
    hint.setText(progressions ? "Click a variant to audition its voicing" : "Click to audition  |  Drag any row for source MIDI", dontSendNotification);
}
String BankBrowser::getNameForRow(int row) {
    if (!isPositiveAndBelow(row, getNumRows())) return {};
    auto i = size_t(matches[size_t(row)]);
    return progressions ? bank.progressions[i].name : bank.motions[i].name;
}
Component *BankBrowser::refreshComponentForRow(int row, bool active, Component *old) {
    std::unique_ptr<Row> cell(static_cast<Row *>(old));
    if (!isPositiveAndBelow(row, getNumRows())) return nullptr;
    if (!cell) cell = std::make_unique<Row>(*this);
    cell->bind(row, active);
    return cell.release();
}
void BankBrowser::toggleHeart(int row) {
    if (progressions || !isPositiveAndBelow(row, getNumRows())) return;
    if (!catalogue.toggleFavourite(bank.motions[size_t(matches[size_t(row)])])) {
        hint.setText("Could not save favourites to the local bank.", dontSendNotification);
        return;
    }
    if (filter.category == "Favourites") rebuildBranches();
    else results.updateContent();
}
void BankBrowser::use(int row, bool demo) {
    if (!isPositiveAndBelow(row, getNumRows())) return;
    auto i = size_t(matches[size_t(row)]);
    if (progressions) { if (onProgression) onProgression(bank.progressions[i], demo); }
    else if (onMotion) onMotion(bank.motions[i], demo);
}
bool BankBrowser::keyPressed(const KeyPress &k) {
    if (k == KeyPress::escapeKey) { if (onClose) onClose(); return true; }
    if (k == KeyPress::spaceKey) { use(results.getSelectedRow(), true); return true; }
    return false;
}
void BankBrowser::resized() {
    auto area = getLocalBounds().reduced(12, 6);
    auto top = area.removeFromTop(35);
    heading.setBounds(top);
    query.setBounds(top.removeFromLeft(jmin(225, getWidth() / 4)).reduced(0, 3));
    close.setBounds(top.removeFromRight(61).reduced(0, 3));
    auto foot = area.removeFromBottom(36);
    count.setBounds(foot.removeFromLeft(135));
    apply.setBounds(foot.removeFromRight(progressions ? 116 : 180).reduced(1, 4));
    preview.setBounds(foot.removeFromRight(90).reduced(3, 4));
    if (!progressions) block.setBounds(foot.removeFromRight(105).reduced(2, 4));
    hint.setBounds(foot);
    const int w = area.getWidth();
    int widths[]{progressions ? 0 : w * 15 / 100, progressions ? 0 : w * 18 / 100,
                 progressions ? w * 29 / 100 : w * 20 / 100, w};
    Component *columns[]{&categories, &branches, &groups, &results};
    for (int i = 0; i < 4; ++i) {
        bool visible = widths[i] != 0;
        columns[i]->setVisible(visible);
        headers[size_t(i)].setVisible(visible);
        auto column = area.removeFromLeft(jmin(widths[i], area.getWidth()));
        if (i != 3) column.removeFromRight(1);
        headers[size_t(i)].setBounds(column.removeFromTop(22).reduced(5, 0));
        columns[i]->setBounds(column);
        auto *list = static_cast<ListBox *>(columns[i]);
        if (visible && column.getHeight() > 0 && list->getSelectedRow() >= 0)
            list->scrollToEnsureRowIsOnscreen(list->getSelectedRow());
    }
    empty.setBounds(results.getBounds().reduced(12));
}
void BankBrowser::paint(Graphics &g) {
    g.fillAll(motion::chrome);
    g.setColour(motion::line);
    g.drawRect(getLocalBounds());
    auto box = getLocalBounds().reduced(12, 6);
    box.removeFromTop(35); box.removeFromBottom(36);
    g.fillRect(box);
    g.setColour(motion::chrome);
    g.fillRect(box.removeFromTop(21));
}
} // namespace crest
