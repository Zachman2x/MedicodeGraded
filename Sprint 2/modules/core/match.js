// scans FDA label text for ingredient names (needles), returns them
export function textMentions(hayLines, needles) {
  const hay = hayLines.join(" ").toLowerCase();
  const found = [];
  for (const n of needles) {
    const nlow = n.toLowerCase();
    if (nlow.length >= 3 && hay.includes(nlow)) found.push(n);
  }
  return found;
}

// creates set containing single ingredient name to use as search target
export function needleSetFor(node) {
  return new Set([node.ingredient]);
}


