#include "Processor.h"
#include "Editor.h"

namespace crest {
Processor::Processor()
    : AudioProcessor(BusesProperties().withOutput("Preview", juce::AudioChannelSet::stereo(), true)) {}
std::pair<Book, uint64_t> Processor::snapshot() const {
    const juce::ScopedLock hold(mutex);
    return {book, revision()};
}
bool Processor::commit(const Book &changed, uint64_t expected) {
    {
        const juce::ScopedLock hold(mutex);
        if (revision() != expected)
            return false;
        book = changed;
        boundKeys.publish(book);
        ++generation;
    }
    updateHostDisplay(ChangeDetails().withNonParameterStateChanged(true));
    return true;
}
double Processor::tempo(const Book &source) const {
    const double host = hostBpm.load();
    return source.hostTempo && host >= 30 && host <= 300 ? host : source.bpm;
}
bool Processor::isBusesLayoutSupported(const BusesLayout &b) const {
    return b.getMainOutputChannelSet() == juce::AudioChannelSet::stereo() ||
           b.getMainOutputChannelSet() == juce::AudioChannelSet::mono();
}
void Processor::processBlock(juce::AudioBuffer<float> &audio, juce::MidiBuffer &midi) {
    double bpm = 0;
    if (auto *head = getPlayHead())
        if (auto pos = head->getPosition())
            if (auto value = pos->getBpm())
                bpm = *value;
    hostBpm.store(bpm);
    controller.clear();
    controller.swapWith(midi);
    audition.process(audio, midi);
    boundKeys.process(controller, audio, midi);
}
void Processor::getStateInformation(juce::MemoryBlock &dest) {
    const auto text = encode(snapshot().first);
    dest.replaceAll(text.toRawUTF8(), text.getNumBytesAsUTF8());
}
void Processor::setStateInformation(const void *data, int size) {
    if (!data || size <= 0 || size > 2000000)
        return;
    try {
        auto restored = decode(juce::String::fromUTF8(static_cast<const char *>(data), size));
        const juce::ScopedLock hold(mutex);
        book = std::move(restored);
        boundKeys.publish(book);
        ++generation;
        audition.stop();
    } catch (const std::exception &) { /* Invalid host state preserves the current sketchbook. */
    }
}
juce::AudioProcessorEditor *Processor::createEditor() {
    return new Editor(*this);
}
} // namespace crest
juce::AudioProcessor *JUCE_CALLTYPE createPluginFilter() {
    return new crest::Processor;
}
