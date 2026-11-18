#pragma once
#include "ChordDrag.h"
#include "Palette.h"
#include "StudioPad.h"

namespace crest::palette_ui {
using harmony::Chord;
using juce::Colour;
using juce::Graphics;
using juce::Justification;
using juce::String;
using juce::TextButton;
using MaybeChord = std::optional<Chord>;
inline String pitchList(const std::vector<int> &pitches) {
    juce::StringArray result;
    for (auto n : pitches)
        result.add(String(harmony::noteName(n)) + String(n / 12 - 1));
    return result.joinIntoString(" ");
}

class Chip : public TextButton {
  public:
    enum Style { plain, pill, menu, tab };
    enum Icon { none, left, right, play, close };
    Chip(String label = {}, Style s = plain, Icon glyph = none) : TextButton(label), style(s), icon(glyph) {
        setMouseCursor(juce::MouseCursor::PointingHandCursor);
    }
    bool active = false;
    bool tint = false;
    void paintButton(Graphics &g, bool hot, bool down) override {
        auto area = getLocalBounds().toFloat().reduced(.5f);
        bool item = style == menu;
        float radius = item ? 1.f : style == pill ? area.getHeight() * .5f : 3.f;
        auto fill = active && style != tab ? Colour(0xff366469) : item ? studio::cell : studio::band;
        if (hot || down)
            fill = fill.brighter(down ? .2f : .12f);
        if (style != plain || hot || down) {
            g.setColour(fill);
            g.fillRoundedRectangle(area, radius);
        }
        if (style == pill || hasKeyboardFocus(false)) {
            g.setColour(hasKeyboardFocus(false) ? studio::text : (active ? studio::aqua : studio::line));
            g.drawRoundedRectangle(area, radius, 1.f);
        }
        if (active && style == tab) {
            g.setColour(studio::aqua);
            g.fillRect(6, getHeight() - 2, getWidth() - 12, 2);
        }
        g.setColour(!isEnabled() ? studio::dim.withAlpha(.48f)
                    : active     ? studio::text
                    : tint       ? studio::aqua
                                 : studio::dim.brighter(.2f));
        if (icon != none) {
            drawIcon(g, area.getCentre());
            return;
        }
        g.setFont(juce::FontOptions(style == tab ? 15.f : 12.5f, active ? juce::Font::bold : juce::Font::plain));
        g.drawFittedText(getButtonText(), getLocalBounds().reduced(item ? 9 : 2, 1),
                         item ? Justification::centredLeft : Justification::centred, 1, .78f);
    }

  private:
    void drawIcon(Graphics &g, juce::Point<float> mid) const {
        float x = mid.x, y = mid.y;
        juce::Path p;
        if (icon == play) {
            p.addTriangle(x - 3.5f, y - 5, x - 3.5f, y + 5, x + 5, y);
        } else if (icon == close) {
            p.startNewSubPath(x - 4, y - 4);
            p.lineTo(x + 4, y + 4);
            p.startNewSubPath(x + 4, y - 4);
            p.lineTo(x - 4, y + 4);
        } else {
            float d = icon == right ? 1.f : -1.f;
            p.startNewSubPath(x - 2 * d, y - 4);
            p.lineTo(x + 2 * d, y);
            p.lineTo(x - 2 * d, y + 4);
        }
        g.strokePath(p, juce::PathStrokeType(1.4f));
    }
    Style style;
    Icon icon;
};

class Card;
struct CardState {
    explicit CardState(Palette &parent) : owner(parent) {}
    Palette &owner;
    Card *selected = nullptr;
    Card *hovered = nullptr;
    void select(Card *);
    void hover(Card *);
    void clear() {
        select(nullptr);
        hover(nullptr);
    }
};

class Card : public TextButton {
  public:
    enum Style { tile, suggestion, bubble };
    void connect(CardState &events, Style appearance) {
        state = &events;
        style = appearance;
        setMouseCursor(juce::MouseCursor::PointingHandCursor);
        onClick = [this] {
            if (!sound)
                return;
            state->select(this);
            auto chord = *sound;
            if (state->owner.onChoose)
                state->owner.onChoose(chord);
        };
    }
    void display(MaybeChord chord, harmony::Scale scale, String sub = {}) {
        if (!sound || !chord || sound->pitches != chord->pitches || sound->root != chord->root ||
            sound->name != chord->name) {
            if (state->selected == this)
                state->select(nullptr);
            if (state->hovered == this)
                state->hover(nullptr);
        }
        sound = std::move(chord);
        setEnabled(bool(sound));
        setVisible(bool(sound));
        if (!sound)
            return;
        auto foreign = harmony::foreignNotes(scale, *sound);
        outside = int(foreign.size());
        auto label = String(sound->name);
        if (label.length() > 0 && String("ABCDEFG").containsChar(label[0]) &&
            label.substring(1).containsOnly("b#"))
            label += "maj";
        if (!label.contains("/") && sound->root % 12 != sound->pitches.front() % 12)
            label += "/" + String(harmony::noteName(sound->pitches.front()));
        setButtonText(label);
        subtitle = sub;
        String fit = outside == 0 ? "In scale" : "Outside scale: " + pitchList(foreign);
        setName(label + " - " + fit);
        setTooltip(label + "    " + pitchList(sound->pitches) + "\n" + fit +
                   "   /   Double-click to insert or drag to a slot");
        repaint();
    }
    void unavailable(const Chord &source, harmony::Scale scale, const String &filter) {
        display({}, scale);
        setButtonText(String(source.name));
        setTooltip("No " + filter + " shape available for " + String(source.name));
        setVisible(true);
    }
    MaybeChord sound;
    bool reference = false;
    void mouseEnter(const juce::MouseEvent &e) override {
        TextButton::mouseEnter(e);
        if (sound)
            state->hover(this);
    }
    void mouseExit(const juce::MouseEvent &e) override {
        TextButton::mouseExit(e);
        if (state->hovered == this)
            state->hover(nullptr);
    }
    void mouseDown(const juce::MouseEvent &e) override {
        consumed = false;
        TextButton::mouseDown(e);
    }
    void mouseDrag(const juce::MouseEvent &e) override {
        if (sound && !consumed && e.getDistanceFromDragStart() >= 5) {
            consumed = true;
            beginChordDrag(*this, *sound);
        }
    }
    void mouseDoubleClick(const juce::MouseEvent &) override {
        if (!sound)
            return;
        consumed = true;
        state->select(this);
        auto chord = *sound;
        if (state->owner.onInsert)
            state->owner.onInsert(chord);
    }
    void mouseUp(const juce::MouseEvent &e) override {
        if (consumed) {
            setState(buttonNormal);
            return;
        }
        TextButton::mouseUp(e);
    }
    void paintButton(Graphics &g, bool hot, bool down) override {
        bool chosen = state && state->selected == this;
        auto bounds = getLocalBounds().toFloat().reduced(1.f);
        if (!isEnabled()) {
            g.setColour(studio::line.withAlpha(.65f));
            g.drawRoundedRectangle(bounds, 4, 1);
            g.setColour(studio::dim.withAlpha(.7f));
            g.setFont(juce::FontOptions(12.f));
            auto area = getLocalBounds().reduced(3);
            g.drawText(getButtonText(), area.removeFromTop(area.getHeight() * 6 / 10),
                       Justification::centredBottom, true);
            g.setFont(juce::FontOptions(10.f));
            g.drawText("No shape", area, Justification::centredTop, true);
            return;
        }
        Colour colour = outside == 0 ? studio::blue : outside == 1 ? Colour(0xff7190ad) : Colour(0xff616b77);
        auto fill = style == tile ? colour : studio::panel.interpolatedWith(colour, .21f);
        if (chosen || down || hot)
            fill = fill.brighter(chosen ? .28f : .15f);
        float radius = style == bubble ? bounds.getHeight() * .5f : 4.f;
        if (style == tile)
            g.setColour(fill);
        else
            g.setGradientFill(juce::ColourGradient(fill.brighter(.15f), bounds.getCentre(), fill.darker(.12f),
                                                   bounds.getTopRight(), true));
        g.fillRoundedRectangle(bounds, radius);
        bool referenceOutline = reference && state && !state->selected;
        g.setColour(chosen || hasKeyboardFocus(false) ? studio::text
                    : referenceOutline                ? studio::text.withAlpha(.73f)
                                                      : colour.brighter(.24f));
        g.drawRoundedRectangle(bounds, radius, chosen ? 2.f : 1.f);
        auto text = getLocalBounds().reduced(style == tile ? 7 : 3, 3);
        g.setColour(style == tile  ? studio::text
                    : outside == 0 ? Colour(0xff88b2ff)
                    : outside == 1 ? Colour(0xffc0d0df)
                                   : studio::dim);
        g.setFont(juce::FontOptions(style == tile ? 14.f : juce::jlimit(12.f, 18.f, getHeight() * .24f),
                                    juce::Font::bold));
        if (style != tile) {
            g.drawFittedText(getButtonText(), text, Justification::centred, 2, .83f);
            return;
        }
        g.drawFittedText(getButtonText(), text.removeFromTop(text.getHeight() * 6 / 10),
                         Justification::centredLeft, 1, .77f);
        g.setColour(studio::text.withAlpha(.83f));
        g.setFont(juce::FontOptions(11.f));
        g.drawFittedText(subtitle, text, Justification::centredLeft, 1, .85f);
    }

  private:
    CardState *state = nullptr;
    Style style = tile;
    int outside = 0;
    bool consumed = false;
    String subtitle;
};
inline void CardState::select(Card *pad) {
    auto *old = std::exchange(selected, pad);
    if (old)
        old->repaint();
    if (pad)
        pad->repaint();
}
inline void CardState::hover(Card *pad) {
    if (hovered == pad)
        return;
    hovered = pad;
    if (owner.onHover)
        owner.onHover(pad ? pad->sound : MaybeChord{});
}
} // namespace crest::palette_ui
