#include "Audition.h"

namespace crest {
uint32_t Audition::post(Sequence clip) {
    const juce::SpinLock::ScopedLockType lock(mailbox);
    clip.id = ++serial;
    std::swap(queued, clip);
    pending = true;
    return serial;
}
uint32_t Audition::submit(const composer::PerformanceRender &clip) {
    const double secondsPerTick = 60.0 / (clip.bpm * composer::performancePPQ);
    Sequence sequence;
    for (int tick : clip.slotStarts) sequence.boundaries.push_back(tick * secondsPerTick);
    sequence.boundaries.push_back(clip.totalTicks * secondsPerTick);
    auto &events = sequence.notes;
    events.reserve(2 * clip.notes.size());
    for (const auto &note : clip.notes) {
        events.push_back({secondsPerTick * note.startTick, note.pitch, note.velocity});
        events.push_back({secondsPerTick * note.endTick, note.pitch, 0});
    }
    std::sort(events.begin(), events.end(), [](const auto &a, const auto &b) {
        return std::tie(a.seconds, a.velocity) < std::tie(b.seconds, b.velocity);
    });
    return post(std::move(sequence));
}
void Audition::stop() {
    post({});
    published.store(Cursor{}, std::memory_order_relaxed); // also clear when the host suspends DSP
}
void Audition::prepare(double sampleRate) {
    rate = std::max(1., sampleRate);
    voices = {};
    for (auto &l : lit)
        l = false;
    for (int i = 0; i < 128; ++i)
        voices[i].increment = juce::MathConstants<double>::twoPi * juce::MidiMessage::getMidiNoteInHertz(i) / rate;
    smoothing = float(1.0 - std::exp(-1.0 / (rate * 0.005)));
    playing = {};
    published.store(Cursor{}, std::memory_order_relaxed);
    next = nextBoundary = 0;
    elapsed = 0;
    stop();
}
void Audition::silence(juce::MidiBuffer &midi) {
    for (int i = 0; i < 128; ++i) {
        if (voices[i].gate)
            midi.addEvent(juce::MidiMessage::noteOff(1, i), 0);
        voices[i].gate = false;
        lit[i] = false;
        voices[i].target = 0;
    }
}
void Audition::trigger(const Event &e, int offset, juce::MidiBuffer &midi) {
    auto &voice = voices[e.pitch];
    voice.gate = e.velocity != 0;
    lit[e.pitch] = voice.gate;
    voice.target = float(e.velocity) / 127.0f * 0.09f;
    midi.addEvent(voice.gate ? juce::MidiMessage::noteOn(1, e.pitch, static_cast<juce::uint8>(e.velocity))
                             : juce::MidiMessage::noteOff(1, e.pitch),
                  offset);
}
void Audition::synthesize(juce::AudioBuffer<float> &audio, int from, int to) {
    if (audio.getNumChannels() == 0 || to <= from)
        return;
    auto *output = audio.getWritePointer(0);
    for (auto &voice : voices) {
        if (!voice.gate && voice.level < 0.00001f)
            continue;
        for (int sample = from; sample < to; ++sample) {
            voice.level += smoothing * (voice.target - voice.level);
            output[sample] += float(std::sin(voice.phase)) * voice.level;
            voice.phase = std::fmod(voice.phase + voice.increment, juce::MathConstants<double>::twoPi);
        }
    }
}
void Audition::process(juce::AudioBuffer<float> &audio, juce::MidiBuffer &midi) {
    juce::ScopedNoDenormals noDenormals;
    audio.clear();
    midi.clear();
    if (audio.getNumSamples() == 0)
        return;
    bool replaced = false;
    {
        const juce::SpinLock::ScopedTryLockType lock(mailbox);
        if (lock.isLocked() && pending) {
            std::swap(playing, queued);
            pending = false;
            replaced = true;
        }
    }
    if (replaced) {
        silence(midi);
        elapsed = 0;
        next = nextBoundary = 0;
        published.store(Cursor{}, std::memory_order_relaxed);
    }
    int cursor = 0;
    while (next < playing.notes.size()) {
        const auto offset = std::llround(playing.notes[next].seconds * rate) - elapsed;
        if (offset >= audio.getNumSamples())
            break;
        int sample = int(std::max<int64_t>(0, offset));
        synthesize(audio, cursor, sample);
        trigger(playing.notes[next++], sample, midi);
        cursor = sample;
    }
    synthesize(audio, cursor, audio.getNumSamples());
    for (int channel = 1; channel < audio.getNumChannels(); ++channel)
        audio.copyFrom(channel, 0, audio, 0, 0, audio.getNumSamples());
    elapsed += audio.getNumSamples();
    while (nextBoundary < playing.boundaries.size() && std::llround(playing.boundaries[nextBoundary] * rate) < elapsed) {
        const int index = int(nextBoundary++);
        published.store(nextBoundary == playing.boundaries.size() ? Cursor{} : Cursor{playing.id, index},
                        std::memory_order_relaxed);
    }
}
} // namespace crest
