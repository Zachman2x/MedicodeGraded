// takes deduped ingredients map 
// creates combos of each pair
// returns array of pairs of combos
export function buildUniquePairs(ingredientIndex) {
  const arr = [...ingredientIndex.values()];
  const pairs = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      pairs.push([arr[i], arr[j]]);
    }
  }
  return pairs;
}
