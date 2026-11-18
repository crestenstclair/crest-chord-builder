#include "InstrumentStrip.h"
using namespace juce;
namespace crest {
namespace {
constexpr int opens[]{64, 59, 55, 50, 45, 40};
constexpr int natural[]{0, 2, 4, 5, 7, 9, 11};
} // namespace
InstrumentStrip::InstrumentStrip() {
    setName("Playable keyboard and fretboard");
}
void InstrumentStrip::setNotes(harmony::Scale s, const std::vector<int> &chord) {
    scale = {};
    chosen = {};
    for (int p : harmony::scaleNotes(s))
        scale[p % 12] = true;
    for (int p : chord)
        if (p >= 0 && p < 128)
            chosen[p] = true;
    repaint();
}
void InstrumentStrip::setSounding(const std::array<bool, 128> &n) {
    if (n != sounding) {
        sounding = n;
        repaint();
    }
}
void InstrumentStrip::resized() {
    keys.clear();
    const float w = getWidth() / 28.f, h = float(getHeight());
    for (int i = 0; i < 28; ++i) {
        int n = 36 + 12 * (i / 7) + natural[i % 7];
        keys.push_back({n, false, {w * i, 0, w, h}});
    }
    for (int i = 0; i < 27; ++i) {
        if (i % 7 == 2 || i % 7 == 6)
            continue;
        keys.push_back({keys[i].note + 1, true, {w * (i + .69f), 0, w * .62f, h * .60f}});
    }
}
void InstrumentStrip::paint(Graphics &g) {
    if (guitar) {
        paintStrings(g);
        return;
    }
    for (const auto &k : keys) {
        auto r = k.box.reduced(.55f, .5f);
        bool held = sounding[k.note] || pressed == k.note;
        Colour body = held             ? studio::aqua
                      : chosen[k.note] ? Colour(0xffa3bce4)
                      : k.black        ? Colour(0xff26292d)
                                       : Colour(0xffe0e3e3);
        g.setColour(body);
        g.fillRect(r);
        if (scale[k.note % 12]) {
            g.setColour(k.black ? studio::blueHi : studio::blue);
            g.fillRect(r.removeFromBottom(3));
        }
        if (!k.black) {
            g.setColour(Colour(0xff424953));
            g.setFont(FontOptions(11));
            g.drawText(String(harmony::noteName(k.note)) + (k.note % 12 == 0 ? String(k.note / 12 - 1) : ""),
                       r.removeFromBottom(15), Justification::centred);
        }
    }
}
void InstrumentStrip::paintStrings(Graphics &g) {
    g.fillAll(studio::panel);
    float w = getWidth() / 13.f, h = getHeight() / 6.f;
    for (int f = 0; f <= 12; ++f) {
        g.setColour(studio::line);
        g.drawVerticalLine(int(f * w), 0, float(getHeight()));
    }
    for (int s = 0; s < 6; ++s) {
        float y = (s + .5f) * h;
        g.setColour(studio::dim.withAlpha(.5f));
        g.drawHorizontalLine(int(y), 0, float(getWidth()));
        for (int f = 0; f <= 12; ++f) {
            int n = opens[s] + f;
            bool lit = chosen[n] || sounding[n] || pressed == n;
            if (!lit && !scale[n % 12])
                continue;
            float x = (f + .5f) * w;
            g.setColour(lit ? studio::aqua : studio::blue);
            g.fillRoundedRectangle(x - 12, y - h * .43f, 24, h * .86f, 3);
            g.setColour(lit ? studio::bg : studio::text);
            g.setFont(FontOptions(jlimit(8.f, 12.f, h * .85f)));
            g.drawText(String(harmony::noteName(n)), int(x - 13), int(y - h / 2), 26, int(h),
                       Justification::centred);
        }
    }
}
int InstrumentStrip::hit(Point<float> p) const {
    if (!getLocalBounds().toFloat().contains(p))
        return -1;
    if (guitar)
        return opens[jlimit(0, 5, int(6 * p.y / getHeight()))] + jlimit(0, 12, int(13 * p.x / getWidth()));
    for (auto it = keys.rbegin(); it != keys.rend(); ++it)
        if (it->box.contains(p))
            return it->note;
    return -1;
}
void InstrumentStrip::press(int n) {
    if (n < 0 || (locked && !scale[n % 12])) {
        if (pressed >= 0 && onRelease)
            onRelease();
        pressed = -1;
        repaint();
        return;
    }
    if (n != pressed) {
        pressed = n;
        if (onNote)
            onNote(n);
        repaint();
    }
}
void InstrumentStrip::mouseDown(const MouseEvent &e) {
    press(hit(e.position));
}
void InstrumentStrip::mouseDrag(const MouseEvent &e) {
    press(hit(e.position));
}
void InstrumentStrip::mouseUp(const MouseEvent &) {
    if (pressed >= 0 && onRelease)
        onRelease();
    pressed = -1;
    repaint();
}
} // namespace crest
