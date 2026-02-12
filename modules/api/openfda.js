// helper to extract relevant info from the openFDA JSON
function parseOpenFdaResponse(json, ingName, requestUrl) {

  if (!json || !Array.isArray(json.results) || json.results.length === 0) {
    return null;
  }
  // look at first result of the JSON object
  const first = json.results[0];

  let interactionLines = [];

  if (Array.isArray(first.drug_interactions)) {
    interactionLines = first.drug_interactions.map((s) =>
      typeof s === "string" ? s.trim() : ""
    );
  } else if (typeof first.drug_interactions === "string") {
    interactionLines = [first.drug_interactions.trim()];
  }

  // creates new array that only contains interaction lines that are not empty
  // filters out empty interaction lines
  interactionLines = interactionLines.filter((s) => s.length > 0);
  if (interactionLines.length === 0) {
    return null;
  }

  const fdaLabelName = ingName;

  const fdaApplication =
    (Array.isArray(first.application_number) &&
      first.application_number[0]) ||
    first.application_number ||
    "";

  const dailyMedName =
    first.openfda?.generic_name?.[0] ||
    first.openfda?.brand_name?.[0] ||
    ingName;

  const dailyMedLink = ""; 

  return {
    lines: interactionLines,
    fdaLabelName,
    fdaApplication,
    dailyMedName,
    dailyMedLink,
    fdaJsonLink : requestUrl,
  };
}

export async function getLabelInteractionsByIngredient(ingName) {
  try {
    // Build req URL
    const url = `https://api.fda.gov/drug/label.json?search=openfda.substance_name:"${encodeURIComponent(
      ingName
    )}"+AND+drug_interactions:*&limit=5`;

    const res = await fetch(url);

    // if error treat as no data
    if (!res.ok) {
      console.warn(
        "[openfda] no label / non-OK status for",
        ingName,
        res.status
      );
      return null;
    }

    const json = await res.json();

    const parsed = parseOpenFdaResponse(json, ingName, url);

    // if parse couldn't find interaction text, treat as no data
    if (!parsed) {
      console.warn(
        "[openfda] no meaningful interaction text for",
        ingName
      );
      return null;
    }

    return parsed;
  } catch (err) {
    console.error("[openfda] error while fetching label for", ingName, err);
    return null;
  }
}
