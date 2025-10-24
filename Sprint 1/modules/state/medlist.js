const KEY = "medList.v1";

export function loadMedList() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveMedList(entries) {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

export function clearMedList() {
  localStorage.removeItem(KEY);
}

export function hasMedList() {
  return loadMedList().length > 0;
}


export function entriesFromNormalized(normalized) {
  const byId = new Map();
  for (const n of normalized) {
    const name = n.display || n.query;
    if (!name) continue;

    const id = n.rxcui ? String(n.rxcui) : `NAME:${name.toUpperCase()}`;
    if (!byId.has(id)) byId.set(id, { id, rxcui: n.rxcui || null, name });
  }
  return [...byId.values()];
}
