import "./style.css";
import "./voice_log.css";

// Page Elements
const workareaContent =
  document.querySelector<HTMLDivElement>("#workarea_content")!;
const monologueLog = document.querySelector<HTMLDivElement>("#monologue_log")!;
const statusText = document.querySelector<HTMLDivElement>("#status")!;
const recognitionToggle = document.querySelector<HTMLInputElement>(
  "#recognition-toggle",
)!;
const interimResults =
  document.querySelector<HTMLSpanElement>("#interim-result")!;

let recognition: SpeechRecognition;

// Maximum auto-restart attempts to prevent infinite loops
const MAX_RESTARTS = 3;
// Current restart attempt count
let restartCount = 0;

// Content Save
// Initial load:
async function init() {
  const previousSave = await chrome.storage.local.get([
    "workarea_content_save",
    "monologue_log_save",
  ]);
  console.log(previousSave);
  if (previousSave.workarea_content_save) {
    workareaContent.innerText = previousSave.workarea_content_save;
  }
  if (previousSave.monologue_log_save) {
    monologueLog.innerText = previousSave.monologue_log_save;
  }
}
document.body.onload = init;

workareaContent.addEventListener("input", (_ev) => {
  console.log(workareaContent.innerText);

  chrome.storage.local.set({
    workarea_content_save: workareaContent.innerText,
  });
});
monologueLog.addEventListener("input", saveMonologueLog);
function saveMonologueLog(_ev: any) {
  console.log(monologueLog.innerText);

  chrome.storage.local.set({ monologue_log_save: monologueLog.innerText });
}

function startRecognition() {
  if (!("webkitSpeechRecognition" in window)) {
    console.log("Speech recognition not supported in this browser.");
    return false;
  }
  console.log("Speech recognition supported!");

  recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  // recognition.lang = 'en-US'; // Set the language as needed
  recognition.lang = "ja-JP";

  recognition.onstart = function () {
    console.log("Speech recognition started");
    statusText.textContent = "Recognition is on";
  };

  recognition.onresult = function (event) {
    // Get the last result from the results list
    const lastResultIndex = event.results.length - 1;
    const lastResult = event.results[lastResultIndex];

    // Check if the result is final
    if (lastResult.isFinal) {
      const transcript = lastResult[0].transcript.trim();
      console.log("Latest Transcript:", transcript);

      if (transcript) {
        // Append the new transcript with a <br> for a new line
        monologueLog.innerHTML += transcript + "<br> // "; //'<span> // </span>';

        // Check if the length exceeds 300 characters
        // Convert innerHTML to plain text to count characters
        const textContent =
          monologueLog.innerText || monologueLog.textContent || "";

        if (textContent.length > 300) {
          // Trim the content to the last 300 characters
          // Create a temporary element to manipulate HTML
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = monologueLog.innerHTML;

          // Remove excess characters from the start
          while (tempDiv.innerText.length > 300 && tempDiv.firstChild) {
            tempDiv.removeChild(tempDiv.firstChild);
          }

          // Update the monologueLog with trimmed content
          monologueLog.innerHTML = tempDiv.innerHTML;
        }

        console.log("Updated Transcript:", monologueLog.innerHTML);

        // // Update your UI with the latest transcript
        // monologueLog.textContent = (monologueLog.textContent + "<br>\n" + transcript).slice(-300);;
        // interimResults.textContent = ''
        saveMonologueLog(undefined);
      } else {
        console.log("Ignored empty or whitespace-only transcript");
      }
    } else {
      const transcript = lastResult[0].transcript;
      console.log("Interim Transcript:", transcript);

      interimResults.textContent = transcript;
    }
  };

  recognition.onerror = function (event) {
    console.error("Error occurred in recognition:", event.error);
  };

  recognition.onend = function () {
    console.log("Speech recognition ended");

    statusText.textContent = "Recognition is off";
    // auto-restart if under restart limit
    if (recognitionToggle.checked) {
      if (restartCount < MAX_RESTARTS) {
        restartCount++;
        recognition!.start();
      } else {
        console.warn(
          `Stopping recognition: max restarts reached (restarts=${restartCount}).`,
        );
        recognitionToggle.checked = false;
      }
    }
  };

  // reset restart counter on manual start
  restartCount = 0;
  recognition.start();
}

recognitionToggle.addEventListener("change", function () {
  if (recognitionToggle.checked) {
    startRecognition();
    // if (recognition) recognition.start();
  } else {
    if (recognition) recognition.stop();
  }
});

// window.startRecognition = startRecognition

// getVisibleText via message:
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "callFunction") {
    // Call the desired function here
    console.log("Function called from side panel!", sender);

    const text = getVisibleText();
    sendResponse({ status: "success", visibleText: text });
  }
});

// Consider https://stackoverflow.com/questions/6961022/measure-bounding-box-of-text-node-in-javascript
function getVisibleText() {
  const viewportHeight = Math.max(
    document.documentElement.clientHeight,
    window.innerHeight || 0,
  );
  const viewportWidth = Math.max(
    document.documentElement.clientWidth,
    window.innerWidth || 0,
  );
  let visibleText = "";
  var walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
  );
  var node;
  var textNodes = [];
  while ((node = walker.nextNode())) {
    const range = document.createRange();
    range.selectNodeContents(node);
    const rect = range.getBoundingClientRect();

    // const rect = (node.parentNode as Element).getBoundingClientRect();
    console.log(node, rect);
    // Check if element is within the viewport
    if (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= viewportHeight &&
      rect.right <= viewportWidth
    ) {
      visibleText += node.textContent!.trim() + " "; // Extract text and trim whitespace
      textNodes.push(node.parentNode);
    } else {
      console.log("invisible node", node.parentNode);
    }
  }
  console.log(textNodes);
  console.log(visibleText);
  return visibleText;
}
