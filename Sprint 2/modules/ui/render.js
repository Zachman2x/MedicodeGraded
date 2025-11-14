//  Updates HTML element with status
export function setStatus(el, txt) {
  if (!el) return;
  el.innerHTML = txt;
}

// helper to enable or disable HTML elements
export function setDisabled(el, disabled) {
  if (!el) return;
  el.disabled = !!disabled;
}

// handler for displaying saved medication list
export function renderMedList(container, entries) {
  if (!container) return;

  container.innerHTML = "";

  if (!entries || !entries.length) {
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent =
      "Search meds and save them to keep track of your medication list.";
    container.appendChild(p);
    return;
  }

  const ul = document.createElement("ul");
  ul.style.margin = "0";
  ul.style.paddingLeft = "1rem";

  for (const e of entries) {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="mono">${e.name}</span>
      ${e.rxcui ? `<span class="muted">(RXCUI: ${e.rxcui})</span>` : ""}
    `;
    ul.appendChild(li);
  }

  container.appendChild(ul);
}


//  hanlder for displaying deduped ingredients
export function renderDedupList(container, ingredientsArray) {
  if (!container) return;
  container.innerHTML = "";

  if (!ingredientsArray || !ingredientsArray.length) {
    container.textContent = "(no ingredients found)";
    return;
  }

  for (const ing of ingredientsArray) {
    const span = document.createElement("span");
    span.className = "pill mono"; 
    span.style.display = "inline-block";
    span.style.padding = "0.25rem 0.5rem";
    span.style.marginRight = "0.5rem";
    span.style.marginBottom = "0.5rem";
    span.style.border = "1px solid #ccc";
    span.style.borderRadius = "0.4rem";
    span.style.fontSize = "0.8rem";

    span.textContent = ing.name;
    container.appendChild(span);
  }
}

// Summary Object:
//  summaryRows = [
//    {
//      ingredientName: "ibuprofen",
//      rxcui: "1234",
//      mentions: [
//         { name: "acetaminophen", snippet: "..." },
//         { name: "aspirin", snippet: "..." }
//      ],
//      nonMentions: [
//         { name: "simvastatin" },
//         { name: "metformin" }
//      ],
//      sourceLabelName: "FDA label: ibuprofen 200 MG tablet",
//      sourceLink: "https:..."
//    },
//  ]
// }

// builds and displays interaction summary table
// mentions/non-mentions and source links/snippets
// expandable
export function renderInteractionSummary(tbodyEl, summaryRows) {
  if (!tbodyEl) return;
  tbodyEl.innerHTML = "";

  if (!summaryRows || !summaryRows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.className = "muted";
    td.textContent = "No interaction data available.";
    tr.appendChild(td);
    tbodyEl.appendChild(tr);
    return;
  }

  summaryRows.forEach((row, idx) => {
    // Summary row
    const trMain = document.createElement("tr");
    trMain.className = "summary-row";

    // Ingredients
    const tdIng = document.createElement("td");
    tdIng.className = "mono";
    tdIng.textContent = row.ingredientName;
    trMain.appendChild(tdIng);

    // Mentions 
    const tdMentions = document.createElement("td");
    if (row.mentions.length > 0) {
      tdMentions.innerHTML = `
        <span style="color:#16a34a;font-weight:bold;">&#x26A0;&#xFE0F;</span> 
        ${row.mentions.map(m => m.name).join(", ")} 
        <span style="color:#666;">(${row.mentions.length})</span>
      `;
    } else {
      tdMentions.innerHTML = `
        <span style="color:#9ca3af;">—</span>
      `;
    }
    trMain.appendChild(tdMentions);


    const tdNon = document.createElement("td");
    const nonNames = row.nonMentions.map(n => n.name);
    tdNon.textContent = nonNames.length
      ? nonNames.join(", ") + ` (${nonNames.length})`
      : "—";
    trMain.appendChild(tdNon);



    // Source link (FDA label info + DailyMed link)
    const tdSource = document.createElement("td");
    tdSource.style.fontSize = "0.8rem";
    tdSource.style.lineHeight = "1.4";

    // Build the FDA label line
    {
      const fdaLine = document.createElement("div");
    
      // Construct label text like:
      const labelText = row.fdaApplication
        ? `FDA label: ${row.fdaLabelName} [${row.fdaApplication}]`
        : `FDA label: ${row.fdaLabelName}`;
    
      if (row.fdaJsonLink) {
        // Make the label text clickable to the FDA JSON
        const link = document.createElement("a");
        link.href = row.fdaJsonLink;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = labelText;
      
        fdaLine.appendChild(link);
      } else {
        // Fallback if no URL for some reason
        fdaLine.textContent = labelText;
      }
    
      tdSource.appendChild(fdaLine);
    }

    trMain.appendChild(tdSource);


    // Toggle details row on click
    trMain.style.cursor = "pointer";

    // Details row (hidden by default)
    const trDetails = document.createElement("tr");
    trDetails.className = "details-row";
    const tdDetails = document.createElement("td");
    tdDetails.colSpan = 4;
    tdDetails.style.fontSize = "0.8rem";
    tdDetails.style.lineHeight = "1.4";
    tdDetails.style.background = "#fafafa";
    tdDetails.style.borderTop = "1px solid #eee";

    
    const detailsParts = [];

    if (row.mentions.length) {
      const mBlock = document.createElement("div");
      mBlock.style.marginBottom = "0.75rem";

      const mTitle = document.createElement("div");
      mTitle.style.fontWeight = "bold";
      mTitle.textContent = "Mentioned in FDA Label Data:";
      mBlock.appendChild(mTitle);

      row.mentions.forEach((m) => {
        const item = document.createElement("div");
        item.style.marginLeft = "1rem";
        item.style.marginTop = "0.4rem";

        const head = document.createElement("div");
        head.innerHTML = `
          <span style="color:#16a34a;font-weight:bold;">&#x26A0;&#xFE0F;</span>
          <strong>${m.name}</strong>
        `;
        item.appendChild(head);


        if (m.snippet) {
          const snip = document.createElement("div");
          snip.className = "mono";
          snip.style.whiteSpace = "pre-wrap";
          snip.style.background = "#fff";
          snip.style.border = "1px solid #ddd";
          snip.style.borderRadius = "0.4rem";
          snip.style.padding = "0.5rem 0.75rem";
          snip.innerHTML = m.snippet;
          item.appendChild(snip);
        }

        mBlock.appendChild(item);
      });

      detailsParts.push(mBlock);
    }

    if (row.nonMentions.length) {
      const nBlock = document.createElement("div");

      const nTitle = document.createElement("div");
      nTitle.style.fontWeight = "bold";
      nTitle.textContent = "Not Mentioned:";
      nBlock.appendChild(nTitle);

      const list = document.createElement("div");
      list.style.marginLeft = "1rem";
      list.style.marginTop = "0.4rem";
      list.className = "mono";
      list.textContent = row.nonMentions.map(n => n.name).join(", ");
      nBlock.appendChild(list);

      detailsParts.push(nBlock);
    }

    if (!row.mentions.length && !row.nonMentions.length) {
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "muted";
      emptyMsg.textContent = "No comparison targets for this ingredient.";
      detailsParts.push(emptyMsg);
    }

    detailsParts.forEach(part => tdDetails.appendChild(part));
    trDetails.appendChild(tdDetails);

    // hidden by default
    trDetails.style.display = "none";

    // click to toggle
    trMain.addEventListener("click", () => {
      const shown = trDetails.style.display !== "none";
      trDetails.style.display = shown ? "none" : "table-row";
    });

    tbodyEl.appendChild(trMain);
    tbodyEl.appendChild(trDetails);
  });
}
