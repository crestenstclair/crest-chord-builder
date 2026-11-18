#include "BoundKeys.h"
using namespace juce;
namespace crest {
int BoundKeys::slotFor(int n) {
    constexpr int keys[]{36, 38, 40, 41, 43, 45, 47, 48};
    for (int i = 0; i < 8; ++i)
        if (n == keys[i])
            return i;
    return -1;
}
void BoundKeys::publish(const Book &b) {
    Mapping next{};
    if (b.bound >= 0) {
        const auto &slots = b.sketches.at(size_t(b.bound)).slots;
        for (size_t i = 0; i < slots.size(); ++i) {
            auto &dest = next[i];
            for (int n : slots[i].chord.pitches)
                if (dest[0] < 16)
                    dest[++dest[0]] = uint8_t(n);
        }
    }
    const SpinLock::ScopedLockType lock(mutex);
    published = next;
}
void BoundKeys::prepare(double sr) {
    held = {};
    refs = {};
    level = {};
    phase = {};
    for (int n = 0; n < 128; ++n) {
        sounding[n] = false;
        inc[n] = MathConstants<double>::twoPi * MidiMessage::getMidiNoteInHertz(n) / std::max(1., sr);
    }
}
void BoundKeys::release(int slot, int frame, MidiBuffer &midi) {
    if (!held[slot])
        return;
    held[slot] = false;
    auto &pad = current[slot];
    for (int i = 1; i <= pad[0]; ++i) {
        auto n = pad[i];
        if (--refs[n] == 0) {
            midi.addEvent(MidiMessage::noteOff(2, n), frame);
            sounding[n] = false;
            level[n] = 0;
        }
    }
}
void BoundKeys::releaseAll(int frame, MidiBuffer &midi) {
    for (int i = 0; i < slotLimit; ++i)
        release(i, frame, midi);
}
void BoundKeys::playEvent(const MidiMessage &m, int frame, MidiBuffer &midi) {
    if (m.isAllNotesOff() || m.isAllSoundOff()) {
        releaseAll(frame, midi);
        return;
    }
    if (!m.isNoteOnOrOff())
        return;
    int slot = slotFor(m.getNoteNumber());
    if (slot < 0)
        return;
    release(slot, frame, midi);
    if (!m.isNoteOn())
        return;
    const auto &pad = current[slot];
    held[slot] = true;
    for (int i = 1; i <= pad[0]; ++i) {
        int n = pad[i];
        if (refs[n]++ == 0) {
            level[n] = m.getFloatVelocity() * .08f;
            phase[n] = 0;
            sounding[n] = true;
            midi.addEvent(MidiMessage::noteOn(2, n, m.getVelocity()), frame);
        }
    }
}
void BoundKeys::synth(AudioBuffer<float> &b, int from, int to) {
    for (int n = 0; n < 128; ++n)
        if (level[n] > 0) {
            for (int i = from; i < to; ++i) {
                float s = float(std::sin(phase[n])) * level[n];
                phase[n] = std::fmod(phase[n] + inc[n], MathConstants<double>::twoPi);
                for (int c = 0; c < b.getNumChannels(); ++c)
                    b.addSample(c, i, s);
            }
        }
}
void BoundKeys::process(const MidiBuffer &input, AudioBuffer<float> &audio, MidiBuffer &output) {
    Mapping next;
    bool changed = false;
    {
        const SpinLock::ScopedTryLockType lock(mutex);
        if (lock.isLocked() && current != published) {
            next = published;
            changed = true;
        }
    }
    if (changed) {
        releaseAll(0, output);
        current = next;
    }
    int cursor = 0;
    for (auto meta : input) {
        int offset = jlimit(0, audio.getNumSamples(), meta.samplePosition);
        synth(audio, cursor, offset);
        playEvent(meta.getMessage(), offset, output);
        cursor = offset;
    }
    synth(audio, cursor, audio.getNumSamples());
}
} // namespace crest
