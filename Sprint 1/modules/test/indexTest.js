// Elements to test
// const $drugs = document.getElementById("drugs");
const $drugs = document.querySelectorAll(".drugClass");

const $analyze = document.getElementById("analyze");
const $status = document.getElementById("status");
const $dedup = document.getElementById("section-dedup");
const $pairs = document.getElementById("section-pairs");
const $pairsBody = document.querySelector("#pairsTable tbody");
const $debugN = document.getElementById("debugNormalized");
const $debugS = document.getElementById("debugSnippets");
const $sectionMedList = document.getElementById("section-medlist");
const $btnLoadMedList = document.getElementById("btnLoadMedList");
const $btnClearMedList = document.getElementById("btnClearMedList");
const $medListContainer = document.getElementById("medListContainer");

// Front End test
(function frontEndTest() {
  const checks = [
    ["#drugs (textarea)", !!$drugs],
    ["#analyze (button)", !!$analyze],
    ["#status (div)", !!$status],
    ["#section-dedup", !!$dedup],
    ["#section-pairs", !!$pairs],
    ["#pairsTable tbody", !!$pairsBody],
    ["#debugNormalized", !!$debugN],
    ["#debugSnippets", !!$debugS],
    ["#section-medlist", !!$sectionMedList],
    ["#btnLoadMedList", !!$btnLoadMedList],
    ["#btnClearMedList", !!$btnClearMedList],
    ["#medListContainer", !!$medListContainer],
  ];
  console.group("%cMediCode Front-End Test", "color:#60a5fa;font-weight:bold");
  console.table(checks.map(([name, ok]) => ({ item: name, ok })));
  console.groupEnd();
  $status.textContent = "Ready.";
})();

// Button Test
$analyze.addEventListener("click", () => {
  console.log("[Analyze] clicked");
  
  const $drugs = document.querySelectorAll(".drugClass");
  const inputs = Array.from($drugs)
    .map((s) => s.value)
    .filter(Boolean);
  console.log("[Analyze] inputs:", inputs);

  $analyze.disabled = true;

  setTimeout(() => {
    $analyze.disabled = false;

    $dedup.style.display = "none";
    $pairs.style.display = "none";

    // $debugN.textContent = JSON.stringify(
    //   inputs.map((q) => ({ query: q })),
    //   null,
    //   2
    // );
    // $debugS.textContent = "(test debug text content)";
  }, 1000);
});
