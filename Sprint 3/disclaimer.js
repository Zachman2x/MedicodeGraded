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


function ensureKey(){
  let val = localStorage.getItem(STORAGE_KEY);
  if(val == null){
    localStorage.setItem(STORAGE_KEY,"false");
    val = "false";
  }
  return val;
}

function enforceDisclaimerState(){
  const accepted = ensureKey();
  if (accepted === "true"){
    hide(gateOverlay);
    hide(declineOverlay);
    unlockApp();
    console.log("[disclaimer accepted = true -> app unlocked");

  }else{
    show(gateOverlay);
    hide(declineOverlay);
    lockApp();
    console.log("[disclaimer accepted = false -> app locked");
  }
}

enforceDisclaimerState();

setInterval(() => { 
  const current = localStorage.getItem(STORAGE_KEY);
  if(current === null){
    console.log("[disclaimer] STORAGE_KEY missing mid-session -> re-locking app");
    enforceDisclaimerState();
  }
}, 1000);

  // User ACCEPTS disclaimer
  btnAccept.addEventListener("click", () => {
    localStorage.setItem(STORAGE_KEY, "true");
    console.log("User accepted disclaimer:", true);

    enforceDisclaimerState();
  });

  // User DECLINES disclaimer
  btnDecline.addEventListener("click", () => {
    localStorage.setItem(STORAGE_KEY, "false");
    console.log("User accepted disclaimer:", false);

    hide(gateOverlay);
    show(declineOverlay);
    lockApp();
  });

  // Return to Disclaimer Button
  btnBackToDisclaimer.addEventListener("click", () => {
    enforceDisclaimerState();
  });
})();