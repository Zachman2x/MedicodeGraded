const container = document.getElementById("drug-fields");
const addBtn = document.getElementById("add-field");
const regex = /^[A-Za-z\- ]+$/;

document.addEventListener("DOMContentLoaded", () => {
  const analyzeBtn = document.getElementById("analyze");
  const errorMessage = document.querySelector(".errorMessage");

  // Gets all drug input fields
  function getDrugInputs() {
    return container.querySelectorAll(".drugClass");
  }

  // Check regex for all non-empty inputs
  // change CSS to highlight failed inputs
  function regexPass() {
    const inputs = getDrugInputs();
    let allValid = true;

    for (const input of inputs) {
      const value = input.value.trim();

      if (value === "") {
        input.classList.remove("invalid-input");
        continue;
      }

      if (!regex.test(value)) {
        input.classList.add("invalid-input");
        allValid = false;
        console.log(value);
        console.log("Invalid Input Value");
      } else {
        input.classList.remove("invalid-input");
        console.log("Valid Input Value");
      }
    }

    return allValid;
  }

  // Enable or disable the Analyze button + show/hide error
  function updateAnalyzeButton() {
    const filledCount = Array.from(getDrugInputs()).filter(
      (input) => input.value.trim().length > 0
    ).length;

    const allValid = regexPass();

    // must have at least 2 filled AND all valid
    analyzeBtn.disabled = !(filledCount >= 2 && allValid);

    if (!allValid) {
      errorMessage.style.display = "block";
    } else {
      errorMessage.style.display = "none";
    }
  }

  // Enables delete "X" buttons if there are 2 or more total rows
  function updateDeleteButtons() {
    const buttons = container.querySelectorAll(".delete-btn");

    const unlockAll = buttons.length >= 3;

    buttons.forEach((btn) => {
      btn.disabled = !unlockAll;
    });
  }

  function addDrugField() {
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
    console.log("Drug input field added (total:", getDrugInputs().length, ")");

    const newInput = div.querySelector(".drugClass");
    newInput.addEventListener("input", updateAnalyzeButton);
    newInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.ctrlKey && !analyzeBtn.disabled) {
        analyzeBtn.click();
      }
    });

    updateDeleteButtons();
    updateAnalyzeButton();
  }

  // Click handler for remove medication buttons "x"
  container.addEventListener("click", (e) => {
    if (e.target.classList.contains("delete-btn")) {
      const btn = e.target;
      if (btn.disabled) {
        return;
      }
      // removes whole row
      btn.parentElement.remove();
      console.log("Drug input field removed (total:", getDrugInputs().length, ")");

      updateDeleteButtons();
      updateAnalyzeButton();
    }
  });

  getDrugInputs().forEach((input) => {
    input.addEventListener("input", updateAnalyzeButton);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.ctrlKey && !analyzeBtn.disabled) {
        analyzeBtn.click();
      }
    });
  });

  // Add drug input field button
  addBtn.addEventListener("click", addDrugField);

  updateDeleteButtons();
  updateAnalyzeButton();
});
