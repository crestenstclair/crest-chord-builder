#pragma once
#include "MotionColumn.h"
#include "MotionFilter.h"

namespace crest {
class BankBrowser final : public juce::Component, private juce::ListBoxModel {
  public:
    explicit BankBrowser(const LocalBank &);
    ~BankBrowser() override;
    std::function<void()> onClose;
    std::function<void()> onBlockChords;
    std::function<void(const BankMotion &, bool previewOnly)> onMotion;
    std::function<void(const BankSet &, bool previewOnly)> onProgression;
    void showMotions(const juce::String &destination = {}, const juce::String &currentMotion = {});
    void showProgressions();
    void resized() override;
    void paint(juce::Graphics &) override;
    bool keyPressed(const juce::KeyPress &) override;

  private:
    class Row;
    void searchChanged();
    void rebuildBranches();
    void rebuildGroups();
    void rebuildPatterns();
    void rebuildItems();
    void updateHeadings();
    juce::String emptyMessage() const;
    void toggleHeart(int row);
    void use(int row, bool previewOnly);
    int getNumRows() override { return int(matches.size()); }
    juce::String getNameForRow(int) override;
    void paintListBoxItem(int, juce::Graphics &, int, int, bool) override {}
    juce::Component *refreshComponentForRow(int, bool, juce::Component *) override;
    void returnKeyPressed(int row) override { use(row, false); }

    const LocalBank &bank;
    motion::Catalogue catalogue;
    bool progressions = false;
    motion::Filter filter;
    juce::String pattern, targetName;
    std::vector<int> matches;
    motion::Column categories{"bank.categories"}, branches{"bank.families"}, groups{"bank.groups"};
    juce::ListBox results;
    juce::TextEditor query;
    juce::Label heading, count, hint, empty;
    std::array<juce::Label, 4> headers;
    juce::TextButton close{"Close"}, apply{"Use in sketch"}, preview{"Audition"};
    juce::TextButton block{"Block chords"};
};
} // namespace crest
