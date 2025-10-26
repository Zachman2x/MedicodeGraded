import { labelCache } from "../state/cache.js";

// helper to fetch json data from url
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`openFDA fetch failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// check if product name is a clean, single ingredient (not "AND", "+", etc.)
function isCleanSingleName(returnedName, wantedName) {
  if (!returnedName) return false;

  const upReturned = returnedName.toUpperCase().trim();
  const upWanted = wantedName.toUpperCase().trim();

  if (upReturned !== upWanted) return false;

  const comboTokens = [" AND ", " WITH ", " / ", " + ", " & "];
  return !comboTokens.some((tok) => upReturned.includes(tok));
}

// normalize an FDA "label" into our consistent shape
function buildPayloadFromLabel(label, fallbackName) {
  const chunks = [];
  if (label.drug_interactions) chunks.push(...label.drug_interactions);
  if (label.warnings) chunks.push(...label.warnings);
  if (label.precautions) chunks.push(...label.precautions);
  if (label.contraindications) chunks.push(...label.contraindications);

  const lines = chunks.map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean);

  const brandName =
    (label.openfda &&
      (label.openfda.brand_name?.[0] ||
        label.openfda.generic_name?.[0])) ||
    fallbackName;

  const manu = label.openfda?.manufacturer_name?.[0] || "";
  const appNum = label.openfda?.application_number?.[0] || "";
  const ndc = label.openfda?.product_ndc?.[0] || "";

  const fdaLabelName = manu ? `${brandName} (${manu})` : brandName;
  const fdaApplication = appNum || ndc || "";

  const splId =
    label.spl_set_id ||
    label.set_id ||
    (label.openfda && label.openfda.spl_set_id?.[0]) ||
    "";

  const dailyMedLink = splId
    ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${splId}`
    : "";

  return {
    lines: lines.length
      ? lines
      : [`No interaction text extracted for ${fallbackName}.`],
    fdaLabelName,
    fdaApplication,
    dailyMedName: brandName,
    dailyMedLink,
    _rawHasSetId: !!splId,
    _rawHasNdc: !!ndc,
  };
}

// core function
export async function getLabelInteractionsByIngredient(ingredientName) {
  const key = ingredientName.toUpperCase();

  // 1. cache first
  if (labelCache.has(key)) {
    const cached = labelCache.get(key);
    return { ...cached, lines: [...cached.lines] };
  }

  const buildUrl = (field) => {
    const qIng = encodeURIComponent(`"${ingredientName}"`);
    return (
      `https://api.fda.gov/drug/label.json?search=` +
      `openfda.${field}:${qIng}+AND+drug_interactions:*&limit=5`
    );
  };

  // helper to fetch + rank results
  async function tryFetch(url) {
    const data = await fetchJson(url);
    const results = data.results || [];
    if (!results.length) return null;

    const payloads = results.map((label) =>
      buildPayloadFromLabel(label, ingredientName)
    );

    const cleanSingles = [];
    const others = [];
    for (const p of payloads) {
      if (isCleanSingleName(p.dailyMedName, ingredientName)) {
        cleanSingles.push(p);
      } else {
        others.push(p);
      }
    }

    let bestClean =
      cleanSingles.find((p) => p._rawHasSetId) ||
      cleanSingles.find((p) => p._rawHasNdc) ||
      cleanSingles[0];

    let chosen = bestClean || others[0] || payloads[0];

    if (!isCleanSingleName(chosen.dailyMedName, ingredientName)) {
      chosen = {
        ...chosen,
        dailyMedName: `DailyMed Source Unavailable for: ${ingredientName}`,
        dailyMedLink: "",
      };
    }

    delete chosen._rawHasSetId;
    delete chosen._rawHasNdc;
    return chosen;
  }

  let finalPayload = {
    lines: [`Unable to retrieve FDA interaction text for ${ingredientName}.`],
    fdaLabelName: ingredientName,
    fdaApplication: "",
    dailyMedName: `DailyMed Source Unavailable for: ${ingredientName}`,
    dailyMedLink: "",
  };

  try {
    // try generic first
    finalPayload = (await tryFetch(buildUrl("substance_name"))) || finalPayload;

    // if still no valid DailyMed link, try brand name fallback
    if (
      !finalPayload.dailyMedLink &&
      finalPayload.dailyMedName.startsWith("DailyMed Source Unavailable")
    ) {
      const brandResult = await tryFetch(buildUrl("brand_name"));
      if (brandResult && brandResult.dailyMedLink) {
        finalPayload = brandResult;
      }
    }
  } catch {
    // keep fallback
  }

  // 3. cache + return
  labelCache.set(key, {
    lines: [...finalPayload.lines],
    fdaLabelName: finalPayload.fdaLabelName,
    fdaApplication: finalPayload.fdaApplication,
    dailyMedName: finalPayload.dailyMedName,
    dailyMedLink: finalPayload.dailyMedLink,
  });

  return finalPayload;
}
