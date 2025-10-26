import { labelCache } from "../state/cache.js";

// helper to fetch json data from url
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`openFDA fetch failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Big Fetch Function
// fetches and caches FDA Drug label data for ingredient
// extracts interaction text mentions as chunks
// gets manufacturer name, applicaiton number, product NDC
// builds daily Med link

//  Returns an object with:
//   - lines[]                : lines scanned where mentions are found
//   - fdaLabelName           : identifier/name from FDA data
//   - fdaApplication         : optional application/identifier info from FDA if available
//   - dailyMedName           : display name for the drug (brand or generic)
//   - dailyMedLink           : public DailyMed link
 

export async function getLabelInteractionsByIngredient(ingredientName) {
  const key = ingredientName.toUpperCase();

  // If its in the cache already, use it
  if (labelCache.has(key)) {
    const cached = labelCache.get(key);
    return {
      lines: [...cached.lines],
      fdaLabelName: cached.fdaLabelName,
      fdaApplication: cached.fdaApplication,
      dailyMedName: cached.dailyMedName,
      dailyMedLink: cached.dailyMedLink,
    };
  }

  const qIng = encodeURIComponent(`"${ingredientName}"`);
  const url =
    `https://api.fda.gov/drug/label.json?search=` +
    `openfda.substance_name:${qIng}+AND+drug_interactions:*&limit=1`;

  let out = {
    lines: [
      // fallback message for missing input value cases
      `No interaction data found in FDA label for ${ingredientName}.`,
    ],
    fdaLabelName: ingredientName,
    fdaApplication: "",
    dailyMedName: ingredientName,
    dailyMedLink: "",
  };

  try {
    const data = await fetchJson(url);

    if (data.results && data.results.length > 0) {
      const label = data.results[0];

      // 1. Extract text chunks that we actually parse for mentions
      const chunks = [];
      if (label.drug_interactions) chunks.push(...label.drug_interactions);
      if (label.warnings) chunks.push(...label.warnings);
      if (label.precautions) chunks.push(...label.precautions);
      if (label.contraindications) chunks.push(...label.contraindications);

      const lines = chunks
        .map((t) => t.replace(/\s+/g, " ").trim())
        .filter(Boolean);

      const brandName =
        (label.openfda &&
          (label.openfda.brand_name?.[0] ||
            label.openfda.generic_name?.[0])) ||
        ingredientName;

    // 2. Get info to display 
    // - Manufatururer Name
    // - Applicaiton number
    // - Product NDC
      const manu =
        label.openfda?.manufacturer_name?.[0] || "";
      const appNum =
        label.openfda?.application_number?.[0] || "";
      const ndc =
        label.openfda?.product_ndc?.[0] || "";

      const fdaLabelName = manu
        ? `${brandName} (${manu})`
        : brandName;

      const fdaApplication = appNum || ndc || "";

      // 3. Build DailyMed link 
      const splId =
        label.spl_set_id ||
        label.set_id ||
        (label.openfda && label.openfda.spl_set_id?.[0]) ||
        "";

      const dailyMedLink = splId
        ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${splId}`
        : "";

      out = {
        lines: lines.length ? lines : [`No interaction text extracted for ${ingredientName}.`],
        fdaLabelName,
        fdaApplication,
        dailyMedName: brandName,
        dailyMedLink,
      };
    }
  } catch (err) {
    out = {
      lines: [
        `Unable to retrieve FDA interaction text for ${ingredientName}.`,
      ],
      fdaLabelName: ingredientName,
      fdaApplication: "",
      dailyMedName: ingredientName,
      dailyMedLink: "",
    };
  }

  // 4. Save to cache
  labelCache.set(key, {
    lines: [...out.lines],
    fdaLabelName: out.fdaLabelName,
    fdaApplication: out.fdaApplication,
    dailyMedName: out.dailyMedName,
    dailyMedLink: out.dailyMedLink,
  });

  return out;
}
