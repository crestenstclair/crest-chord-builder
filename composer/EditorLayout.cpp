#include "Editor.h"
using namespace juce;
namespace crest {
namespace {
void left(Component &c, Rectangle<int> &area, int width, int height = 28) {
    auto r = area.removeFromLeft(width).reduced(2, 1);
    c.setBounds(r.withSizeKeepingCentre(r.getWidth(), jmin(height, r.getHeight())));
}
void right(Component &c, Rectangle<int> &area, int width, int height = 28) {
    auto r = area.removeFromRight(width).reduced(2, 1);
    c.setBounds(r.withSizeKeepingCentre(r.getWidth(), jmin(height, r.getHeight())));
}
void cap(Graphics &g, String text, Rectangle<int> bounds) {
    g.setFont(FontOptions(10, Font::bold));
    g.setColour(studio::dim);
    g.drawText(text, bounds, Justification::centredLeft);
}
} // namespace
void Editor::resized() {
    auto area = getLocalBounds();
    auto head = area.removeFromTop(47).reduced(12, 1);
    head.removeFromLeft(31);
    left(title, head, 202, 37);
    left(undo, head, 80);
    head.removeFromLeft(12);
    left(play, head, 97);
    left(stop, head, 52);
    right(menu, head, 69);
    right(meter, head, 70);
    right(bpm, head, 100);
    right(host, head, 90);
    right(tempoReadout, head, 85);
    nowPlaying.setBounds(head.reduced(7, 0));
    sectionB = area.removeFromTop(70);
    auto b = sectionB.reduced(12, 8);
    b.removeFromLeft(28);
    auto select = b.removeFromLeft(jlimit(182, 218, getWidth() / 6));
    select.removeFromTop(15);
    left(root, select, 57);
    left(mode, select, select.getWidth());
    b.removeFromLeft(12);
    right(scaleOct, b, 73);
    right(stack, b, 89);
    b.removeFromRight(9);
    for (int i = 0; i < 7; ++i)
        degrees[i].setBounds(b.removeFromLeft(b.getWidth() / (7 - i)).reduced(2, 0));
    keyboard.setBounds(area.removeFromBottom(jlimit(64, 88, getHeight() / 10)));
    footerBand = area.removeFromBottom(38);
    auto foot = footerBand.reduced(8, 3);
    left(keysView, foot, 49);
    left(guitarView, foot, 52);
    foot.removeFromLeft(6);
    left(perform, foot, 81);
    left(bankButton, foot, 108);
    left(motion, foot, jlimit(115, 169, getWidth() / 8));
    left(speed, foot, 65);
    foot.removeFromLeft(6);
    left(swing, foot, 113);
    left(keyLock, foot, 86);
    left(voiceGroup, foot, 130);
    left(summary, foot, foot.getWidth());
    auto statusArea = area.removeFromBottom(22);
    status.setBounds(statusArea.reduced(10, 0));
    sectionC = area.removeFromBottom(83);
    auto c = sectionC.reduced(12, 4);
    auto sel = c.removeFromLeft(157);
    sel.removeFromLeft(24);
    sel.removeFromTop(12);
    destination.setBounds(sel.removeFromTop(28));
    bind.setBounds(sel.removeFromTop(23).removeFromLeft(49));
    c.removeFromLeft(7);
    auto exportArea = c.removeFromRight(136);
    sendClips.setBounds(exportArea.removeFromTop(27).reduced(2,1));
    drag.setBounds(exportArea.removeFromTop(24).reduced(2,1));
    writeMidi.setBounds(exportArea.reduced(2,1));
    left(dockPlay, c, 33);
    auto strip = c.removeFromTop(45);
    for (int i = 0; i < slotLimit; ++i)
        slots[i].setBounds(strip.removeFromLeft(strip.getWidth() / (slotLimit - i)).reduced(1, 0));
    left(length, c, 95, 23);
    left(earlier, c, 30, 23);
    left(later, c, 30, 23);
    left(rest, c, 49, 23);
    left(remove, c, 67, 23);
    if (!picker && book.page != 4) {
        right(add, c, 125, 23);
        detail.setBounds(c);
    }
    auto rail = area.removeFromLeft(100);
    for (int i = 0; i < 5; ++i)
        nav[i].setBounds(rail.removeFromTop(rail.getHeight() / (5 - i)));
    mainArea = area;
    auto page = area.reduced(9, 5);
    auto toolbar = page.removeFromTop(31);
    if (picker) {
        right(pickerClose, toolbar, 70, 25);
        left(detail, toolbar, toolbar.getWidth());
        auto tools = page.removeFromBottom(30);
        right(add, tools, 138, 26);
        for (auto *control : {&semiUp, &semiDown, &octaveUp, &octaveDown})
            right(*control, tools, 65, 25);
    } else {
        left(workspace, toolbar, 165, 28);
        right(common, toolbar, 139, 25);
        if (book.page == 4) {
            right(load, toolbar, 52, 25);
            right(progression, toolbar, 157, 25);
            right(clone, toolbar, 109, 25);
        }
    }
    if (book.page == 4 && !picker)
        grid.setBounds(page);
    else if (picker || book.page == 3)
        palette.setBounds(page);
    else
        atlas.setBounds(page);
    shade.setBounds(getLocalBounds());
    if (browser)
        browser->setBounds(getLocalBounds().reduced(getWidth() / 20, 70));
}
void Editor::paint(Graphics &g) {
    g.fillAll(studio::bg);
    g.setColour(studio::band);
    g.fillRect(sectionB);
    g.fillRect(sectionC);
    g.fillRect(footerBand);
    g.setColour(studio::panel);
    g.fillRect(mainArea);
    g.setColour(studio::blue);
    g.fillRoundedRectangle(12, 11, 25, 25, 5);
    g.setColour(studio::text);
    for (int i = 0; i < 3; ++i)
        g.fillRoundedRectangle(17.f + 5 * i, 24.f - i * 4, 3, 6.f + i * 2, 1);
    const int available=tempoReadout.getX()-stop.getRight()-18;
    if(available>105 && !nowPlaying.isVisible())cap(g,"CREATE    /    v" + String(JucePlugin_VersionString),{stop.getRight()+12,1,available,44});
    g.setColour(studio::dim);
    g.setFont(FontOptions(20));
    g.drawText("B", 12, sectionB.getY(), 24, sectionB.getHeight(), Justification::centredLeft);
    g.drawText("C", 12, sectionC.getY(), 24, sectionC.getHeight(), Justification::centredLeft);
    cap(g, "CURRENT SCALE", {42, sectionB.getY() + 4, 160, 18});
    cap(g, "DESTINATION", {38, sectionC.getY(), 125, 17});
    g.setColour(studio::line);
    for (int y : {sectionB.getY(), sectionB.getBottom(), sectionC.getY(), footerBand.getY()})
        g.drawHorizontalLine(y, 0, float(getWidth()));
}
} // namespace crest
