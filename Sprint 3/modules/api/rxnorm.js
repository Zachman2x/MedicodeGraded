import { normCache } from "../state/cache.js";

// helper to fetch json data from url
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`rxnorm fetch failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}


// approximation lookup from input name, get RXCUI
async function lookupRxcuiForName(rawName) {
  const q = encodeURIComponent(rawName);
  const approx = await fetchJson(
    `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${q}&maxEntries=1`
  );

  const candidates = approx?.approximateGroup?.candidate;
  if (!candidates || !candidates.length) {
    return null;
  }

  // grab best candidate RXCUI
  return candidates[0].rxcui || null;
}

// use RXCUI to find first Ingredient
async function resolveIngredientFromRxcui(rxcui) {
  const data = await fetchJson(
    `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/related.json?tty=IN`
  );

  const groups = data?.relatedGroup?.conceptGroup || [];
  for (const g of groups) {
    if (g.tty === "IN" && Array.isArray(g.conceptProperties)) {
      // jusing first ingredient found
      const first = g.conceptProperties[0];
      return {
        name: first.name || "",
        rxcui: first.rxcui || null,
        tty: first.tty || "IN",
      };
    }
  }
  return null;
}

// gets display properties for fallback when no Ingredients found
async function getDisplayForRxcui(rxcui) {
  const data = await fetchJson(
    `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`
  );

  const props = data?.properties || {};
  return {
    name: props.name || "",
    tty: props.tty || null,
    rxcui: props.rxcui || rxcui || null,
  };
}


//  normalizeToIngredients Object
//  {
//    query: "advil",                
//    display: "Advil 200 MG Tablet",
//    rxcui: "12345",                
//    ingredients: ["IBUPROFEN"],    
//    error?: "no_match"             
//  }

//  cache by rawName so repeated runs are instant
export async function normalizeToIngredients(rawName) {
  const key = rawName.trim().toUpperCase();
  if (normCache.has(key)) {
    return { ...normCache.get(key) };
  }

  if (!rawName.trim()) {
    const emptyResult = {
      query: rawName,
      display: rawName,
      rxcui: null,
      ingredients: [],
      error: "no_match",
    };
    normCache.set(key, emptyResult);
    return { ...emptyResult };
  }

  // resolve RXCUI using approximateTerm
  const baseRxcui = await lookupRxcuiForName(rawName);
  if (!baseRxcui) {
    const miss = {
      query: rawName,
      display: rawName,
      rxcui: null,
      ingredients: [],
      error: "no_match",
    };
    normCache.set(key, miss);
    return { ...miss };
  }

  // get Ingredient info
  const ingInfo = await resolveIngredientFromRxcui(baseRxcui);

  // display info
  const baseProps = await getDisplayForRxcui(baseRxcui);

  const result = {
    query: rawName,
    display: ingInfo?.name || baseProps.name || rawName,
    rxcui: ingInfo?.rxcui || baseProps.rxcui || null,
    ingredients: [
      // display ingredient names in uppercase 
      ingInfo?.name ? ingInfo.name.toUpperCase() : (baseProps.name || rawName).toUpperCase(),
    ],
  };

  normCache.set(key, result);
  return { ...result };
}
