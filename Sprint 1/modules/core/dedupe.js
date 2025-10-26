// creates map of ingredients from normalized name list
// groups drug names sharing ingredients
export function buildIngredientIndex(normalizedList) {
  const index = new Map(); 

  for (const item of normalizedList) {
    const ins = item.ingredients.length ? item.ingredients : [item.display || item.query];

    for (const inName of ins) {
      const key = inName.toUpperCase();
      if (!index.has(key)) {
        index.set(key, { ingredient: inName, key, sourceDrugs: new Set() });
      }
      index.get(key).sourceDrugs.add(item.query);
    }
  }
  return index;
}
