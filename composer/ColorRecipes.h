#pragma once
#include "Harmony.h"
#include <optional>

namespace crest {
struct ColorRecipe {
    std::string family, name, bankName;
    // Nonzero for a horizontal strip of alternatives to a single scale degree.
    int fixedDegree = 0;
};
const std::vector<ColorRecipe> &colorRecipes();
// Columns are 1..7. Returns the generated recipe (empty for a bank-only set).
std::optional<harmony::Chord> recipeChord(harmony::Scale, int column, size_t recipe);
// Ordered from the six large, familiar alternatives to the six small, complex ones.
std::vector<harmony::Chord> rankedVariations(const harmony::Chord &source);
} // namespace crest
