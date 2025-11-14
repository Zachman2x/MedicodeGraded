const nameRegex = /^[A-Za-z\- ]+$/;
const container = document.getElementById("drug-fields");
const analyzeBtn = document.getElementById("analyze");
const addBtn = document.getElementById("add-field"); 
const errorMessage = document.querySelector(".errorMessage");

// returns all medication input values with .drugClass class
export function getDrugInputs() {
  return container.querySelectorAll(".drugClass");
}

// gets all non-empty medication names from input fields
export function collectDrugQueriesFromRows() {
  return Array.from(getDrugInputs())
    .map((input) => input.value.trim())
    .filter((v) => v.length > 0);
}


// validates inputs through regex
// highlights red and displays error if input doens't validate
export function validateAllInputs() {
  const inputs = getDrugInputs();
  let allValid = true;

  for (const input of inputs) {
    const value = input.value.trim();
    if (value === "") {
      input.classList.remove("invalid-input");
      continue;
    }

    if (!nameRegex.test(value)) {
      input.classList.add("invalid-input");
      allValid = false;
    } else {
      input.classList.remove("invalid-input");
    }
  }

  if (!allValid) {
    if (errorMessage) errorMessage.style.display = "block";
  } else {
    if (errorMessage) errorMessage.style.display = "none";
  }

  return allValid;
}

// enables analyze button
export function updateAnalyzeButton() {
  const filledCount = Array.from(getDrugInputs()).filter(
    (input) => input.value.trim().length > 0
  ).length;

  const allValid = validateAllInputs();

  const enable = filledCount >= 2 && allValid;
  if (analyzeBtn) {
    analyzeBtn.disabled = !enable;
  }
}

export function updateDeleteButtons() {
  const buttons = container.querySelectorAll(".delete-btn");
  const unlockAll = buttons.length >= 3;
  buttons.forEach((btn) => {
    btn.disabled = !unlockAll;
  });
}


// Adds drug input fields
export function addDrugField(presetValue = "") {
  const div = document.createElement("div");
  div.className = "drug-input";
  div.innerHTML = `
    <input
      type="text"
      name="drugInput"
      class="drugClass"
      placeholder="Enter another medication"
      required
    />
    <button
      type="button"
      class="delete-btn"
      aria-label="Remove this medication"
      title="Remove this medication"
    >
      ✕
    </button>
  `;

  container.appendChild(div);

  const newInput = div.querySelector(".drugClass");
  if (presetValue) {
    newInput.value = presetValue;
  }

  newInput.addEventListener("input", () => {
    updateAnalyzeButton();
  });

  newInput.addEventListener("keydown", (e) => {
    if (
      e.key === "Enter" &&
      e.ctrlKey &&
      analyzeBtn &&
      !analyzeBtn.disabled
    ) {
      analyzeBtn.click();
    }
  });

  updateDeleteButtons();
  updateAnalyzeButton();

  const total = getDrugInputs().length;
  console.log(`Input field added. Total rows: ${total}`);
}

// handler for delete buttons "x"
export function installDeleteHandler() {
  container.addEventListener("click", (e) => {
    if (e.target.classList.contains("delete-btn")) {
      const btn = e.target;
      if (btn.disabled) return;
      btn.parentElement.remove();
      updateDeleteButtons();
      updateAnalyzeButton();

      const total = getDrugInputs().length;
      console.log(`Input field removed. Total rows: ${total}`);
    }
  });
}

// handler attaches listeners to update the Analyze button on input
// refreshes delete/analyze button states
export function initExistingRows() {
  getDrugInputs().forEach((input) => {
    input.addEventListener("input", () => {
      updateAnalyzeButton();
    });

    input.addEventListener("keydown", (e) => {
      if (
        e.key === "Enter" &&
        e.ctrlKey &&
        analyzeBtn &&
        !analyzeBtn.disabled
      ) {
        analyzeBtn.click();
      }
    });
  });

  if (addBtn) {
    addBtn.addEventListener("click", () => {
      addDrugField();
    });
  }

  updateDeleteButtons();
  updateAnalyzeButton();
}

// Ihandler to input medications from saved list; updates delete and analyze button states
export function populateDrugInputsFromList(entries) {
  container.innerHTML = "";
  for (const e of entries) {
    addDrugField(e.name);
  }
  updateDeleteButtons();
  updateAnalyzeButton();
}
