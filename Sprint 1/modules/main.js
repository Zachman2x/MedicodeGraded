document.addEventListener("DOMContentLoaded", () => {
  const analyzeBtn = document.getElementById("analyze");
  const drugInput = document.getElementById("drugs");

  // Disable button initially
  analyzeBtn.disabled = true;

  // Enable only when input has content
  drugInput.addEventListener("input", () => {
    const hasInput = drugInput.value.trim().length > 0;
    analyzeBtn.disabled = !hasInput;
  });

  drugInput.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" && e.ctrlKey) && !analyzeBtn.disabled) {
      analyzeBtn.click();
    }
  });
});
