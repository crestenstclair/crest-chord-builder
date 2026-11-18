#pragma once
#include "MotionCatalogue.h"

namespace crest::motion {
inline const juce::StringArray categories{"All", "Favourites", "Articulations", "Expressions", "Moods", "Genres"};
inline const juce::StringArray articulations{"Arpeggios", "Passages", "Strumming", "Chord Follow", "Bass Follow", "Divisi"};
inline const juce::StringArray expressions{"Performances", "Phrases", "Rhythms", "Bass", "Melody", "Sequences", "StrummedSequences"};

struct Filter {
    juce::String category{"Expressions"}, branch{"Performances"}, group{"All subgroups"};
    bool byTag() const { return category == "Moods" || category == "Genres"; }
    static juce::String subgroup(const BankMotion &m) { return m.group.isEmpty() ? m.family : m.group; }
    const juce::StringArray &facet(const Tags &t) const { return category == "Moods" ? t.moods : t.genres; }
    bool acceptsCategory(const BankMotion &m, const Catalogue &catalogue) const {
        if (category == "Favourites") return catalogue.isFavourite(m);
        if (category == "Expressions") return !articulations.contains(m.family);
        if (category == "Articulations") return articulations.contains(m.family);
        return true;
    }
    bool acceptsBranch(const BankMotion &m, const Catalogue &catalogue) const {
        if (!acceptsCategory(m, catalogue)) return false;
        if (byTag()) {
            const auto &values = facet(catalogue.tags(m));
            return branch == "No linked tag" ? values.isEmpty() : values.contains(branch, true);
        }
        return branch == "All families" || branch == m.family;
    }
    bool accepts(const BankMotion &m, const Catalogue &catalogue, const juce::String &search) const {
        if (!acceptsBranch(m, catalogue)) return false;
        if (group != (byTag() ? "All families" : "All subgroups") && group != (byTag() ? m.family : subgroup(m)))
            return false;
        if (search.isEmpty()) return true;
        const auto &tags = catalogue.tags(m);
        return (m.name + " " + m.family + " " + m.group + " " + tags.moods.joinIntoString(" ") + " "
                + tags.genres.joinIntoString(" ")).containsIgnoreCase(search);
    }
    juce::StringArray branches(const LocalBank &bank, const Catalogue &catalogue) const {
        if (category == "Articulations") return articulations;
        juce::StringArray list;
        if (byTag()) {
            if (!catalogue.hasTagIndex()) return {};
            bool unlinked = false;
            for (const auto &m : bank.motions) {
                auto &values = facet(catalogue.tags(m));
                list.addArray(values);
                unlinked |= values.isEmpty();
            }
            list.removeDuplicates(true);
            list.sortNatural();
            if (unlinked) list.add("No linked tag");
            return list;
        }
        for (const auto &m : bank.motions)
            if (acceptsCategory(m, catalogue)) list.addIfNotAlreadyThere(m.family);
        list.sortNatural();
        if (category == "Expressions") {
            juce::StringArray ordered;
            for (const auto &family : expressions)
                if (list.contains(family)) ordered.add(family);
            return ordered;
        }
        list.insert(0, "All families");
        return list;
    }
    juce::StringArray groups(const LocalBank &bank, const Catalogue &catalogue) const {
        juce::StringArray list;
        for (const auto &m : bank.motions)
            if (acceptsBranch(m, catalogue)) list.addIfNotAlreadyThere(byTag() ? m.family : subgroup(m));
        list.sortNatural();
        if (!list.isEmpty()) {
            auto all = byTag() ? "All families" : "All subgroups";
            if (byTag() || branch == "All families" || list.size() > 1) list.insert(0, all);
        }
        return list;
    }
};
} // namespace crest::motion
