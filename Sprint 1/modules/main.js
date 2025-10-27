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

    // Split inputs into valid and invalid arrays
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

    // if we have bad inputs, collect names
    const badNames = invalidNormalized
      .map((n) => n.query || n.display || "")
      .filter(Boolean);

      const ingToUserInputs = new Map();

      for (const norm of validNormalized) {
        const userText = norm.query || norm.display || "";
        if (!userText) continue;
      
        if (Array.isArray(norm.ingredients)) {
          for (const ing of norm.ingredients) {
            if (!ing || typeof ing !== "string") continue;
            const key = ing.toUpperCase();
            if (!ingToUserInputs.has(key)) {
              ingToUserInputs.set(key, new Set());
            }
            ingToUserInputs.get(key).add(userText);
          }
        }
      }

      console.log("[Analyze] ingToUserInputs:", ingToUserInputs);




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

      // hide results sections by default
      $sectionDedup.style.display = "none";
      $sectionPairs.style.display = "none";
      $dedupList.innerHTML = "";
      $summaryBody.innerHTML = "";

      latestNormalized = null;
      setDisabled($btnSave, true);
      return;
    }

    // if >=2 valid meds, enable save for "Save Med List" button.
    latestNormalized = validNormalized;
    setDisabled($btnSave, false);

    // 4. DEDUPE ingredients (same as you already have)
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

    // 5. fetch FDA / DailyMed label data for each unique ingredient
    setStatus(
      $status,
      `Fetching FDA interaction text for ${ingIndex.size} ingredient(s)…`
    );

    // stores FDA label data
    const labelMap = new Map();    
    // array from FDA queries we want to keep (queries that didn't return FDA label data)
    const keptNodes = [];                 

    // iterate each ingredient node from ingIndex
    await limitedMap([...ingIndex.values()], 5, async (node) => {
      const ingName = node.ingredient;
      const payload = await getLabelInteractionsByIngredient(ingName);
    
      if (payload) {
        // Good: FDA data identifies ingredients
        labelMap.set(ingName.toUpperCase(), payload);
        keptNodes.push(node); 
      } else {
        // Bad: FDA 404/no data, skip this ingredient entirely
        console.log("[Analyze] Skipping (no FDA data):", ingName);
      }
    });

    console.log("[Analyze] keptNodes:", keptNodes);
    console.log("[Analyze] labelMap:", labelMap);


    // determine which ingredient nodes got *rejected* by FDA (return whatever is not in keptNodes)
    const rejectedNodes = [...ingIndex.values()].filter(
      (node) => !keptNodes.find(kept => kept.ingredient === node.ingredient)
    );

    // set rejected ingredients back to user inputs
    const fdaRejectedUserInputsSet = new Set();

    for (const node of rejectedNodes) {
      const key = node.ingredient.toUpperCase();
      const originals = ingToUserInputs.get(key);
    
      if (originals && originals.size > 0) {
        // add every user-entered string that mapped to this ingredient
        for (const src of originals) {
          fdaRejectedUserInputsSet.add(src);
        }
      } else {
        fdaRejectedUserInputsSet.add(node.ingredient);
      }
    }

    const fdaRejectedUserInputs = [...fdaRejectedUserInputsSet];
    console.log("[Analyze] fdaRejectedUserInputs:", fdaRejectedUserInputs);

    const lowerBadNames = badNames.map(n => n.toLowerCase());
    const lowerFdaRejects = fdaRejectedUserInputs.map(n => n.toLowerCase());

    const inputs = document.querySelectorAll(".drugClass");
    inputs.forEach((input) => {
      const val = input.value.trim().toLowerCase();
    
      // clear old highlight first
      input.classList.remove("not-found-input");
    
      const isBadRxNorm = lowerBadNames.includes(val);
      const isFdaRejected = lowerFdaRejects.includes(val);
    
      if (isBadRxNorm || isFdaRejected) {
        input.classList.add("not-found-input");
      }
    });


    function buildSkipMessages() {
      const msgs = [];
      
      // RxNorm failures (never normalized at all)
      for (const n of badNames) {
        msgs.push(
          `<span class="status-warning">${n} — not recognized as a medication. Check spelling or try the generic name.</span>`
        );
      }
    
      // FDA rejects (normalized, but FDA had no interaction data)
      for (const n of fdaRejectedUserInputs) {
        // Avoid showing duplicates if it's already in badNames
        if (!badNames.includes(n)) {
          msgs.push(
            `<span class="status-warning">${n} — not recognized as a medication. Check spelling or try the generic name.</span>`
          );
        }
      }
    
      return msgs.join("<br>");
    }


    // If fewer than 2 ingredients survived FDA check, don't display
    if (keptNodes.length < 2) {
      const t1 = performance.now();
      const elapsedSec = ((t1 - t0) / 1000).toFixed(2);
    
      setStatus(
        $status,
        `Less than two FDA-backed medications to compare. (${elapsedSec}s)`
      );
    
      $sectionDedup.style.display = "none";
      $sectionPairs.style.display = "none";
      $dedupList.innerHTML = "";
      $summaryBody.innerHTML = "";
    
      latestNormalized = null;
      setDisabled($btnSave, true);
      return;
    }

    // 6. Render Deduped Ingredients UI using ONLY keptNodes
    const dedupArray = keptNodes.map((node) => ({
      name: node.ingredient,
      rxcui: null,
    }));
    renderDedupList($dedupList, dedupArray);
    $sectionDedup.style.display = "";

    // 7. Build unique pairs from ONLY keptNodes
    setStatus($status, "Generating comparison pairs…");

    // buildUniquePairs currently takes a Map (ingIndex).
    // We have keptNodes[], so let's rebuild a mini Map that mirrors ingIndex:
    const filteredIngIndex = new Map();
    for (const node of keptNodes) {
      filteredIngIndex.set(node.key, node);
    }

    const pairs = buildUniquePairs(filteredIngIndex);
    console.log("[Analyze] pairs (FDA-backed only):", pairs);

    if (!pairs.length) {
      const t1 = performance.now();
      const elapsedSec = ((t1 - t0) / 1000).toFixed(2);
    
      setStatus(
        $status,
        `Only one unique FDA-backed ingredient — no interactions to compare. (${elapsedSec}s)`
      );
    
      $sectionPairs.style.display = "none";
      return;
    }

    // 8. Build summaries only for FDA-backed ingredients
    setStatus($status, "Building interaction summary…");

    const vettedIngNames = keptNodes.map((node) => node.ingredient);

    const summaries = initSummaryObjects(vettedIngNames, labelMap);

    // fill summaries by scanning pairs for mentions/non-mentions
    for (const [A, B] of pairs) {
      const aName = A.ingredient;
      const bName = B.ingredient;
    
      const aPayload =
        labelMap.get(aName.toUpperCase()) || { lines: [], fdaJsonLink: "" };
      const bPayload =
        labelMap.get(bName.toUpperCase()) || { lines: [], fdaJsonLink: "" };
    
      const aHits = textMentions(aPayload.lines, needleSetFor(B));
      const bHits = textMentions(bPayload.lines, needleSetFor(A));
    
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

    // finalize & render
    const summaryRows = finalizeSummaries(summaries);
    console.log("[Analyze] summaryRows:", summaryRows);

    renderInteractionSummary($summaryBody, summaryRows);
    $sectionPairs.style.display = "";

    // 9. display status message including timing and any bad inputs w/ error message
    const t1 = performance.now();
    const elapsedSec = ((t1 - t0) / 1000).toFixed(2);

    const skipBlock = buildSkipMessages();

    if (skipBlock) {
      setStatus(
        $status,
        `Analysis complete in ${elapsedSec}s.<br>${skipBlock}`
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
        fdaJsonLink: "",
      };

    obj[ingName] = {
      ingredientName: ingName,
      rxcui: null,
      mentions: [],
      nonMentions: [],

      // FDA payload
      fdaLabelName: payload.fdaLabelName || ingName,
      fdaApplication: payload.fdaApplication || "",
      fdaJsonLink: payload.fdaJsonLink || "",


      dailyMedName: payload.dailyMedName || ingName,
      dailyMedLink: payload.dailyMedLink || "",
    };
  }
  return obj;
}


// scours data for mentioned drug names with full sentence boundaries
// trims ttext with ellipses
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

    // 1. find sentence boundaries using "."
    // find the previous "." before the match
    let startBoundary = idx;
    while (startBoundary > 0 && fullText[startBoundary - 1] !== ".") {
      startBoundary--;
    }
    // skip the "." itself if we landed exactly on it
    if (fullText[startBoundary] === ".") {
      startBoundary++;
    }

    // find the next "." after the match
    let endBoundary = idx;
    while (endBoundary < fullText.length && fullText[endBoundary] !== ".") {
      endBoundary++;
    }
    // include the period
    if (endBoundary < fullText.length && fullText[endBoundary] === ".") {
      endBoundary++;
    }

    let sentenceChunk = fullText.slice(startBoundary, endBoundary).trim();

    // 2. highlight the hitName inside the chunk
    const re = new RegExp(hitName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    sentenceChunk = sentenceChunk.replace(
      re,
      (m) => `<mark style="background:yellow;color:#000;font-weight:bold;">${m}</mark>`
    );

    // 3. collapse whitespace
    sentenceChunk = sentenceChunk.replace(/\s+/g, " ").trim();

    const addLeadEllipsis = startBoundary > 0;
    const addTrailEllipsis = endBoundary < fullText.length;

    if (addLeadEllipsis) {
      sentenceChunk = "…" + sentenceChunk;
    }
    if (addTrailEllipsis && !sentenceChunk.endsWith("…")) {
      sentenceChunk = sentenceChunk + "…";
    }

    results.push({
      name: hitName,
      snippet: sentenceChunk, 
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
