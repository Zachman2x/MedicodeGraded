(function () {
  // Overlays
  const gateOverlay = document.getElementById("gate-overlay");       
  const declineOverlay = document.getElementById("decline-overlay");
  const appRoot = document.getElementById("app-root");

  // buttons
  const btnAccept = document.getElementById("btnAccept");
  const btnDecline = document.getElementById("btnDecline");
  const btnBackToDisclaimer = document.getElementById("btnBackToDisclaimer");

  const STORAGE_KEY = "hasAcceptedDisclaimer";

  // helper functions
  function show(el) {
    el.classList.remove("hidden");
  }

  function hide(el) {
    el.classList.add("hidden");
  }

  function lockApp() {
    appRoot.classList.add("app-locked");
  }

  function unlockApp() {
    appRoot.classList.remove("app-locked");
  }


  // Local Storage Logic
  let accepted = localStorage.getItem(STORAGE_KEY);

    // If there's no value yet, first-time visitor:
    // create ls variable as "false"
  if (accepted === null) {
    localStorage.setItem(STORAGE_KEY, "false");
    accepted = "false";
  }


  if (accepted === "true") {
    // Returning visitor:
    // - hide all overlays
    // - unlock the app
    hide(gateOverlay);
    hide(declineOverlay);
    unlockApp();
    console.log("User accepted disclaimer:", true);
  } else {
    // accepted === "false":
    // They have NOT accepted:
    // - show the main disclaimer first
    // - hide the decline overlay
    // - keep the app locked
    show(gateOverlay);
    hide(declineOverlay);
    console.log("User accepted disclaimer:", false);

    lockApp();
  }


  // User ACCEPTS disclaimer
  btnAccept.addEventListener("click", () => {
    localStorage.setItem(STORAGE_KEY, "true");
    console.log("User accepted disclaimer:", true)


    hide(gateOverlay);
    hide(declineOverlay);
    unlockApp();
  });

  // User DECLINES disclaimer
  btnDecline.addEventListener("click", () => {
    localStorage.setItem(STORAGE_KEY, "false");
    console.log("User accepted disclaimer:", false)


    hide(gateOverlay);
    show(declineOverlay);
    lockApp();
  });

  // Return to Disclaimer Button
  btnBackToDisclaimer.addEventListener("click", () => {

    hide(declineOverlay);
    show(gateOverlay);
    lockApp();
  });
})();
