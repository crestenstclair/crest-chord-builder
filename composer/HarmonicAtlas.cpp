#include "HarmonicAtlas.h"
#include "HarmonicAtlasMusic.h"
#include "Palette.h"

namespace crest {
using namespace juce;
using namespace atlas;
namespace {
using Rect = Rectangle<int>;
const Colour blue{0xff345f94}, tint{0xff536f8a}, stone{0xff48535d}, ocean{0xff264868}, line{0xff354753};
constexpr auto silent = dontSendNotification;

Colour scaleColour(Scale scale, const Chord& chord) {
    int count = outside(scale, chord); return count == 0 ? blue : count == 1 ? tint : stone;
}
void caption(Graphics& g, String s, Rect r, float height = 12, Colour colour = ink::muted,
             Justification align = Justification::centredLeft, bool bold = false) {
    g.setColour(colour); g.setFont(FontOptions(height, bold ? Font::bold : Font::plain));
    g.drawFittedText(s, r, align, 1, .83f);
}
void panel(Graphics& g, Rect r) {
    g.setColour(ink::panel); g.fillRoundedRectangle(r.toFloat(), 7);
    g.setColour(line); g.drawRoundedRectangle(r.toFloat().reduced(.5f), 7, 1);
}
void place(Component& c, Rect r) { c.setBounds(r); c.setVisible(true); }
Rect take(Rect& r, int width, int gap = 5) {
    auto part = r.removeFromLeft(width); r.removeFromLeft(gap); return part;
}
void style(Button& b) {
    b.setColour(TextButton::buttonColourId, ink::raised); b.setColour(TextButton::textColourOffId, ink::bright);
    b.setColour(TextButton::buttonOnColourId, ink::selected); b.setColour(TextButton::textColourOnId, ink::accent);
}
void setRange(ComboBox& box, String prefix, int low, int high) {
    box.clear(silent);
    for (int n = low; n <= high; ++n) box.addItem(prefix + " " + (n > 0 ? "+" : "") + String(n), n - low + 1);
    box.setSelectedId(1 - low, silent);
}
class Pad final : public TextButton {
  public:
    Pad() { setMouseCursor(MouseCursor::PointingHandCursor); }
    String subtitle;
    Colour fill{ink::raised};
    bool round = false, active = false;
    std::function<void()> twice;
    void mouseDoubleClick(const MouseEvent&) override { if (twice && isEnabled()) twice(); }
    bool hitTest(int x, int y) override {
        return !round || Point<float>(float(x), float(y)).getDistanceFrom(getLocalBounds().toFloat().getCentre()) <= getWidth() * .5f;
    }
    void paintButton(Graphics& g, bool over, bool down) override {
        auto b = getLocalBounds().toFloat().reduced(1);
        g.setColour(down ? fill.darker(.14f) : over ? fill.brighter(.18f) : fill);
        if (round) g.fillEllipse(b); else g.fillRoundedRectangle(b, 5);
        g.setColour(active || hasKeyboardFocus(false) ? ink::accent : ink::bright.withAlpha(.12f));
        if (round) g.drawEllipse(b.reduced(.6f), active ? 2.2f : 1);
        else g.drawRoundedRectangle(b.reduced(.6f), 5, active ? 2 : 1);
        auto text = getLocalBounds().reduced(round ? 3 : 6, 1);
        if (subtitle.isNotEmpty()) {
            auto bottom = text.removeFromBottom(std::min(17, text.getHeight() / 2));
            caption(g, subtitle, bottom, 10, ink::bright.withAlpha(.78f));
        }
        caption(g, getButtonText(), text, round ? jlimit(8.f, 14.f, getWidth() * .32f) : 14,
                ink::bright, round ? Justification::centred : Justification::centredLeft, true);
    }
};

class Row final : public Component {
  public:
    explicit Row(int ordinal) {
        for (int i = 0; i < count; ++i) {
            auto& b = pads[i]; addChildComponent(b);
            b.setComponentID("atlas.row." + String(ordinal) + "." + String(i));
            b.onClick = [this, i] { choose(i, false); }; b.twice = [this, i] { choose(i, true); };
        }
        for (auto* b : {&prev, &next}) { style(*b); addChildComponent(*b); }
        prev.setComponentID("atlas.row." + String(ordinal) + ".prev");
        next.setComponentID("atlas.row." + String(ordinal) + ".next");
        prev.onClick = [this] { page(-1); }; next.onClick = [this] { page(1); };
    }
    std::function<void(Chord,bool)> onPick;
    void bind(String title, std::vector<Chord> chords, Scale key, String empty, bool reset) {
        heading = title; all = std::move(chords); scale = key; emptyText = empty;
        start = reset ? 0 : std::min(start, lastStart()); update();
    }
    void highlight(const Chord& c) {
        for (int i = 0; i < count && start + i < int(all.size()); ++i) {
            auto& b = pads[i]; b.active = all[start + i].pitches == c.pitches; b.repaint();
        }
    }
    void resized() override {
        auto r = getLocalBounds(); auto head = r.removeFromTop(std::min(23, r.getHeight()/3));
        next.setBounds(head.removeFromRight(25).reduced(1)); prev.setBounds(head.removeFromRight(25).reduced(1));
        for (int i = 0; i < count; ++i) {
            int width = r.getWidth() / (count-i); pads[i].setBounds(r.removeFromLeft(width).reduced(1, 2));
        }
    }
    void paint(Graphics& g) override {
        auto r = getLocalBounds(); auto head = r.removeFromTop(std::min(23, r.getHeight()/3));
        head.removeFromRight(54);
        if (all.size() > count) caption(g, String(start/count+1) + " / " + String(lastStart()/count+1), head.removeFromRight(48), 11, ink::muted, Justification::centredRight);
        caption(g, heading, head, 12, ink::muted, Justification::centredLeft, true);
        if (all.empty()) caption(g, emptyText, r, 13);
    }
  private:
    static constexpr int count = 7;
    std::array<Pad, count> pads;
    TextButton prev{"<"}, next{">"};
    std::vector<Chord> all;
    Scale scale;
    String heading, emptyText;
    int start = 0;
    int lastStart() const { return all.empty() ? 0 : (int(all.size()) - 1) / count * count; }
    void page(int delta) { start = jlimit(0, lastStart(), start + delta * count); update(); }
    void choose(int i, bool commit) { if (onPick && start + i < int(all.size())) onPick(all[start + i], commit); }
    void update() {
        for (int i = 0; i < count; ++i) {
            auto& b = pads[i]; int index = start+i;
            b.setVisible(index < int(all.size())); if (!b.isVisible()) continue;
            const auto& c = all[index]; b.setButtonText(c.name); b.fill = scaleColour(scale, c); b.active = false;
            b.subtitle = notesOf(c); b.setTooltip(String(c.name) + "   " + b.subtitle + "   |   Double-click to insert");
            b.repaint();
        }
        prev.setVisible(all.size() > count); next.setVisible(all.size() > count);
        prev.setEnabled(start > 0); next.setEnabled(start < lastStart()); repaint();
    }
};

Point<float> orbit(Point<float> center, float radius, float turns) {
    return center.getPointOnCircumference(radius, turns * MathConstants<float>::twoPi);
}
void atCentre(Pad& b, Point<float> p, int diameter) {
    place(b, Rect(diameter, diameter).withCentre(p.roundToInt()));
}
} // namespace

struct HarmonicAtlas::Surface final : Component, private Timer {
    explicit Surface(HarmonicAtlas& parent) : owner(parent) {
        setupWheel(); setupExplore(); setupControls();
        initView();
    }
    HarmonicAtlas& owner;
    Library lib = readLibrary();
    View view = View::Circle;
    Scale origin = safeScale({}), circle = origin, target{55,Mode::Major}, dynamic = origin;
    std::optional<Chord> context, focus;
    Edit globalEdit;
    const Preset* preset = nullptr;
    std::array<Edit, 16> nodeEdits{};
    int selectedNode = 0, selectedNotes = 0;
    std::array<Pad, 24> wheel;
    std::array<Pad, 16> nodes;
    std::array<TextButton, 12> keys;
    Row one{0}, two{1}, three{2};
    ComboBox genre, mood, transpose, mode, degree, octave, semi, inversion;
    TextEditor query;
    TextButton fixed{"Dynamic scale"}, lock{"Match song tonic"}, apply{"Apply scale"}, audition{"Audition"}, insert{"Insert chord"}, play{"Play path"};
    Rect left, middle, right, footer, queryArea, modeArea, info, filters;
    std::vector<Chord> path;
    size_t pathIndex = 0;

    void setupWheel() {
        for (int i = 0; i < int(wheel.size()); ++i) {
            auto& b = wheel[i]; const auto s = wheelScale(i); b.round = true;
            b.setButtonText(String(names[pc(s.tonic)]) + (i >= 12 ? "m" : "")); b.setTooltip(scaleName(s));
            attach(b, "wheel." + String(i)); b.onClick = [this,i]{ selectKey(i, false); }; b.twice = [this,i]{ selectKey(i, true); };
        }
        for (int i = 0; i < 12; ++i) {
            auto& b = keys[i]; b.setButtonText(names[i]); style(b); attach(b, "note." + String(i)); b.setClickingTogglesState(true);
            b.setTooltip("Require " + String(names[i]) + " in suggested chords");
            b.onClick = [this, i] { selectedNotes ^= 1 << i; circleSuggestions(true); };
        }
    }
    void setupExplore() {
        for (int i = 0; i < int(nodes.size()); ++i) {
            auto& b = nodes[i]; b.round = true; attach(b, "node." + String(i));
            b.onClick = [this,i]{ chooseNode(i, false); }; b.twice = [this,i]{ chooseNode(i, true); };
        }
        StringArray genres;
        for (const auto& p : lib.presets) genres.addIfNotAlreadyThere(p.genre);
        genres.sort(true); genre.addItemList(genres, 1); genre.setSelectedId(genres.indexOf("Ambient") + 1, silent);
        mood.addItemList({"Bright", "Neutral", "Dark"}, 1); mood.setSelectedId(1, silent);
        setRange(transpose, "Semi", -12, 12);
        genre.onChange = mood.onChange = [this] { loadPreset(); resized(); };
        transpose.onChange = lock.onClick = [this] { refreshExplore(); };
        fixed.setClickingTogglesState(true); fixed.setToggleState(true, silent); lock.setClickingTogglesState(true);
        fixed.onClick = [this] { refreshExplore(); };
    }
    template<typename C> void attach(C& c, String id) { addChildComponent(c); c.setComponentID("atlas." + id); }
    void setupControls() {
        attach(genre,"genre"); attach(mood,"mood"); attach(transpose,"transpose"); attach(fixed,"dynamic"); attach(lock,"lock");
        attach(mode,"mode"); attach(degree,"degree"); attach(play,"path"); attach(query,"search");
        attach(one,"suggestions"); attach(two,"relationships"); attach(three,"matches");
        attach(octave,"octave"); attach(inversion,"inversion"); attach(semi,"semi");
        attach(apply,"apply"); attach(audition,"audition"); attach(insert,"insert");
        for (auto* b : {&fixed,&lock,&apply,&audition,&insert,&play}) style(*b);
        insert.setColour(TextButton::buttonColourId, ink::selected);
        for (auto* box : {&genre,&mood,&transpose,&mode,&degree,&octave,&semi,&inversion}) {
            box->setColour(ComboBox::backgroundColourId, ink::background); box->setColour(ComboBox::textColourId, ink::bright);
            box->setColour(ComboBox::outlineColourId, line); box->setColour(ComboBox::arrowColourId, ink::accent);
        }
        for (auto name : modes) mode.addItem(name, mode.getNumItems()+1);
        for (auto roman : {"I","II","III","IV","V","VI","VII"}) degree.addItem(String("Resolve to ") + roman, degree.getNumItems()+1);
        degree.setSelectedId(1, silent); degree.onChange = [this]{ stopPath(); modRows(); };
        mode.onChange = [this]{ target.mode = Mode(mode.getSelectedId()-1); selectDestination(false, false); };
        query.setTextToShowWhenEmpty("Find a chord: e.g. Dm9 or G7/B", ink::muted); query.setMultiLine(false);
        query.setColour(TextEditor::backgroundColourId, ink::background); query.setColour(TextEditor::textColourId, ink::bright);
        query.onTextChange = [this]{ searchRow(true); };
        setRange(octave, "Oct", -2, 2); setRange(semi, "Semi", -12, 12); setRange(inversion, "Inv", 0, 3);
        octave.onChange = semi.onChange = inversion.onChange = [this]{ editCurrent(); };
        one.onPick = two.onPick = three.onPick = [this](Chord c, bool commit){ selectChord(std::move(c), commit); };
        audition.onClick = [this]{ emit(false); }; insert.onClick = [this]{ emit(true); };
        apply.onClick = [this]{ if (owner.onScale) owner.onScale(view == View::Explore ? dynamic : view == View::Circle ? circle : target); };
        play.onClick = [this]{ if (isTimerRunning()) stopPath(); else playPath(); };
    }
    Scale wheelScale(int i) const { return {origin.tonic - pc(origin.tonic) + pc((i % 12)*7 + (i >= 12 ? 9 : 0)), i >= 12 ? Mode::NaturalMinor : Mode::Major}; }
    Edit& edit() { return view == View::Explore ? nodeEdits[selectedNode] : globalEdit; }
    Chord current() { return edited(*focus, edit(), view == View::Explore ? exploreShift() : 0); }
    void emit(bool commit) {
        if (!focus) return;
        const auto chord = current(); auto& fn = commit ? owner.onInsert : owner.onChoose; if (fn) fn(chord);
    }
    void syncEditBoxes() {
        octave.setSelectedId(3 + edit().oct, silent); semi.setSelectedId(13 + edit().semi, silent); inversion.setSelectedId(1 + edit().inv, silent);
        for (Component* c : std::initializer_list<Component*>{&octave,&semi,&inversion,&audition,&insert,&apply}) c->setEnabled(focus.has_value());
    }
    void editCurrent() {
        edit() = {octave.getSelectedId()-3, semi.getSelectedId()-13, inversion.getSelectedId()-1};
        if (view == View::Explore) refreshExplore();
        repaint(); emit(false);
    }
    void selectChord(Chord c, bool commit) {
        stopPath(); focus = std::move(c); syncEditBoxes();
        for (auto* row : {&one,&two,&three}) row->highlight(*focus);
        repaint(); emit(commit);
    }
    void initView() {
        stopPath();
        if (view == View::Explore) { if (!preset) loadPreset(); else refreshExplore(); }
        else if (view == View::Modulation) selectDestination(false, false);
        else { focus = harmony::degreeChord(circle,1); circleRows(); }
        syncEditBoxes(); resized(); repaint();
    }
    void changeScale(Scale s) {
        s = safeScale(s); if (s.tonic == origin.tonic && s.mode == origin.mode) return;
        origin = s; circle = s;
        if (view == View::Explore) refreshExplore(); else initView();
    }
    void selectKey(int i, bool commit) {
        if (view == View::Modulation) { target = wheelScale(i); selectDestination(true, commit); }
        else { circle = wheelScale(i); focus = harmony::degreeChord(circle,1); circleRows(); syncEditBoxes(); repaint(); emit(commit); }
    }
    void wheelHighlight(Scale s) {
        for (int i=0; i < int(wheel.size()); ++i) {
            auto& b = wheel[i]; auto k = wheelScale(i); b.active = pc(k.tonic) == pc(s.tonic) && k.mode == s.mode;
            b.fill = b.active ? ink::selected : (i < 12 ? ocean : ink::raised); b.repaint();
        }
    }
    void circleSuggestions(bool reset) {
        const auto c = context.value_or(harmony::degreeChord(origin,1));
        auto candidates = suggested(origin, pitchMask(c.pitches), selectedNotes);
        one.bind("01   Chord suggestions  /  " + String(c.name), std::move(candidates), origin, "No diatonic chord contains all selected notes.", reset);
    }
    void searchRow(bool reset) {
        three.bind("03   Search results", search(lib, query.getText(), circle.tonic), origin, "No match. Try Cmaj7, F#m9 or Bb7/D.", reset);
    }
    void circleRows() {
        wheelHighlight(circle); circleSuggestions(true);
        auto candidates = rootCatalog(lib,circle.tonic);
        // Put in-key shapes first; for a minor key also lead with its tonic triad.
        const int signature = pitchMask(harmony::degreeChord(circle,1).pitches);
        auto rank = [&](const Chord& c) { return std::pair{pitchMask(c.pitches) != signature, outside(circle,c)}; };
        std::stable_sort(candidates.begin(), candidates.end(), [&](const auto& a,const auto& b){ return rank(a)<rank(b); });
        two.bind("02   Circle of Fifths chords  /  " + scaleName(circle), std::move(candidates), origin, {}, true); searchRow(true);
    }
    void selectDestination(bool notify, bool commit) {
        stopPath(); mode.setSelectedId(int(target.mode)+1, silent); focus = harmony::degreeChord(target,1);
        modRows(); wheelHighlight(target); syncEditBoxes(); repaint(); if (notify) emit(commit);
    }
    void modRows() {
        auto common = pivots(origin, target);
        const auto arrow = "  " + String::charToString(0x2192) + "  ";
        one.bind("01   Common pivots  /  " + scaleName(origin) + arrow + scaleName(target), std::move(common), origin,
                 "No common triad. Use the destination cadence for a direct modulation.", true);
        auto approach = cadence(target,degree.getSelectedId());
        auto cadenceTitle = "02   Cadence  /  predominant" + arrow + "dominant" + arrow + String(approach.back().name);
        two.bind(cadenceTitle, std::move(approach), target, {}, true);
        three.bind("03   Destination scale  /  " + scaleName(target), harmony::degreeChords(target), origin, {}, true);
    }
    void playPath() {
        path = {harmony::degreeChord(origin,1)};
        for (auto c : pivots(origin,target)) if (pc(c.root) != pc(origin.tonic) && pc(c.root) != pc(target.tonic)) { path.push_back(std::move(c)); break; }
        auto cadenceNotes = cadence(target,degree.getSelectedId()); path.insert(path.end(),cadenceNotes.begin(),cadenceNotes.end());
        pathIndex = 0; play.setButtonText("Stop path"); startTimer(520); timerCallback();
    }
    void stopPath() { stopTimer(); path.clear(); play.setButtonText("Play path"); }
    void timerCallback() override {
        if (pathIndex >= path.size()) { stopPath(); return; }
        focus = path[pathIndex++]; repaint(); emit(false);
    }
    void visibilityChanged() override { if (!isShowing()) stopPath(); }

    void loadPreset() {
        preset = nullptr; selectedNode = 0; nodeEdits = {};
        for (const auto& p : lib.presets) if (p.genre == genre.getText() && p.mood == mood.getText()) { preset = &p; break; }
        refreshExplore();
    }
    int exploreShift() const {
        if (!preset) return 0;
        int keyShift = lock.getToggleState() ? pc(origin.tonic - preset->slots[0].root + 6) - 6 : 0;
        return keyShift + transpose.getSelectedId()-13;
    }
    void chooseNode(int i, bool commit) { if (preset) { selectedNode = i; refreshExplore(); emit(commit); } }
    void refreshExplore() {
        if (view != View::Explore) return;
        if (preset) {
            focus = preset->slots[selectedNode]; dynamic = dynamicScale(current());
            const auto colours = fixed.getToggleState() ? dynamic : origin;
            for (int i = 0; i < int(nodes.size()); ++i) {
                auto& b = nodes[i]; auto c = edited(preset->slots[i], nodeEdits[i], exploreShift());
                b.setButtonText(String(c.name).upToFirstOccurrenceOf("/",false,false)); b.fill = scaleColour(colours,c); b.active = i == selectedNode;
                b.setTooltip(String(c.name) + "   " + notesOf(c) + "   |   Double-click to insert"); b.repaint();
            }
        } else focus.reset();
        fixed.setButtonText(fixed.getToggleState() ? "Dynamic scale" : "Fixed song scale"); syncEditBoxes(); repaint();
    }

    void resized() override;
    void placeWheel();
    void placeRows();
    void placeExplore();
    void paint(Graphics&) override;
    void paintWheel(Graphics&);
    void paintExplore(Graphics&);
};

void HarmonicAtlas::Surface::resized() {
    for (auto* c : getChildren()) c->setVisible(false);
    auto area = getLocalBounds().reduced(5); footer = area.removeFromBottom(44); area.removeFromBottom(5);
    auto controls = footer.reduced(8,7);
    auto before = [&](Component& c, int width) { place(c, controls.removeFromRight(width)); controls.removeFromRight(4); };
    before(insert, 90); before(audition, 68); before(semi, 92); before(inversion, 76); before(octave, 86); info = controls;
    if (view == View::Explore) {
        left = take(area, jlimit(172,234,getWidth()/5)); right = area.removeFromRight(jlimit(172,248,getWidth()/4));
        area.removeFromRight(5); middle = area; placeExplore();
    } else {
        left = take(area, jlimit(193,304,getWidth()*28/100)); right = area;
        placeWheel(); placeRows();
    }
}

void HarmonicAtlas::Surface::placeWheel() {
    auto body = left.reduced(7); body.removeFromTop(38);
    place(apply, body.removeFromBottom(25).withSizeKeepingCentre(std::min(body.getWidth(),128),25));
    const auto center = body.toFloat().getCentre(); float d = float(std::min(body.getWidth(),body.getHeight()));
    for (int i = 0; i < int(wheel.size()); ++i) {
        bool inner = i >= 12;
        atCentre(wheel[i],orbit(center, d*(inner?.276f:.427f), float(i%12)/12.f), roundToInt(d*(inner?.143f:.155f)));
    }
}

void HarmonicAtlas::Surface::placeRows() {
    auto r = right.reduced(9,6);
    if (view == View::Circle) {
        filters = r.removeFromTop(24); auto notes = filters; notes.removeFromLeft(72);
        for (int i = 0; i < 12; ++i) { int w = notes.getWidth() / (12-i); place(keys[i], notes.removeFromLeft(w).reduced(1,1)); }
    } else {
        modeArea = r.removeFromTop(26); auto hdr = modeArea;
        place(play,hdr.removeFromRight(78)); hdr.removeFromRight(5); place(degree,hdr.removeFromRight(112)); hdr.removeFromRight(5);
        place(mode,hdr.removeFromRight(std::min(146,hdr.getWidth()/2)));
    }
    r.removeFromTop(2);
    int editHeight = view == View::Circle ? 25 : 0;
    int h = (r.getHeight()-editHeight) / 3;
    place(one, r.removeFromTop(h)); place(two,r.removeFromTop(h));
    if (view == View::Circle) {
        queryArea = r.removeFromTop(editHeight).reduced(1,1); auto q = queryArea; q.removeFromLeft(76);
        place(query,q.withWidth(std::min(q.getWidth(),350)));
    }
    place(three,r);
}

void HarmonicAtlas::Surface::placeExplore() {
    auto r = left.reduced(12,7); const int row = jlimit(22,32,left.getHeight()/10);
    r.removeFromTop(42); r.removeFromTop(14); place(genre,r.removeFromTop(row));
    r.removeFromTop(17); place(mood,r.removeFromTop(row)); r.removeFromTop(17); place(transpose,r.removeFromTop(row));
    r.removeFromTop(8); place(lock,r.removeFromTop(row));
    for (Component* c : std::initializer_list<Component*>{&genre,&mood,&transpose,&lock,&fixed}) c->setEnabled(preset != nullptr);
    auto ins = right.reduced(12,8); place(apply,ins.removeFromBottom(26)); ins.removeFromBottom(5); place(fixed,ins.removeFromBottom(26));
    if (!preset) return;
    auto diagram = middle.reduced(7,4); diagram.removeFromTop(17); diagram.removeFromBottom(17);
    auto center = diagram.toFloat().getCentre(); float d = float(std::min(diagram.getWidth(),diagram.getHeight()));
    for (int i = 0; i < int(nodes.size()); ++i) {
        bool inner = i<5;
        float turns = inner ? .5f + i/5.f : (i-5)/11.f;
        atCentre(nodes[i],orbit(center, d*(inner?.206f:.413f), turns), roundToInt(d*.180f));
    }
}

void HarmonicAtlas::Surface::paint(Graphics& g) {
    g.fillAll(ink::background);
    panel(g,left); panel(g,right); panel(g,footer);
    if (view == View::Explore) { panel(g,middle); paintExplore(g); }
    else paintWheel(g);
    if (view == View::Circle) {
        caption(g,"Note filter",filters.withWidth(72),12,ink::muted);
        caption(g,"Find chord",queryArea.withWidth(76),12,ink::muted);
    } else if (view == View::Modulation) {
        caption(g,"Destination",modeArea.withRight(mode.getX()-4),12,ink::accent);
    }
    if (focus) {
        auto c = current(); auto r = info.reduced(3,0);
        auto title = r.removeFromLeft(std::min(142,r.getWidth()*5/12));
        caption(g,c.name,title,17,ink::bright,Justification::centredLeft,true);
        caption(g,notesOf(c),r,12,ink::muted);
    } else caption(g,"No chord selected",info,14);
}

void HarmonicAtlas::Surface::paintWheel(Graphics& g) {
    auto h = left.reduced(12,5);
    caption(g,view == View::Circle ? "HARMONY  /  01" : "HARMONY  /  02",h.removeFromTop(15),10,ink::accent,Justification::centredLeft,true);
    caption(g,view == View::Circle ? "Circle of Fifths" : "Modulation",h.removeFromTop(23),19,ink::bright,Justification::centredLeft,true);
    if (wheel[0].getWidth() <= 0) return;
    const auto top = wheel[0].getBounds().toFloat().getCentre();
    const auto centre = (top + wheel[6].getBounds().toFloat().getCentre())*.5f;
    auto rr = [&] (float radius) { return Rectangle<float>(2*radius,2*radius).withCentre(centre); };
    g.setColour(line); g.drawEllipse(rr(top.getDistanceFrom(centre)),1);
    g.drawEllipse(rr(wheel[12].getBounds().toFloat().getCentre().getDistanceFrom(centre)),1);
    for (int i=0;i<12;++i) g.drawLine({wheel[i].getBounds().toFloat().getCentre(),wheel[i+12].getBounds().toFloat().getCentre()},.8f);
    auto hub = rr(top.getDistanceFrom(centre)*.37f); g.setColour(ink::background); g.fillEllipse(hub);
    g.setColour(ink::accent.withAlpha(.5f)); g.drawEllipse(hub,1);
    auto key = view == View::Circle ? circle : target;
    auto text = hub.getSmallestIntegerContainer().reduced(1); auto first = text.removeFromTop(text.getHeight()*3/5);
    caption(g,names[pc(key.tonic)],first,20,ink::bright,Justification::centredBottom,true);
    caption(g,modes[int(key.mode)],text,10,ink::accent,Justification::centredTop);
}

void HarmonicAtlas::Surface::paintExplore(Graphics& g) {
    auto h = left.reduced(12,7); caption(g,"HARMONY  /  03",h.removeFromTop(15),10,ink::accent,Justification::centredLeft,true);
    caption(g,"Explore",h.removeFromTop(25),20,ink::bright,Justification::centredLeft,true);
    for (auto item : {std::pair{&genre,"Genre"}, {&mood,"Mood"}, {&transpose,"Constellation transpose"}})
        caption(g,item.second,item.first->getBounds().translated(0,-15).withHeight(15),11);
    auto diagram = middle.reduced(10,4); auto heading = diagram.removeFromTop(16);
    caption(g,"CHORD CONSTELLATION",heading,10,ink::muted,Justification::centred,true);
    if (!preset) {
        g.setFont(FontOptions(14.f)); g.setColour(ink::muted);
        g.drawFittedText(lib.problem,diagram,Justification::centred,4); return;
    }
    auto legend = diagram.removeFromBottom(16);
    caption(g,"DARK SIDE",legend,10,ink::muted,Justification::centredLeft);
    caption(g,"LIGHT SIDE",legend,10,ink::muted,Justification::centredRight);
    auto pt = [this](int i){ return nodes[i].getBounds().toFloat().getCentre(); };
    g.setColour(line.brighter(.12f));
    for (int i=0;i<5;++i) g.drawLine({pt(i),pt((i+1)%5)},1);
    for (int i=0;i<11;++i) {
        g.drawLine({pt(i+5),pt(5+(i+1)%11)},1);
        const int nearest = (roundToInt((i/11.f+.5f)*5.f))%5;
        g.drawLine({pt(i+5),pt(nearest)},.8f);
    }
    auto ins = right.reduced(12,8); caption(g,"TONAL CENTRE",ins.removeFromTop(18),10,ink::accent,Justification::centredLeft,true);
    auto centerChord = edited(preset->slots[0],{},exploreShift());
    caption(g,scaleName(dynamicScale(centerChord)),ins.removeFromTop(27),20,ink::bright,Justification::centredLeft,true);
    caption(g,preset->name,ins.removeFromTop(20),12); ins.removeFromTop(6);
    g.setColour(line); g.drawHorizontalLine(ins.getY(),float(ins.getX()),float(ins.getRight())); ins.removeFromTop(7);
    caption(g,"DYNAMIC SCALE",ins.removeFromTop(17),10,ink::accent,Justification::centredLeft,true);
    caption(g,scaleName(dynamic),ins.removeFromTop(22),17,ink::bright,Justification::centredLeft,true);
    int mask = pitchMask(harmony::scaleNotes(dynamic));
    auto strip = ins.removeFromTop(15);
    for (int n=0;n<12;++n) {
        g.setColour((mask & (1<<n)) ? ink::accent.withAlpha(.85f) : ink::raised);
        g.fillRoundedRectangle(strip.removeFromLeft(strip.getWidth()/(12-n)).reduced(1,3).toFloat(),2);
    }
    if (ins.getY()+20 < fixed.getY()) caption(g,"Song  /  " + scaleName(origin),ins.removeFromTop(20),12);
}

HarmonicAtlas::HarmonicAtlas() : surface(std::make_unique<Surface>(*this)) {
    setName("Harmonic Atlas"); addAndMakeVisible(*surface); setSize(1050,370);
}
HarmonicAtlas::~HarmonicAtlas() = default;
void HarmonicAtlas::setView(View view) {
    if (view == surface->view) return;
    surface->view = view; surface->initView();
}
void HarmonicAtlas::setScale(harmony::Scale scale) { surface->changeScale(scale); }
void HarmonicAtlas::setContextChord(std::optional<harmony::Chord> chord) {
    if (chord && chord->pitches.empty()) chord.reset();
    const auto& old = surface->context;
    if ((!old && !chord) || (old && chord && old->name == chord->name && old->root == chord->root && old->pitches == chord->pitches)) return;
    surface->context = std::move(chord);
    if (surface->view == View::Circle) surface->circleSuggestions(true);
}
void HarmonicAtlas::resized() { surface->setBounds(getLocalBounds()); }
void HarmonicAtlas::visibilityChanged() { if (surface && !isVisible()) surface->stopPath(); }
} // namespace crest
