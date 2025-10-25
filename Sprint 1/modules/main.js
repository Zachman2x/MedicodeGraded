const container = document.getElementById("drug-fields");
const addBtn = document.getElementById("add-field");

document.addEventListener("DOMContentLoaded", () => {
  const analyzeBtn = document.getElementById("analyze");

  // Function: Get all drug input fields
  function getDrugInputs() {
    return container.querySelectorAll(".drugClass");
  }

  // Function: Enable or disable the Analyze button
  function updateAnalyzeButton() {
    const hasInput = Array.from(getDrugInputs()).some(
      (input) => input.value.trim().length > 0
    );
    analyzeBtn.disabled = !hasInput;
  }

  // Function: Enable/disable delete buttons
  function updateDeleteButtons() {
    const buttons = container.querySelectorAll(".delete-btn");
    buttons.forEach((btn) => {
      btn.disabled = buttons.length <= 2;
    });
  }

  // Function: Add a new drug input field
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
      <button type="button" class="delete-btn">- Delete Medication</button>
    `;
    container.appendChild(div);
    updateDeleteButtons();
    updateAnalyzeButton();

    // Add input listener for new field
    div.querySelector(".drugClass").addEventListener("input", updateAnalyzeButton);
  }

  // Add field button click
  addBtn.addEventListener("click", addDrugField);

  // Delete a specific drug input field
  container.addEventListener("click", (e) => {
    if (e.target.classList.contains("delete-btn")) {
      e.target.parentElement.remove();
      updateDeleteButtons();
      updateAnalyzeButton();
    }
  });

  // Input listeners for existing fields
  getDrugInputs().forEach((input) => {
    input.addEventListener("input", updateAnalyzeButton);

    // Ctrl + Enter to trigger Analyze
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.ctrlKey && !analyzeBtn.disabled) {
        analyzeBtn.click();
      }
    });
  });

  // Initial setup
  updateDeleteButtons();
  updateAnalyzeButton();
});
