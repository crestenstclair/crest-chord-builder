#pragma once
#include "LocalBank.h"
#include <map>

namespace crest::motion {
struct Tags {
    juce::StringArray moods, genres;
};

// The existing version-1 index identifies motions by their UUID MIDI leaf.
// Both optional sidecars are Crest-local; no Scaler settings are read or changed.
class Catalogue {
  public:
    explicit Catalogue(const LocalBank &bank) {
        if (bank.motions.empty())
            return;
        auto dir = bank.motions.front().midi.getParentDirectory().getParentDirectory();
        favouritesFile = dir.getChildFile("motion-favourites.txt");
        reloadFavourites();
        auto file = dir.getChildFile("motion-tags.json");
        if (!file.existsAsFile() || file.getSize() > 2 * 1024 * 1024)
            return;
        const auto root = juce::JSON::parse(file);
        auto *rows = root["rows"].getArray();
        if (int(root["version"]) != 1 || rows == nullptr || rows->size() > 10000)
            return;
        for (const auto &row : *rows)
            byId.emplace(row["id"].toString(), Tags{strings(row["moods"]), strings(row["genres"])});
    }
    const Tags &tags(const BankMotion &m) const {
        auto it = byId.find(id(m));
        return it == byId.end() ? empty : it->second;
    }
    bool hasTagIndex() const { return !byId.empty(); }
    bool isFavourite(const BankMotion &m) const { return favourites.contains(id(m)); }
    void reloadFavourites() {
        favourites.clear();
        if (favouritesFile.existsAsFile() && favouritesFile.getSize() < 1024 * 1024)
            favouritesFile.readLines(favourites);
    }
    bool toggleFavourite(const BankMotion &m) {
        reloadFavourites(); // other plug-in instances may have edited this file since opening
        auto next = favourites;
        if (isFavourite(m))
            next.removeString(id(m));
        else
            next.add(id(m));
        if (!favouritesFile.replaceWithText(next.joinIntoString("\n")))
            return false;
        favourites.swapWith(next);
        return true;
    }

  private:
    static juce::String id(const BankMotion &m) { return m.midi.getFileNameWithoutExtension(); }
    static juce::StringArray strings(const juce::var &v) {
        juce::StringArray result;
        if (auto *items = v.getArray(); items && items->size() <= 128)
            for (const auto &item : *items)
                if (item.isString() && item.toString().isNotEmpty())
                    result.addIfNotAlreadyThere(item.toString(), true);
        return result;
    }
    juce::File favouritesFile;
    juce::StringArray favourites;
    Tags empty;
    std::map<juce::String, Tags> byId;
};
} // namespace crest::motion
