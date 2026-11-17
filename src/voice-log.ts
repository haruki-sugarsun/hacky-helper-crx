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
const japaneseRecognitionToggle = document.querySelector<HTMLInputElement>(
  "#recognition-ja",
)!;
const englishRecognitionToggle = document.querySelector<HTMLInputElement>(
  "#recognition-en",
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
const ENGLISH_SPEECH_LANGUAGE = "en-US";
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
    const [japaneseResult, englishResult] = await Promise.allSettled(
      [JAPANESE_SPEECH_LANGUAGE, ENGLISH_SPEECH_LANGUAGE].map((language) =>
        speechRecognition.available!({
          langs: [language],
          processLocally: true,
        }),
      ),
    );
    const results = [japaneseResult, englishResult];
    const downloadableLanguages = results.flatMap((result, index) =>
      result.status === "fulfilled" && result.value === "downloadable"
        ? [[JAPANESE_SPEECH_LANGUAGE, ENGLISH_SPEECH_LANGUAGE][index]]
        : [],
    );
    const allModelsAvailable = results.every(
      (result) => result.status === "fulfilled" && result.value === "available",
    );
    const modelDownloading = results.some(
      (result) => result.status === "fulfilled" && result.value === "downloading",
    );
    installJapaneseModelButton.disabled = downloadableLanguages.length === 0;
    installJapaneseModelButton.textContent =
      downloadableLanguages.length === 2
        ? "Install missing models"
        : downloadableLanguages.length === 1
          ? `Install ${downloadableLanguages[0] === JAPANESE_SPEECH_LANGUAGE ? "Japanese" : "English"} model`
          : allModelsAvailable
            ? "Speech models installed"
            : modelDownloading
              ? "Model downloading…"
              : "Models unavailable";

    const describeAvailability = (
      language: string,
      result: PromiseSettledResult<LocalSpeechRecognitionStatus>,
    ) => {
      if (result.status === "rejected") return `${language} status could not be checked`;
      switch (result.value) {
        case "available":
          return `${language} model installed`;
        case "downloadable":
          return `${language} model download required`;
        case "downloading":
          return `${language} model downloading`;
        default:
          return `${language} on-device recognition unavailable`;
      }
    };
    localModelStatus.textContent = [
      describeAvailability("Japanese", japaneseResult),
      describeAvailability("English", englishResult),
    ].join("; ") + ".";
  } catch (error) {
    console.error("Failed to check Japanese speech model availability:", error);
    installJapaneseModelButton.disabled = true;
    localModelStatus.textContent = "Could not check the Japanese model.";
  }
}

async function installJapaneseSpeechModel() {
  const speechRecognition = getSpeechRecognitionConstructor();
  if (!speechRecognition?.available || !speechRecognition.install) return;

  installJapaneseModelButton.disabled = true;
  installJapaneseModelButton.textContent = "Checking models…";

  try {
    const languages = [JAPANESE_SPEECH_LANGUAGE, ENGLISH_SPEECH_LANGUAGE];
    const availability = await Promise.allSettled(
      languages.map((language) =>
        speechRecognition.available!({ langs: [language], processLocally: true }),
      ),
    );
    const missingLanguages = languages.filter(
      (_language, index) =>
        availability[index].status === "fulfilled" &&
        availability[index].value === "downloadable",
    );

    if (missingLanguages.length === 0) {
      await updateJapaneseModelStatus();
      return;
    }

    installJapaneseModelButton.textContent = "Installing…";
    localModelStatus.textContent = `Downloading ${missingLanguages
      .map((language) => language === JAPANESE_SPEECH_LANGUAGE ? "Japanese" : "English")
      .join(" and ")} model${missingLanguages.length > 1 ? "s" : ""}…`;
    await Promise.allSettled(
      missingLanguages.map((language) =>
        speechRecognition.install!({ langs: [language], processLocally: true }),
      ),
    );
    await updateJapaneseModelStatus();
  } catch (error) {
    console.error("Failed to install on-device speech models:", error);
    await updateJapaneseModelStatus();
    localModelStatus.textContent += " Installation attempt failed.";
  }
}

installJapaneseModelButton.addEventListener(
  "click",
  installJapaneseSpeechModel,
);

let condensationRunning = false;
let lastCondensedTranscript = "";
let lastCondensedWorkarea = "";
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
    lastCondensedWorkarea = workarea;
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
  const workarea = workareaContent.innerText.trim();
  const transcriptChanged = transcript !== lastCondensedTranscript;
  const workareaChanged = workarea !== lastCondensedWorkarea;
  if (!transcriptChanged && !workareaChanged) return false;

  const addedCharacters = lastCondensedTranscript.length > 0 &&
    transcript.startsWith(lastCondensedTranscript)
    ? transcript.length - lastCondensedTranscript.length
    : transcript.length;
  const transcriptChangeIsSignificant = transcriptChanged &&
    addedCharacters >=
    Math.max(1, lastCondensedTranscript.length * AUTO_CONDENSATION_CHANGE_RATIO);
  const changedWorkareaCharacters = getChangedCharacterCount(
    lastCondensedWorkarea,
    workarea,
  );
  const workareaChangeIsSignificant = workareaChanged &&
    changedWorkareaCharacters >=
      Math.max(1, lastCondensedWorkarea.length * AUTO_CONDENSATION_CHANGE_RATIO);
  const condensationTimedOut =
    Date.now() - lastCondensationAt >= AUTO_CONDENSATION_TIMEOUT_MS;

  return transcriptChangeIsSignificant || workareaChangeIsSignificant ||
    condensationTimedOut;
}

function getChangedCharacterCount(previous: string, current: string) {
  const commonLength = Math.min(previous.length, current.length);
  let prefixLength = 0;
  while (
    prefixLength < commonLength &&
    previous[prefixLength] === current[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < previous.length - prefixLength &&
    suffixLength < current.length - prefixLength &&
    previous[previous.length - suffixLength - 1] ===
      current[current.length - suffixLength - 1]
  ) {
    suffixLength += 1;
  }

  return (previous.length - prefixLength - suffixLength) +
    (current.length - prefixLength - suffixLength);
}

function checkAutomaticCondensation() {
  if (!shouldAutomaticallyCondense()) return;
  void condenseVoiceLog("automatic");
}

window.setInterval(checkAutomaticCondensation, 1_000);

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

let recognitions: SpeechRecognition[] = [];
let usingLocalSpeechRecognition = false;
let recognitionInactivityTimer: ReturnType<typeof setTimeout> | undefined;
let recognitionSessionTimer: ReturnType<typeof setTimeout> | undefined;
let recognitionStopRequested = false;
let recognitionStopReason: string | null = null;
let recognitionRunId = 0;
let pendingLanguageRestart:
  | { runId: number; pending: Set<SpeechRecognition> }
  | undefined;

function clearRecognitionTimers() {
  if (recognitionInactivityTimer) clearTimeout(recognitionInactivityTimer);
  if (recognitionSessionTimer) clearTimeout(recognitionSessionTimer);
  recognitionInactivityTimer = undefined;
  recognitionSessionTimer = undefined;
}

function stopRecognition(reason?: string) {
  recognitionRunId += 1;
  pendingLanguageRestart = undefined;
  recognitionStopRequested = true;
  recognitionStopReason = reason || null;
  clearRecognitionTimers();
  recognitionToggle.checked = false;
  japaneseRecognitionToggle.disabled = false;
  englishRecognitionToggle.disabled = false;
  for (const activeRecognition of recognitions) {
    try {
      activeRecognition.stop();
    } catch (error) {
      console.warn("Speech recognition was already stopped:", error);
    }
  }
  statusText.textContent = reason || "Recognition is off";
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
  lastCondensedWorkarea = workareaContent.innerText.trim();
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
  checkAutomaticCondensation();
});
monologueLog.addEventListener("input", saveMonologueLog);
monologueLog.addEventListener("input", updateMonologueProgress);
monologueLog.addEventListener("input", checkAutomaticCondensation);
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
  lastCondensedWorkarea = "";
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
  const runId = ++recognitionRunId;
  pendingLanguageRestart = undefined;
  const speechRecognition = getSpeechRecognitionConstructor();
  if (!speechRecognition) {
    console.log("Speech recognition not supported in this browser.");
    recognitionToggle.checked = false;
    statusText.textContent = "Speech recognition is not supported in this browser.";
    return false;
  }
  console.log("Speech recognition supported!");

  recognitionStopRequested = false;
  recognitionStopReason = null;
  clearRecognitionTimers();

  const languages = [
    ...(japaneseRecognitionToggle.checked ? ["ja-JP"] : []),
    ...(englishRecognitionToggle.checked ? ["en-US"] : []),
  ];
  if (languages.length === 0) {
    stopRecognition("Select at least one recognition language.");
    return false;
  }

  scheduleRecognitionInactivityStop();
  scheduleRecognitionSessionStop();

  recognitions = languages.map(() => new speechRecognition());
  const recognitionContentRevision = contentRevision;
  usingLocalSpeechRecognition = recognitions.some((activeRecognition) =>
    "processLocally" in activeRecognition,
  );

  const handleRecognitionResult = (
    event: SpeechRecognitionEvent,
    language: string,
  ) => {
    if (runId !== recognitionRunId || recognitionContentRevision !== contentRevision) return;

    // Get the last result from the results list
    const lastResultIndex = event.results.length - 1;
    const lastResult = event.results[lastResultIndex];

    // Check if the result is final
    if (lastResult.isFinal) {
      const transcript = lastResult[0].transcript.trim();
      console.log(`Latest Transcript (${language}):`, transcript);

      if (transcript) {
        scheduleRecognitionInactivityStop();
        // Append the new transcript with a <br> for a new line
        monologueLog.innerHTML += `[${language}] ${transcript}<br> // `;

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
      console.log(`Interim Transcript (${language}):`, transcript);

      interimResults.textContent = `[${language}] ${transcript}`;
    }
  };

  recognitions.forEach((activeRecognition, index) => {
    if (recognitionStopRequested) return;
    const localRecognition = activeRecognition as SpeechRecognition & {
      processLocally?: boolean;
    };
    if ("processLocally" in localRecognition) {
      localRecognition.processLocally = true;
    }
    activeRecognition.continuous = true;
    activeRecognition.interimResults = true;
    activeRecognition.lang = languages[index];

    activeRecognition.onstart = function () {
      console.log(`Speech recognition started (${languages[index]})`);
      statusText.textContent = usingLocalSpeechRecognition
        ? "Recognition is on (on-device)"
        : "Recognition is on";
    };

    activeRecognition.onresult = (event) =>
      handleRecognitionResult(event, languages[index]);

    activeRecognition.onerror = function (event) {
      console.error(`Speech recognition error (${languages[index]}):`, event.error);
      if (
        runId === recognitionRunId &&
        usingLocalSpeechRecognition &&
        event.error === "language-not-supported"
      ) {
        alert(`On-device recognition is unavailable for ${languages[index]}.`);
        statusText.textContent =
          `On-device recognition is unavailable for ${languages[index]}.`;
      }
    };

    activeRecognition.onend = function () {
      console.log(`Speech recognition ended (${languages[index]})`);
      if (runId !== recognitionRunId) {
        const restart = pendingLanguageRestart;
        if (
          restart?.runId === recognitionRunId &&
          restart.pending.delete(activeRecognition) &&
          restart.pending.size === 0
        ) {
          pendingLanguageRestart = undefined;
          if (recognitionToggle.checked) startRecognition();
        }
        return;
      }
      if (recognitionToggle.checked && !recognitionStopRequested) {
        activeRecognition.start();
      } else {
        statusText.textContent = recognitionStopReason || "Recognition is off";
        recognitionStopReason = null;
      }
    };

    try {
      activeRecognition.start();
    } catch (error) {
      console.warn(`Could not start ${languages[index]} recognition:`, error);
      if (index === 0) {
        stopRecognition(`Could not start ${languages[index]} recognition.`);
      }
    }
  });
}

function restartRecognitionForLanguageChange() {
  if (!recognitionToggle.checked) return;

  if (pendingLanguageRestart) {
    pendingLanguageRestart.runId = ++recognitionRunId;
    return;
  }

  const previousRecognitions = recognitions;
  recognitionRunId += 1;
  recognitionStopRequested = true;
  recognitions = [];

  if (previousRecognitions.length === 0) {
    startRecognition();
    return;
  }

  const restart = {
    runId: recognitionRunId,
    pending: new Set(previousRecognitions),
  };
  pendingLanguageRestart = restart;
  for (const activeRecognition of previousRecognitions) {
    try {
      activeRecognition.stop();
    } catch (error) {
      console.warn("Speech recognition was already stopped:", error);
      restart.pending.delete(activeRecognition);
    }
  }

  if (restart.pending.size === 0) {
    pendingLanguageRestart = undefined;
    startRecognition();
  }
}

japaneseRecognitionToggle.addEventListener(
  "change",
  restartRecognitionForLanguageChange,
);
englishRecognitionToggle.addEventListener(
  "change",
  restartRecognitionForLanguageChange,
);

recognitionToggle.addEventListener("change", function () {
  if (recognitionToggle.checked) {
    startRecognition();
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
