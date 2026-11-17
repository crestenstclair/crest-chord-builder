#include "PluginEditor.h"
#include "WebAssets.h"

bool ReferenceBrowser::pageAboutToLoad(const juce::String& url)
{
    const auto root = getResourceProviderRoot();
    return url == root || url == root + "reference.html" || url == "about:blank" || url == "about:srcdoc";
}

juce::WebBrowserComponent::Options ChordReferenceEditor::browserOptions()
{
    return juce::WebBrowserComponent::Options()
        .withNativeIntegrationEnabled()
        .withInitialisationData("crestReference", true)
        .withKeepPageLoadedWhenBrowserIsHidden()
        .withResourceProvider(referenceResource)
        .withNativeFunction("crestReferenceGetState", [this](const juce::Array<juce::var>&, auto complete) {
            complete(ownerProcessor.frontendSnapshot());
        })
        .withNativeFunction("crestReferenceSetState", [this](const juce::Array<juce::var>& args, auto complete) {
            const auto result = args.size() == 1 && args[0].isString()
                ? ownerProcessor.updateFromFrontend(args[0].toString()) : juce::Result::fail("Expected one state payload.");
            auto reply = juce::var(new juce::DynamicObject());
            reply.getDynamicObject()->setProperty("ok", result.wasOk());
            reply.getDynamicObject()->setProperty("error", result.getErrorMessage());
            if (result.failed()) reply.getDynamicObject()->setProperty("snapshot", ownerProcessor.frontendSnapshot());
            complete(reply);
        });
}

ChordReferenceEditor::ChordReferenceEditor(ChordReferenceProcessor& owner)
    : AudioProcessorEditor(owner), ownerProcessor(owner), browser(browserOptions())
{
    setResizable(true, true);
    setResizeLimits(700, 480, 2400, 1800);
    setSize(1160, 840);
    addAndMakeVisible(browser);
    deliveredGeneration = static_cast<juce::int64>(ownerProcessor.frontendSnapshot()["generation"]);
    browser.goToURL(juce::WebBrowserComponent::getResourceProviderRoot());
    startTimer(150);
}

void ChordReferenceEditor::paint(juce::Graphics& graphics)
{
    graphics.fillAll(juce::Colour(0xff101617));
}

void ChordReferenceEditor::resized() { browser.setBounds(getLocalBounds()); }

void ChordReferenceEditor::timerCallback()
{
    if (!browser.isShowing()) return;
    const auto state = ownerProcessor.frontendSnapshot();
    const auto generation = static_cast<juce::int64>(state["generation"]);
    if (generation == deliveredGeneration) return;
    browser.emitEventIfBrowserIsVisible("crestReferenceRestore", state);
    deliveredGeneration = generation;
}
