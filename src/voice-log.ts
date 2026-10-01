import "./style.css";
import "./voice_log.css";
import { CONFIG_RO } from "./features/config-store";
import { OllamaLLMService } from "./features/llm-service";
import { OLLAMA_API_URL_DEFAULT } from "./lib/constants";
import { buildCondensationPrompt } from "./voice-log-prompt";

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
const condensedLog =
  document.querySelector<HTMLDivElement>("#condenced_log")!;
const modelSelect = document.querySelector<HTMLSelectElement>("#model")!;
const condenseButton =
  document.querySelector<HTMLButtonElement>("#condense-button")!;
const processingStatus =
  document.querySelector<HTMLSpanElement>("#processing-status")!;
const summaryRecognitionStatus = document.querySelector<HTMLSpanElement>(
  "#summary-recognition-status",
)!;
const summaryProcessingStatus = document.querySelector<HTMLSpanElement>(
  "#summary-processing-status",
)!;
const summaryCondenseButton = document.querySelector<HTMLButtonElement>(
  "#summary-condense-button",
)!;
const monologueProgressLabel = document.querySelector<HTMLSpanElement>(
  "#monologue-progress-label",
)!;
const monologueProgressBar = document.querySelector<HTMLDivElement>(
  "#monologue-progress-bar",
)!;
const installJapaneseModelButton = document.querySelector<HTMLButtonElement>(
  "#install-japanese-model",
)!;
const localModelStatus = document.querySelector<HTMLSpanElement>(
  "#local-model-status",
)!;
const autoCondenseToggle = document.querySelector<HTMLInputElement>(
  "#auto-condense-toggle",
)!;
const VOICE_LOG_MODEL_STORAGE_KEY = "voice_log_model";
const VOICE_LOG_LAYOUT_STORAGE_KEY = "voice_log_layout";
const VOICE_LOG_CARD_ORDER_STORAGE_KEY = "voice_log_card_order";
const AUTO_CONDENSATION_TIMEOUT_MS = 30_000;
const AUTO_CONDENSATION_CHANGE_RATIO = 0.5;
const RECOGNITION_INACTIVITY_LIMIT_MS = 10 * 60 * 1000;
const RECOGNITION_SESSION_LIMIT_MS = 30 * 60 * 1000;

const voiceMain = document.querySelector<HTMLElement>(".voice-main")!;
const verticalLayoutButton =
  document.querySelector<HTMLButtonElement>("#vertical-layout")!;
const horizontalLayoutButton =
  document.querySelector<HTMLButtonElement>("#horizontal-layout")!;
const clearLogButton =
  document.querySelector<HTMLButtonElement>("#clear-log-button")!;
const logCards = Array.from(
  document.querySelectorAll<HTMLElement>(".log-card"),
);

function syncCompactControls() {
  summaryRecognitionStatus.textContent = statusText.textContent || "";
  summaryProcessingStatus.textContent = processingStatus.textContent || "";
  summaryCondenseButton.disabled = condenseButton.disabled;
  summaryCondenseButton.textContent = condenseButton.disabled ? "…" : "Run";
}

new MutationObserver(syncCompactControls).observe(statusText, {
  childList: true,
  characterData: true,
  subtree: true,
});
new MutationObserver(syncCompactControls).observe(processingStatus, {
  childList: true,
  characterData: true,
  subtree: true,
});
new MutationObserver(syncCompactControls).observe(condenseButton, {
  attributes: true,
  childList: true,
  characterData: true,
  subtree: true,
});
syncCompactControls();

summaryCondenseButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  void condenseVoiceLog("manual");
});

function setLogLayout(layout: "vertical" | "horizontal") {
  const horizontal = layout === "horizontal";
  voiceMain.classList.toggle("is-horizontal", horizontal);
  verticalLayoutButton.setAttribute("aria-pressed", String(!horizontal));
  horizontalLayoutButton.setAttribute("aria-pressed", String(horizontal));
}

function saveLogLayout() {
  const order = Array.from(voiceMain.querySelectorAll<HTMLElement>(".log-card"))
    .map((card) => card.id);
  chrome.storage.local.set({
    [VOICE_LOG_LAYOUT_STORAGE_KEY]: voiceMain.classList.contains("is-horizontal")
      ? "horizontal"
      : "vertical",
    [VOICE_LOG_CARD_ORDER_STORAGE_KEY]: order,
  });
}

async function restoreLogLayout() {
  const saved = await chrome.storage.local.get([
    VOICE_LOG_LAYOUT_STORAGE_KEY,
    VOICE_LOG_CARD_ORDER_STORAGE_KEY,
  ]);
  const layout = saved[VOICE_LOG_LAYOUT_STORAGE_KEY] === "horizontal"
    ? "horizontal"
    : "vertical";
  setLogLayout(layout);

  if (Array.isArray(saved[VOICE_LOG_CARD_ORDER_STORAGE_KEY])) {
    const cardsById = new Map(logCards.map((card) => [card.id, card]));
    for (const cardId of saved[VOICE_LOG_CARD_ORDER_STORAGE_KEY]) {
      const card = typeof cardId === "string" ? cardsById.get(cardId) : undefined;
      if (card) voiceMain.appendChild(card);
    }
  }
}

verticalLayoutButton.addEventListener("click", () => {
  setLogLayout("vertical");
  saveLogLayout();
});
horizontalLayoutButton.addEventListener("click", () => {
  setLogLayout("horizontal");
  saveLogLayout();
});

let draggedCard: HTMLElement | null = null;
let dragOriginCard: HTMLElement | null = null;
for (const card of logCards) {
  card.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      dragOriginCard = null;
      return;
    }

    const startsInEditor = Boolean(
      target.closest(".log-editor, textarea, input, select, button"),
    );
    const bounds = card.getBoundingClientRect();
    const resizeCornerSize = 20;
    const startsInResizeCorner =
      event.clientX >= bounds.right - resizeCornerSize &&
      event.clientY >= bounds.bottom - resizeCornerSize;
    dragOriginCard = startsInEditor || startsInResizeCorner ? null : card;
  });

  card.addEventListener("dragstart", (event) => {
    if (dragOriginCard !== card) {
      event.preventDefault();
      return;
    }

    dragOriginCard = null;
    draggedCard = card;
    card.classList.add("is-dragging");
    event.dataTransfer?.setData("text/plain", card.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  });
  card.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (!draggedCard || draggedCard === card) return;
    const bounds = card.getBoundingClientRect();
    const horizontal = voiceMain.classList.contains("is-horizontal");
    const midpoint = horizontal
      ? bounds.left + bounds.width / 2
      : bounds.top + bounds.height / 2;
    const pointer = horizontal ? event.clientX : event.clientY;
    voiceMain.insertBefore(
      draggedCard,
      pointer < midpoint ? card : card.nextElementSibling,
    );
  });
  card.addEventListener("dragend", () => {
    card.classList.remove("is-dragging");
    draggedCard = null;
    dragOriginCard = null;
    saveLogLayout();
  });
}

const JAPANESE_SPEECH_LANGUAGE = "ja-JP";
type LocalSpeechRecognitionStatus =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable";
type LocalSpeechRecognitionConstructor = {
  new (): SpeechRecognition;
  available?: (options: {
    langs: string[];
    processLocally: boolean;
  }) => Promise<LocalSpeechRecognitionStatus>;
  install?: (options: {
    langs: string[];
    processLocally: boolean;
  }) => Promise<boolean>;
};

function getSpeechRecognitionConstructor():
  | LocalSpeechRecognitionConstructor
  | undefined {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: LocalSpeechRecognitionConstructor;
    webkitSpeechRecognition?: LocalSpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
}

async function updateJapaneseModelStatus() {
  const speechRecognition = getSpeechRecognitionConstructor();
  if (!speechRecognition?.available || !speechRecognition.install) {
    installJapaneseModelButton.disabled = true;
    localModelStatus.textContent =
      "On-device model installation is not supported in this browser.";
    return;
  }

  try {
    const availability = await speechRecognition.available({
      langs: [JAPANESE_SPEECH_LANGUAGE],
      processLocally: true,
    });
    if (availability === "available") {
      installJapaneseModelButton.disabled = true;
      installJapaneseModelButton.textContent = "Japanese model installed";
      localModelStatus.textContent = "On-device recognition is ready.";
    } else if (availability === "downloadable") {
      installJapaneseModelButton.disabled = false;
      localModelStatus.textContent = "Download required for on-device recognition.";
    } else if (availability === "downloading") {
      installJapaneseModelButton.disabled = true;
      localModelStatus.textContent = "Japanese model is downloading…";
    } else {
      installJapaneseModelButton.disabled = true;
      localModelStatus.textContent =
        "Japanese on-device recognition is unavailable.";
    }
  } catch (error) {
    console.error("Failed to check Japanese speech model availability:", error);
    installJapaneseModelButton.disabled = true;
    localModelStatus.textContent = "Could not check the Japanese model.";
  }
}

async function installJapaneseSpeechModel() {
  const speechRecognition = getSpeechRecognitionConstructor();
  if (!speechRecognition?.install) return;

  installJapaneseModelButton.disabled = true;
  installJapaneseModelButton.textContent = "Installing…";
  localModelStatus.textContent = "Downloading the Japanese model…";

  try {
    const installed = await speechRecognition.install({
      langs: [JAPANESE_SPEECH_LANGUAGE],
      processLocally: true,
    });
    if (installed) {
      installJapaneseModelButton.textContent = "Japanese model installed";
      localModelStatus.textContent = "On-device recognition is ready.";
    } else {
      installJapaneseModelButton.disabled = false;
      installJapaneseModelButton.textContent = "Install Japanese model";
      localModelStatus.textContent = "The Japanese model was not installed.";
    }
  } catch (error) {
    console.error("Failed to install Japanese speech model:", error);
    installJapaneseModelButton.disabled = false;
    installJapaneseModelButton.textContent = "Install Japanese model";
    localModelStatus.textContent = "Japanese model installation failed.";
  }
}

installJapaneseModelButton.addEventListener(
  "click",
  installJapaneseSpeechModel,
);

let condensationRunning = false;
let lastCondensedTranscript = "";
let lastCondensationAt = Date.now();
let contentRevision = 0;

function getProcessedPrefixLength(currentTranscript: string) {
  const commonLength = Math.min(
    currentTranscript.length,
    lastCondensedTranscript.length,
  );
  let index = 0;
  while (
    index < commonLength &&
    currentTranscript[index] === lastCondensedTranscript[index]
  ) {
    index += 1;
  }
  return index;
}

function clearProcessedHighlights() {
  monologueLog.querySelectorAll(".processed-segment").forEach((segment) => {
    segment.replaceWith(document.createTextNode(segment.textContent || ""));
  });
}

function highlightProcessedPrefix(processedLength: number) {
  clearProcessedHighlights();
  if (processedLength <= 0) return;

  const walker = document.createTreeWalker(monologueLog, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!node.parentElement?.closest(".processed-segment")) {
      textNodes.push(node as Text);
    }
  }
  let remaining = processedLength;

  for (const node of textNodes) {
    if (remaining <= 0) break;
    const text = node.textContent || "";
    if (!text) continue;

    const length = Math.min(remaining, text.length);
    const processed = document.createElement("span");
    processed.className = "processed-segment";
    processed.textContent = text.slice(0, length);
    node.parentNode?.insertBefore(processed, node);
    if (length === text.length) {
      node.remove();
    } else {
      node.textContent = text.slice(length);
    }
    remaining -= length;
  }
}

function updateMonologueProgress() {
  const transcript = monologueLog.innerText.trim();
  const processedLength = getProcessedPrefixLength(transcript);
  const percentage = transcript.length
    ? Math.round((processedLength / transcript.length) * 100)
    : 0;
  monologueProgressBar.style.width = `${percentage}%`;
  monologueProgressLabel.textContent = transcript.length
    ? `${percentage}% processed · new text remains unhighlighted`
    : "Nothing processed yet";
  highlightProcessedPrefix(processedLength);
}

async function condenseVoiceLog(trigger: "manual" | "automatic" = "manual") {
  if (condensationRunning) return false;

  const requestRevision = contentRevision;
  const workarea = workareaContent.innerText.trim();
  const currentCondensedLog = condensedLog.innerText.trim();
  const transcript = monologueLog.innerText.trim();
  if (!workarea && !currentCondensedLog && !transcript) {
    processingStatus.textContent = "Add some notes or transcript first.";
    return false;
  }

  condensationRunning = true;
  condenseButton.disabled = true;
  condenseButton.textContent = "Condensing…";
  processingStatus.textContent = "Using local model…";

  try {
    const apiUrl = (await CONFIG_RO.OLLAMA_API_URL()) || OLLAMA_API_URL_DEFAULT;
    const model = modelSelect.value;
    if (!model) throw new Error("No local model is selected.");

    const service = new OllamaLLMService(apiUrl, model);
    const result = await service.chat(
      buildCondensationPrompt(workarea, currentCondensedLog, transcript),
    );
    if (!result.trim()) throw new Error("The local model returned no content.");
    if (requestRevision !== contentRevision) return false;

    condensedLog.innerText = result.trim();
    condensedLog.dispatchEvent(new Event("input", { bubbles: true }));
    lastCondensedTranscript = transcript;
    lastCondensationAt = Date.now();
    updateMonologueProgress();
    processingStatus.textContent = trigger === "automatic"
      ? "Condensed automatically."
      : "Condensed log updated.";
    return true;
  } catch (error) {
    console.error("Failed to condense Voice Log:", error);
    if (requestRevision === contentRevision) {
      processingStatus.textContent =
        error instanceof Error ? error.message : "Condensation failed.";
    }
    return false;
  } finally {
    condensationRunning = false;
    condenseButton.disabled = false;
    condenseButton.textContent = "Run condensation";
  }
}

condenseButton.addEventListener("click", () => {
  void condenseVoiceLog("manual");
});

function shouldAutomaticallyCondense() {
  if (!autoCondenseToggle.checked || condensationRunning) return false;

  const transcript = monologueLog.innerText.trim();
  if (!transcript || transcript === lastCondensedTranscript) return false;

  const addedCharacters = lastCondensedTranscript.length > 0 &&
    transcript.startsWith(lastCondensedTranscript)
    ? transcript.length - lastCondensedTranscript.length
    : transcript.length;
  const majorityOfTranscriptChanged =
    addedCharacters >=
    Math.max(1, lastCondensedTranscript.length * AUTO_CONDENSATION_CHANGE_RATIO);
  const condensationTimedOut =
    Date.now() - lastCondensationAt >= AUTO_CONDENSATION_TIMEOUT_MS;

  return majorityOfTranscriptChanged || condensationTimedOut;
}

function checkAutomaticCondensation() {
  if (!shouldAutomaticallyCondense()) return;
  void condenseVoiceLog("automatic");
}

async function restoreSelectedModel() {
  const savedModel = await chrome.storage.local.get(
    VOICE_LOG_MODEL_STORAGE_KEY,
  );
  const model = savedModel[VOICE_LOG_MODEL_STORAGE_KEY];
  if (typeof model !== "string" || !model) return;

  // components.ts populates the select asynchronously. Wait briefly so the
  // saved model can be restored when the Ollama model list is ready.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const matchingOption = Array.from(modelSelect.options).find(
      (option) => option.value === model,
    );
    if (matchingOption) {
      modelSelect.value = model;
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

modelSelect.addEventListener("change", () => {
  chrome.storage.local.set({
    [VOICE_LOG_MODEL_STORAGE_KEY]: modelSelect.value,
  });
});

let recognition: SpeechRecognition;
let usingLocalSpeechRecognition = false;
let recognitionInactivityTimer: ReturnType<typeof setTimeout> | undefined;
let recognitionSessionTimer: ReturnType<typeof setTimeout> | undefined;
let recognitionStopRequested = false;
let recognitionStopReason: string | null = null;

function clearRecognitionTimers() {
  if (recognitionInactivityTimer) clearTimeout(recognitionInactivityTimer);
  if (recognitionSessionTimer) clearTimeout(recognitionSessionTimer);
  recognitionInactivityTimer = undefined;
  recognitionSessionTimer = undefined;
}

function stopRecognition(reason?: string) {
  recognitionStopRequested = true;
  recognitionStopReason = reason || null;
  clearRecognitionTimers();
  recognitionToggle.checked = false;
  if (recognition) {
    try {
      recognition.stop();
    } catch (error) {
      console.warn("Speech recognition was already stopped:", error);
    }
  }
  if (reason) statusText.textContent = reason;
}

function scheduleRecognitionInactivityStop() {
  if (recognitionInactivityTimer) clearTimeout(recognitionInactivityTimer);
  recognitionInactivityTimer = setTimeout(() => {
    if (recognitionToggle.checked && !recognitionStopRequested) {
      stopRecognition("Recognition stopped after 10 minutes without meaningful text.");
    }
  }, RECOGNITION_INACTIVITY_LIMIT_MS);
}

function scheduleRecognitionSessionStop() {
  if (recognitionSessionTimer) clearTimeout(recognitionSessionTimer);
  recognitionSessionTimer = setTimeout(() => {
    if (recognitionToggle.checked && !recognitionStopRequested) {
      stopRecognition("Recognition stopped after the 30-minute session limit.");
    }
  }, RECOGNITION_SESSION_LIMIT_MS);
}

// Content Save
// Initial load:
async function init() {
  const initContentRevision = contentRevision;
  const previousSave = await chrome.storage.local.get([
    "workarea_content_save",
    "condenced_log_save",
    "monologue_log_save",
  ]);
  console.log(previousSave);
  if (initContentRevision === contentRevision) {
    if (typeof previousSave.workarea_content_save === "string") {
      workareaContent.innerText = previousSave.workarea_content_save;
    }
    if (typeof previousSave.monologue_log_save === "string") {
      monologueLog.innerText = previousSave.monologue_log_save;
    }
    if (typeof previousSave.condenced_log_save === "string") {
      condensedLog.innerText = previousSave.condenced_log_save;
    }
  }
  await restoreLogLayout();
  await restoreSelectedModel();
  lastCondensedTranscript = monologueLog.innerText.trim();
  lastCondensationAt = Date.now();
  updateMonologueProgress();
  await updateJapaneseModelStatus();
}
document.body.onload = init;

workareaContent.addEventListener("input", (_ev) => {
  console.log(workareaContent.innerText);

  chrome.storage.local.set({
    workarea_content_save: workareaContent.innerText,
  });
});
monologueLog.addEventListener("input", saveMonologueLog);
monologueLog.addEventListener("input", updateMonologueProgress);
function saveMonologueLog(_ev: any) {
  console.log(monologueLog.innerText);

  chrome.storage.local.set({ monologue_log_save: monologueLog.innerText });
}

condensedLog.addEventListener("input", saveCondensedLog);
function saveCondensedLog(_ev: Event) {
  chrome.storage.local.set({ condenced_log_save: condensedLog.innerText });
}

function clearVoiceLog() {
  const confirmed = window.confirm(
    "Clear the work area, condensed log, and transcript? This also stops live recognition.",
  );
  if (!confirmed) return;

  contentRevision += 1;
  lastCondensedTranscript = "";
  lastCondensationAt = Date.now();
  if (recognitionToggle.checked) {
    stopRecognition("Recognition stopped after clearing the voice log.");
  }

  workareaContent.textContent = "";
  condensedLog.textContent = "";
  monologueLog.textContent = "";
  workareaContent.dispatchEvent(new Event("input", { bubbles: true }));
  condensedLog.dispatchEvent(new Event("input", { bubbles: true }));
  monologueLog.dispatchEvent(new Event("input", { bubbles: true }));
  interimResults.textContent = "…";
  updateMonologueProgress();
  processingStatus.textContent = "Content cleared.";
}

clearLogButton.addEventListener("click", clearVoiceLog);

function startRecognition() {
  const speechRecognition = getSpeechRecognitionConstructor();
  if (!speechRecognition) {
    console.log("Speech recognition not supported in this browser.");
    return false;
  }
  console.log("Speech recognition supported!");

  recognitionStopRequested = false;
  recognitionStopReason = null;
  clearRecognitionTimers();
  scheduleRecognitionInactivityStop();
  scheduleRecognitionSessionStop();

  recognition = new speechRecognition();
  const recognitionContentRevision = contentRevision;
  const localRecognition = recognition as SpeechRecognition & {
    processLocally?: boolean;
  };
  usingLocalSpeechRecognition = "processLocally" in localRecognition;
  if (usingLocalSpeechRecognition) {
    localRecognition.processLocally = true;
  }
  recognition.continuous = true;
  recognition.interimResults = true;
  // recognition.lang = 'en-US'; // Set the language as needed
  recognition.lang = "ja-JP";

  recognition.onstart = function () {
    console.log("Speech recognition started");
    statusText.textContent = usingLocalSpeechRecognition
      ? "Recognition is on (on-device)"
      : "Recognition is on";
  };

  recognition.onresult = function (event) {
    if (recognitionContentRevision !== contentRevision) return;

    // Get the last result from the results list
    const lastResultIndex = event.results.length - 1;
    const lastResult = event.results[lastResultIndex];

    // Check if the result is final
    if (lastResult.isFinal) {
      const transcript = lastResult[0].transcript.trim();
      console.log("Latest Transcript:", transcript);

      if (transcript) {
        scheduleRecognitionInactivityStop();
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
        updateMonologueProgress();
        checkAutomaticCondensation();
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
    if (usingLocalSpeechRecognition && event.error === "language-not-supported") {
      statusText.textContent =
        "On-device recognition is unavailable for this language.";
    }
  };

  recognition.onend = function () {
    console.log("Speech recognition ended");

    statusText.textContent = recognitionStopReason || "Recognition is off";
    recognitionStopReason = null;
    if (recognitionToggle.checked && !recognitionStopRequested) {
      recognition!.start();
    }
  };

  recognition.start();
}

recognitionToggle.addEventListener("change", function () {
  if (recognitionToggle.checked) {
    startRecognition();
    // if (recognition) recognition.start();
  } else {
    stopRecognition();
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
