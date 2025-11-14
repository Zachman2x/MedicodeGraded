// creates map of ingredients from normalized name list
// groups drug names sharing ingredients
// skips inputs that don't have item.ingredients values
export function buildIngredientIndex(normalizedList) {
  const index = new Map();

  for (const item of normalizedList) {
    // identify bad inputs. make sure item.ingredients exists and is a non-empty array
    if (
      !item ||
      !Array.isArray(item.ingredients) ||
      item.ingredients.length === 0
    ) {
      // if there are no parsed ingredients, skip that input entirely
      continue;
    }

    for (const ingName of item.ingredients) {
      // guard against bad values like null/undefined/number
      if (typeof ingName !== "string" || ingName.trim() === "") continue;

      const key = ingName.toUpperCase();

      if (!index.has(key)) {
        index.set(key, {
          ingredient: ingName,
          key,
          sourceDrugs: new Set(),
        });
      }

      // item.query is the original user-entered string; used for display results table
      index.get(key).sourceDrugs.add(item.query || ingName);
    }
  }

  return index;
}
