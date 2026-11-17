#include "web_tests.h"
#include "PluginEditor.h"
#include <iostream>
#include <stdexcept>

struct ReferenceEditorProbe
{
    static ReferenceBrowser& browser(ChordReferenceEditor& editor) { return editor.browser; }
};

namespace
{
void require(bool condition, const char* message)
{
    if (!condition) throw std::runtime_error(message);
}

void waitUntil(const std::function<bool()>& complete, const juce::String& description)
{
    const auto deadline = juce::Time::getMillisecondCounterHiRes() + 20000.0;
    while (!complete())
    {
        if (juce::Time::getMillisecondCounterHiRes() >= deadline)
            throw std::runtime_error(("Timed out: " + description).toStdString());
        juce::MessageManager::getInstance()->runDispatchLoopUntil(25);
    }
}

juce::var evaluate(ReferenceBrowser& browser, const juce::String& script)
{
    struct Reply { bool complete = false; juce::var value; juce::String error; };
    const auto reply = std::make_shared<Reply>();
    browser.evaluateJavascript(script, [reply](auto result) {
        if (const auto* error = result.getError()) reply->error = error->message;
        if (const auto* value = result.getResult()) reply->value = *value;
        reply->complete = true;
    });
    waitUntil([reply] { return reply->complete; }, "JavaScript callback");
    if (reply->error.isNotEmpty()) throw std::runtime_error(reply->error.toStdString());
    return reply->value;
}

void waitForJavascript(ReferenceBrowser& browser, const juce::String& predicate)
{
    try
    {
        waitUntil([&] { return static_cast<bool>(evaluate(browser, predicate)); }, predicate);
    }
    catch (...)
    {
        std::cerr << "WebView document: " << evaluate(browser, "document.body?.innerText || document.documentElement.outerHTML").toString() << '\n';
        throw;
    }
}

class TestWindow final : public juce::DocumentWindow
{
public:
    explicit TestWindow(ChordReferenceProcessor& processor)
        : DocumentWindow("Crest reference integration test", juce::Colours::black, 0)
    {
        setContentOwned(processor.createEditor(), true);
        setTopLeftPosition(60, 60);
        setVisible(true);
    }

    ReferenceBrowser& browser()
    {
        return ReferenceEditorProbe::browser(*dynamic_cast<ChordReferenceEditor*>(getContentComponent()));
    }
};

juce::String quoted(const juce::String& value)
{
    return juce::JSON::toString(juce::var(value), true);
}

void waitForSheet(ReferenceBrowser& browser, const juce::String& title)
{
    waitForJavascript(browser, "document.querySelector('.reference-header h1')?.textContent === " + quoted(title)
        + " && document.querySelector('iframe')?.dataset.ready === 'true'");
    require(static_cast<bool>(evaluate(browser, "document.querySelector('iframe').srcdoc.includes('<svg')")), "sheet has no guitar diagrams");
}

void pasteProject(ReferenceBrowser& browser, const juce::String& source)
{
    evaluate(browser, "document.querySelector('[data-reference=configure]').click();"
        "document.querySelector('#reference-json').value = " + quoted(source)
        + ";document.querySelector('#reference-apply').click();true");
}

void testJSONConfiguration(ChordReferenceProcessor& processor, const juce::String& source)
{
    TestWindow window(processor);
    auto& browser = window.browser();
    waitForJavascript(browser, "!!document.querySelector('[data-reference=configure]')");
    pasteProject(browser, source);
    waitForSheet(browser, juce::JSON::parse(source)["title"].toString());
    waitUntil([&] { return processor.frontendSnapshot()["projectJSON"].toString().isNotEmpty(); }, "JSON saved in processor");
    require(static_cast<bool>(evaluate(browser, "document.querySelector('[data-value=intervals]').getAttribute('aria-pressed') === 'true'")), "intervals are not the default");
    const auto original = processor.frontendSnapshot()["projectJSON"].toString();
    pasteProject(browser, "{broken");
    require(static_cast<bool>(evaluate(browser, "document.querySelector('#reference-config-error').textContent.includes('previous project is unchanged')")), "invalid JSON error missing");
    require(processor.frontendSnapshot()["projectJSON"].toString() == original, "invalid JSON changed saved state");
    evaluate(browser, "document.querySelector('#reference-cancel').click();document.querySelector('[data-value=notes]').click();true");
    waitUntil([&] { return processor.frontendSnapshot()["ui"]["labels"].toString() == "notes"; }, "preference saved in processor");
}

void testEditorReopenAndHostRestore(ChordReferenceProcessor& processor)
{
    const auto savedProject = processor.frontendSnapshot()["projectJSON"].toString();
    TestWindow window(processor);
    auto& browser = window.browser();
    waitForSheet(browser, juce::JSON::parse(savedProject)["title"].toString());
    require(static_cast<bool>(evaluate(browser, "document.querySelector('[data-value=notes]').getAttribute('aria-pressed') === 'true'")), "editor reopen lost preference");
    auto replacement = juce::JSON::parse(savedProject);
    replacement.getDynamicObject()->setProperty("title", "Restored while editor open");
    auto payload = processor.frontendSnapshot();
    payload.getDynamicObject()->setProperty("projectJSON", juce::JSON::toString(replacement, true));
    ChordReferenceProcessor other;
    require(other.updateFromFrontend(juce::JSON::toString(payload, true)).wasOk(), "replacement project rejected");
    juce::MemoryBlock restored;
    other.getStateInformation(restored);
    evaluate(browser, "document.querySelector('[data-reference=configure]').click();true");
    processor.setStateInformation(restored.getData(), static_cast<int>(restored.getSize()));
    waitForSheet(browser, "Restored while editor open");
    require(!static_cast<bool>(evaluate(browser, "document.querySelector('#reference-config').open")), "host restore left stale JSON dialog open");
}

void testCustomSheet(const juce::String& source)
{
    auto project = juce::JSON::parse(source);
    project.getDynamicObject()->setProperty("version", 3);
    project.getDynamicObject()->setProperty("title", "Native custom sheet");
    project["guitars"][0].getDynamicObject()->setProperty("capo", 2);
    project["parts"][0]["chords"][0]["fingerings"].getDynamicObject()->setProperty(
        "42,47,52,57,61,66", juce::JSON::parse("[3,1,0,0,3,1]"));
    auto sheet = juce::JSON::parse(R"JSON({
        "format":"html", "layout":"replace", "source":"", "files":[
            {"name":"cue.json","mime":"application/json","encoding":"utf8","content":"{\"cue\":\"Hold through bar 4\"}"},
            {"name":"phrase.json","mime":"application/json","encoding":"utf8","content":"{\"format\":\"crest-tab\",\"version\":1,\"title\":\"Phrase\",\"tuning\":[40,45,50,55,59,64],\"tempo\":90,\"meter\":[4,4],\"bars\":1,\"events\":[{\"beat\":0,\"duration\":1,\"string\":1,\"fret\":7,\"midi\":71}]}"}
        ]})JSON");
    sheet.getDynamicObject()->setProperty("source", R"HTML(
        <scale-map labels="notes"></scale-map><chord-sheet></chord-sheet>
        <guitar-tab src="phrase.json"></guitar-tab>
        <script>addEventListener('DOMContentLoaded', () => parent.postMessage({
            type: 'native-test', cue: crest.readJSON('cue.json').cue,
            bridge: typeof window.__JUCE__, frets: document.querySelector('.fret-values').textContent,
            root: document.querySelector('.scale-map .fret.is-root span').textContent,
            tabHidden: getComputedStyle(document.querySelector('.tab-transport')).display === 'none',
            voicingsHidden: getComputedStyle(document.querySelector('.sheet-voicing-controls')).display === 'none'
        }, '*'));</script>)HTML");
    project["parts"][0].getDynamicObject()->setProperty("sheet", sheet);
    ChordReferenceProcessor processor;
    TestWindow window(processor);
    auto& browser = window.browser();
    waitForJavascript(browser, "!!document.querySelector('[data-reference=configure]')");
    evaluate(browser, "window.referenceSheetProbe = null;addEventListener('message', event => {"
        "if (event.source === document.querySelector('iframe')?.contentWindow && event.data?.type === 'native-test')"
        "window.referenceSheetProbe = event.data;});true");
    pasteProject(browser, juce::JSON::toString(project, true));
    waitForSheet(browser, "Native custom sheet");
    waitForJavascript(browser, "!!window.referenceSheetProbe");
    const auto probe = evaluate(browser, "window.referenceSheetProbe");
    require(probe["cue"].toString() == "Hold through bar 4", "custom attachment was not available");
    require(probe["bridge"].toString() == "undefined", "native bridge leaked into custom sheet");
    require(probe["frets"].toString() == "5 3 2 2 5 3", "capo fret numbers are not absolute");
    require(probe["root"].toString() == "1", "custom sheet ignored intervals preference");
    require(static_cast<bool>(probe["tabHidden"]) && static_cast<bool>(probe["voicingsHidden"]), "reference sheet exposed playback or voicing controls");
}
}

void testEmbeddedWebView(const juce::String& projectJSON)
{
    require(projectJSON.isNotEmpty(), "test project is missing");
    ChordReferenceProcessor processor;
    testJSONConfiguration(processor, projectJSON);
    testEditorReopenAndHostRestore(processor);
    juce::MemoryBlock saved;
    processor.getStateInformation(saved);
    ChordReferenceProcessor recreated;
    recreated.setStateInformation(saved.getData(), static_cast<int>(saved.getSize()));
    {
        TestWindow window(recreated);
        waitForSheet(window.browser(), "Restored while editor open");
        require(static_cast<bool>(evaluate(window.browser(), "document.querySelector('[data-value=notes]').getAttribute('aria-pressed') === 'true'")), "host recall lost preference");
    }
    testCustomSheet(projectJSON);
    std::cout << "PASS: actual WKWebView JSON UI, diagrams, invalid input, preferences, editor reopen, live host restore, new processor recall\n";
    std::cout << "PASS: WKWebView custom sheets, tab engraving, attachments, bridge isolation, absolute capo frets and default intervals\n";
}
