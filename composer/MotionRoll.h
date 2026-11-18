#pragma once
#include "Harmony.h"
#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_graphics/juce_graphics.h>

namespace crest::motion {
// Literal SMF pitches, starts and gates, normalised to the full cycle including
// trailing silence. This is deliberately independent of the sketch pitch mapper.
class Roll {
  public:
    static Roll read(const juce::File &file) {
        Roll roll;
        auto stream = file.createInputStream();
        if (!stream || stream->getTotalLength() > 128 * 1024)
            return roll;
        juce::MidiFile midi;
        if (!midi.readFrom(*stream, true))
            return roll;
        roll.length = midi.getLastTimestamp();
        for (int i = 0; i < midi.getNumTracks(); ++i)
            roll.addTrack(*midi.getTrack(i));
        return roll;
    }
    // Chord banks store ordered slots, not timing. Give slots equal width and
    // preserve a shared pitch axis across variants so inversion/octave changes
    // remain visible even when two variants have identical chord labels.
    static Roll voicings(const std::vector<harmony::Chord> &chords) {
        Roll roll;
        roll.length = double(chords.size());
        roll.low = 24;
        roll.high = 95;
        for (size_t i = 0; i < chords.size(); ++i)
            for (auto pitch : chords[i].pitches) {
                roll.low = std::min(roll.low, pitch);
                roll.high = std::max(roll.high, pitch);
                roll.notes.push_back({double(i), double(i) + .92, pitch});
            }
        return roll;
    }
    bool available() const { return length > 0 && !notes.empty(); }
    size_t noteCount() const { return notes.size(); }
    void draw(juce::Graphics &g, juce::Rectangle<float> box, juce::Colour colour) const {
        if (!available())
            return;
        const auto scaleX = box.getWidth() / length;
        const auto scaleY = (box.getHeight() - 2.f) / float(std::max(1, high - low));
        g.setColour(colour);
        for (const auto &n : notes) {
            float x = box.getX() + float(n.start * scaleX);
            float y = high == low ? box.getCentreY() - 1.f : box.getY() + float(high - n.pitch) * scaleY;
            g.fillRect(x, y, std::max(1.f, float((n.end - n.start) * scaleX)), 1.65f);
        }
    }

  private:
    struct Note { double start, end; int pitch; };
    void addTrack(const juce::MidiMessageSequence &track) {
        for (const auto *event : track) {
            if (!event->message.isNoteOn() || !event->noteOffObject)
                continue;
            int p = event->message.getNoteNumber();
            notes.push_back({event->message.getTimeStamp(), event->noteOffObject->message.getTimeStamp(), p});
            low = std::min(low, p);
            high = std::max(high, p);
        }
    }
    std::vector<Note> notes;
    double length = 0.;
    int low = 127, high = 0;
};
} // namespace crest::motion
