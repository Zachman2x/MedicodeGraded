import {
  collectDrugQueriesFromRows,
  populateDrugInputsFromList,
  installDeleteHandler,
  initExistingRows,
} from "./ui/drugInputs.js";

import {
  loadMedList,
  saveMedList,
  clearMedList,
  entriesFromNormalized,
} from "./state/medlist.js";

import {
  setStatus,
  setDisabled,
  renderMedList,
  renderDedupList,
  renderInteractionSummary,
} from "./ui/render.js";

import { normalizeToIngredients } from "./api/rxnorm.js";
import { getLabelInteractionsByIngredient } from "./api/openfda.js";
import { buildIngredientIndex } from "./core/dedupe.js";
import { buildUniquePairs } from "./core/pairs.js";
import { textMentions, needleSetFor } from "./core/match.js";

// DOM Items
const $status = document.getElementById("status");
const $btnSave = document.getElementById("btnSaveMedList");
const $btnLoad = document.getElementById("btnLoadMedList");
const $btnClear = document.getElementById("btnClearMedList");

const $medListContainer = document.getElementById("medListContainer");
const $analyzeBtn = document.getElementById("analyze");

// results sections
const $sectionDedup = document.getElementById("section-dedup");
const $dedupList = document.getElementById("dedupList");

const $sectionPairs = document.getElementById("section-pairs");
const $summaryBody = document.getElementById("summaryTableBody");


let latestNormalized = null;

installDeleteHandler();
initExistingRows();

$btnSave.addEventListener("click", onSaveMedList);
$btnLoad.addEventListener("click", onLoadMedList);
$btnClear.addEventListener("click", onClearMedList);
$analyzeBtn.addEventListener("click", onAnalyze);

refreshMedListUI();

// Big Main Function
// handler for Analyze Medicaiton button
// validates inputs
// normalizes drug names
// highlights unknown drugs
// dedupes ingredients
// fetches FDA data/Daily Med link
// parses FDA data and highlights mentions
// redners interaction table
// displays fetch timing metric
// updates ui state(save buttons etc.)
async function onAnalyze() {
  console.log("[Analyze] clicked");

  // t0 returns timestamp
  const t0 = performance.now();

  // 1. tkae in user inputs
  const userInputs = collectDrugQueriesFromRows();
  console.log("[Analyze] inputs:", userInputs);

  if (userInputs.length < 2) {
    setStatus($status, "Enter at least two medications.");
    latestNormalized = null;
    setDisabled($btnSave, true);
    return;
  }

  // lock Analyze button while fetching
  setDisabled($analyzeBtn, true);
  setStatus($status, "Normalizing via RxNorm…");

  try {
    // 2. Normalize each user-entered string

    const normalizedArray = await Promise.all(
      userInputs.map((q) => normalizeToIngredients(q))
    );
    console.log("[Analyze] normalizedArray (raw):", normalizedArray);

    // Split valid vs invalid
    const validNormalized = [];
    const invalidNormalized = [];

    for (const n of normalizedArray) {
      const isValid =
        !n.error &&
        Array.isArray(n.ingredients) &&
        n.ingredients.length > 0;

      if (isValid) {
        validNormalized.push(n);
      } else {
        invalidNormalized.push(n);
      }
    }

    console.log("[Analyze] validNormalized:", validNormalized);
    console.log("[Analyze] invalidNormalized:", invalidNormalized);

    // if we have invalids, collect names for messaging
    const badNames = invalidNormalized
      .map((n) => n.query || n.display || "")
      .filter(Boolean);

    // highlight inputs that failed normalization
    const inputs = document.querySelectorAll(".drugClass");
    inputs.forEach((input) => {
      const val = input.value.trim().toLowerCase();
      // remove any old highlights first
      input.classList.remove("not-found-input");
      // if this value matches a bad name, highlight it orange
      if (badNames.some((b) => b.toLowerCase() === val)) {
        input.classList.add("not-found-input");
      }
    });



    // 3. if <2 valid meds remain
    if (validNormalized.length < 2) {
      const t1 = performance.now();
      const elapsedSec = ((t1 - t0) / 1000).toFixed(2);

      if (badNames.length > 0) {
        setStatus(
          $status,
          `I couldn't match "${badNames.join(
            ", "
          )}" to a known medication. Please check spelling and try again. (${elapsedSec}s)`
        );
      } else {
        setStatus(
          $status,
          `I couldn't find at least two recognizable medications to compare. (${elapsedSec}s)`
        );
      }

      // hide results sections
      $sectionDedup.style.display = "none";
      $sectionPairs.style.display = "none";

      latestNormalized = null;
      setDisabled($btnSave, true);
      return;
    }

    // if >=2 valid meds, save for "Save Med List".
    latestNormalized = validNormalized;
    setDisabled($btnSave, false);

    // 4. DEDUPE ingredients
    setStatus($status, "Deduplicating ingredients…");

    const ingIndex = buildIngredientIndex(validNormalized);
    console.log("[Analyze] ingIndex:", ingIndex);

    if (ingIndex.size === 0) {
      const t1 = performance.now();
      const elapsedSec = ((t1 - t0) / 1000).toFixed(2);

      setStatus(
        $status,
        `No valid ingredients were identified. (${elapsedSec}s)`
      );

      $sectionDedup.style.display = "none";
      $sectionPairs.style.display = "none";
      setDisabled($btnSave, true);
      return;
    }

    // render dedup
    const dedupArray = [...ingIndex.values()].map((node) => ({
      name: node.ingredient,
      rxcui: null,
    }));
    renderDedupList($dedupList, dedupArray);
    $sectionDedup.style.display = "";

    // 5. build unique ingredient pairs
    setStatus($status, "Generating comparison pairs…");

    // buildUniquePairs takes ingIndex (or its values)
    // and return an array of [A,B] pairs like:
    const pairs = buildUniquePairs(ingIndex);
    console.log("[Analyze] pairs:", pairs);

    if (!pairs.length) {
      const t1 = performance.now();
      const elapsedSec = ((t1 - t0) / 1000).toFixed(2);

      setStatus(
        $status,
        `Only one unique ingredient after dedupe — no interactions to compare. (${elapsedSec}s)`
      );

      $sectionPairs.style.display = "none";
      return;
    }

    // 6. fetch FDA / DailyMed label data for each unique ingredient
    const uniqueIngNames = [...ingIndex.values()].map((n) => n.ingredient);

    setStatus(
      $status,
      `Fetching FDA interaction text for ${ingIndex.size} ingredient(s)…`
    );

    // labelMap will be: nameUpper -> payload from getLabelInteractionsByIngredient()
    const labelMap = new Map();

    // limitedMap should runs N tasks with concurrency cap 
    await limitedMap(uniqueIngNames, 5, async (ingName) => {
      const payload = await getLabelInteractionsByIngredient(ingName);
      labelMap.set(ingName.toUpperCase(), payload);
    });

    console.log("[Analyze] labelMap:", labelMap);

    // 7. build summary objects (one per ingredient)
    setStatus($status, "Building interaction summary…");

    // initSummaryObjects creates an object keyed by ingredient name:
    // {
    //   "IBUPROFEN": {
    //      ingredientName,
    //      mentions: [],
    //      nonMentions: [],
    //      fdaLabelName,
    //      fdaApplication,
    //      dailyMedName,
    //      dailyMedLink,
    //   },
    //   ...
    // }
    const summaries = initSummaryObjects(uniqueIngNames, labelMap);

    // for each pair (A,B), check label text of A for B, and B for A...
    for (const [A, B] of pairs) {
      const aName = A.ingredient;
      const bName = B.ingredient;

      const aPayload =
        labelMap.get(aName.toUpperCase()) || {
          lines: [],
          fdaJsonLink: "",
        };
      const bPayload =
        labelMap.get(bName.toUpperCase()) || {
          lines: [],
          fdaJsonLink: "",
        };

      // textMentions(linesArray, needleSet) return hits: [{ index, matchText }, ...]
      const aHits = textMentions(aPayload.lines, needleSetFor(B));
      const bHits = textMentions(bPayload.lines, needleSetFor(A));

      // buildSnippets(fullText, hits) returns:
      // [ { name: "OTHER_DRUG", snippet: "full sentence around match" }, ... ]
      const aFullText = aPayload.lines.join(" ");
      const bFullText = bPayload.lines.join(" ");

      if (aHits.length) {
        const snippetsForA = buildSnippets(aFullText, aHits);
        summaries[aName].mentions.push(...snippetsForA);
      } else {
        summaries[aName].nonMentions.push({ name: bName });
      }

      if (bHits.length) {
        const snippetsForB = buildSnippets(bFullText, bHits);
        summaries[bName].mentions.push(...snippetsForB);
      } else {
        summaries[bName].nonMentions.push({ name: aName });
      }
    }

    // finalizeSummaries() dedupes mentions/nonMentions per ingredient
    const summaryRows = finalizeSummaries(summaries);
    console.log("[Analyze] summaryRows:", summaryRows);


    // 8. render table UI
    renderInteractionSummary($summaryBody, summaryRows);
    $sectionPairs.style.display = "";


    // 9. display status message including timing and any bad inputs w/ error message
    const t1 = performance.now();
    const elapsedSec = ((t1 - t0) / 1000).toFixed(2);

    if (badNames.length > 0) {
      const lineBreaks = badNames
        .map((n) => `<span class="status-warning">Couldn't identify: ${n} — please check spelling or try the generic name.`)
        .join("<br>");  

      setStatus(
        $status,
        `Analysis complete in ${elapsedSec}s.<br>${lineBreaks}`
      );
    } else {
      setStatus($status, `Analysis complete in ${elapsedSec}s.`);
    }


    console.log(
      `[Analyze] UI updated. Save enabled. (${elapsedSec}s)`
    );
  } catch (err) {
    console.error("[Analyze] Error:", err);

    const t1 = performance.now();
    const elapsedSec = ((t1 - t0) / 1000).toFixed(2);

    setStatus(
      $status,
      `Something went wrong analyzing these medications. (${elapsedSec}s)`
    );
  } finally {

    setDisabled($analyzeBtn, false);
  }
}



// builds blank summary object for each ingredient
function initSummaryObjects(uniqueIngNames, labelMap) {
  const obj = {};

  for (const ingName of uniqueIngNames) {
    const payload =
      labelMap.get(ingName.toUpperCase()) || {
        lines: [],
        fdaLabelName: ingName,
        fdaApplication: "",
        dailyMedName: ingName,
        dailyMedLink: "",
      };

    obj[ingName] = {
      ingredientName: ingName,
      rxcui: null,
      mentions: [],
      nonMentions: [],

      // FDA side (what we actually parsed)
      fdaLabelName: payload.fdaLabelName || ingName,
      fdaApplication: payload.fdaApplication || "",

      // DailyMed side (public link)
      dailyMedName: payload.dailyMedName || ingName,
      dailyMedLink: payload.dailyMedLink || "",
    };
  }
  return obj;
}


// scours data for mentioned drug names with full sentence boundaries
// trims ttext with elipses
function buildSnippets(fullText, hitNames) {
  const results = [];
  if (!fullText) return results;

  const lowerText = fullText.toLowerCase();

  for (const hitName of hitNames) {
    const needle = hitName.toLowerCase();
    const idx = lowerText.indexOf(needle);

    if (idx === -1) {
      results.push({ name: hitName, snippet: "" });
      continue;
    }

    // 1. find rough sentence boundaries around the match
    const pad = 150; 
    const roughStart = Math.max(0, idx - pad);
    const roughEnd = Math.min(fullText.length, idx + needle.length + pad);
    let roughChunk = fullText.slice(roughStart, roughEnd);

    // 2. expand roughChunk to full sentences.
    const localIdx = idx - roughStart;

    // find sentence start: walk left from localIdx until we hit (., ?, !) or string start
    let startBoundary = localIdx;
    while (startBoundary > 0) {
      const ch = roughChunk[startBoundary - 1];
      if (ch === "." || ch === "?" || ch === "!") {
        break;
      }
      startBoundary--;
    }

    // find sentence end: walk right from localIdx until we hit (., ?, !) or string end
    let endBoundary = localIdx;
    while (endBoundary < roughChunk.length) {
      const ch = roughChunk[endBoundary];
      if (ch === "." || ch === "?" || ch === "!") {
        endBoundary++;
        break;
      }
      endBoundary++;
    }

    let cleanChunk = roughChunk.slice(startBoundary, endBoundary);

    // 3. clean up whitespace and awkward cut-offs
    cleanChunk = cleanChunk.replace(/\s+/g, " ").trim();

    // 4. add ellipses if needed
    const addLeadEllipsis = startBoundary > 0 || roughStart > 0;
    const addTrailEllipsis =
      endBoundary < roughChunk.length || roughEnd < fullText.length;

    if (addLeadEllipsis) {
      cleanChunk = "…" + cleanChunk;
    }
    if (addTrailEllipsis && !cleanChunk.endsWith("…")) {
      cleanChunk = cleanChunk + "…";
    }

    results.push({
      name: hitName,
      snippet: cleanChunk,
    });
  }

  return results;
}


// remove dupe ingredients ingredient
function finalizeSummaries(summaries) {
  const rows = [];

  for (const ingName of Object.keys(summaries)) {
    const row = summaries[ingName];

    // dedupe mentions by name
    const seenMentions = new Map();
    for (const m of row.mentions) {
      if (!seenMentions.has(m.name)) {
        seenMentions.set(m.name, m.snippet || "");
      }
    }
    row.mentions = [...seenMentions.entries()].map(([name, snippet]) => ({
      name,
      snippet,
    }));

    // dedupe nonMentions by name
    const seenNon = new Set();
    const nonUnique = [];
    for (const nm of row.nonMentions) {
      if (!seenNon.has(nm.name)) {
        seenNon.add(nm.name);
        nonUnique.push({ name: nm.name });
      }
    }
    row.nonMentions = nonUnique;

    rows.push(row);
  }

  return rows;
}


// concurrency limiter to prevent error from OpenFDA API pings
async function limitedMap(items, concurrency, worker) {
  const q = items.slice();
  const workers = Array.from({ length: Math.min(concurrency, q.length) }, async function run() {
    while (q.length) {
      const item = q.shift();
      await worker(item);
    }
  });
  await Promise.all(workers);
}



// handlers for save, load, refresh, and clear buttons
function onSaveMedList() {
  if (!latestNormalized || !latestNormalized.length) {
    setStatus($status, "Nothing to save yet.");
    return;
  }

  const entries = entriesFromNormalized(latestNormalized);
  saveMedList(entries);
  refreshMedListUI();
  setStatus($status, "Saved current list.");
}


function onLoadMedList() {
  const entries = loadMedList();
  if (!entries.length) {
    setStatus($status, "No saved list found.");
    return;
  }

  populateDrugInputsFromList(entries);
  setStatus($status, "Loaded saved list.");
}

function onClearMedList() {
  clearMedList();
  refreshMedListUI();
  setStatus($status, "Deleted saved list.");
}


function refreshMedListUI() {
  const entries = loadMedList();
  renderMedList($medListContainer, entries);
  setDisabled($btnLoad, entries.length === 0);

  const canSave = !!(latestNormalized && latestNormalized.length);
  setDisabled($btnSave, !canSave);
}
