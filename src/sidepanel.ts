import LRU from './lru-cache.ts'

import ollama from 'ollama'
import './sidepanel.css'

// Get references to the fixed elements and setup handlers:
const auto_inspection_checkbox = document.querySelector<HTMLInputElement>('#auto_inspecting')!
const status_line = document.querySelector<HTMLDivElement>('#status_line')!
const model_choice = document.querySelector<HTMLInputElement>('#model')!
const language_choice = document.querySelector<HTMLInputElement>('#language')!
const mode_choice = document.querySelector<HTMLInputElement>('#mode')!
const custom_prompt = document.querySelector<HTMLTextAreaElement>('#custom_prompt')!

const auto_update_checkbox = document.querySelector<HTMLInputElement>('#auto_update')!
const auto_tts_checkbox = document.querySelector<HTMLInputElement>('#auto_tts')!

// tabId -> { language: ..., mode: ... }
const choicesMemo = new Map()
const stickyrMemo = { model: model_choice.value }

auto_inspection_checkbox.addEventListener('change', (event) => {
  if (!event || !event.target || !(event.target instanceof HTMLInputElement)) {
    console.log("Unexpected call.", event)
    return
  }
  const input = event.target as HTMLInputElement
  console.log("Auto Inspection:", input.checked);
  if (input.checked) { // Changed to Enable:
    auto_inspection_remaining_count = 100
  }
  // Here, you would add your logic to change content based on the selected language
})
model_choice.addEventListener('change', (_event) => {
  saveChoices()
})
language_choice.addEventListener('change', (_event) => {
  saveChoices()
})
mode_choice.addEventListener('change', (_event) => {
  saveChoices()
})
custom_prompt.addEventListener('input', (_event) => {
  saveChoices()
})
auto_update_checkbox.addEventListener('change', (_event) => {
  // Hide the update button.
  // TODO: Implement

})
document.querySelector<HTMLButtonElement>('#show_pending_btn')!.addEventListener('click', (_event) => {
  if (pendingResponse == undefined) {
    updateStatus("🤔 No pending response?")
  } else {
    updateStatus("✨ Enjoy!")
    showResponse(pendingResponse)
    pendingResponse = undefined;
  }
})

function showResponse(response: string) {
  console.log('showRenponse', response.substr(100), '...')
  document.querySelector<HTMLDivElement>('#response')!.innerText = response;

  // TODO: Auto TTS
  if (auto_tts_checkbox.checked) {
    let utterance = new SpeechSynthesisUtterance(response);
    speechSynthesis.speak(utterance);
  }
}

function saveChoices() {
  console.log('saveChoices')
  chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    const currentTab = tabs[0]
    choicesMemo.set(currentTab.id, { language: language_choice.value, mode: mode_choice.value, custom_prompt: custom_prompt.value })

    // Use local storage
    console.log(stickyrMemo)
    stickyrMemo.model = model_choice.value
    chrome.storage.local.set({ stickyrMemo: stickyrMemo }).then(() => {
      console.log("Value is set");
    });
  })
}
chrome.storage.local.get(["stickyrMemo"]).then((result) => {
  console.log("Value is ", result);
  model_choice.value = result.stickyrMemo.model
})


function restoreChoices(id: number) {
  const memo = choicesMemo.get(id)
  console.log('restoreChoices', choicesMemo, memo)
  if (memo) {
    language_choice.value = memo.language
    mode_choice.value = memo.mode
    custom_prompt.value = memo.custom_prompt
  } else { // to default
    language_choice.value = 'ja'
    mode_choice.value = 'summary'
    custom_prompt.value = ''
  }
}

// Also exntention event handlers:
chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log('onActivated', activeInfo)

  // Check if the side panel is on the same window.
  chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    console.log('onActivated - getting current', tabs)
    const currentTab = tabs[0]
    if (activeInfo.windowId != currentTab.windowId || currentTab.id == undefined) { // None of my business.
      return
    }

    restoreChoices(currentTab.id)
  })
})



// Auto-Inspection State Set:
// Auto-inspection runs if (TODO: Pack these into an state object)
// - Auto-Inspection is enabled (auto_inspection_checkbox)
// - Auto-Inspection run counts does not exceed the limit (auto_inspection_remaining_count)
// - No pendingResponse awaits to show up (pendingResponse)
// - No ongoing request is running (last_inspection_promise)
// - 60sec already passed since the last run (last_inspection_run)
// - Inspected content from the tab changed (last_inspection_content)  TODO: Refactor as this lives in inspect_page() and too comlicated...
var last_inspection_promise: Promise<void> | null = null
var last_inspection_run_timestamp = 0
var last_inspection_content = ""
var auto_inspection_remaining_count = 100
var pendingResponse: string | undefined = undefined // Response awaiting the users action to show.

const inference_cache = new LRU<string>(100);

async function generateStatusLine() {
  var line = ''
  if (last_inspection_run_timestamp > 0 && last_inspection_promise) {
    const dt = (new Date().getTime() - last_inspection_run_timestamp) / 1000
    line += ` Last run ${dt.toFixed(1)}s ago, and is `
    line += (await getPromiseState(last_inspection_promise)).state + '.'
  }
  line += ` Remaining Count: ${auto_inspection_remaining_count}.`
  line += ` Cache Size: ${inference_cache.size()}/${inference_cache.capacity()}`
  return line
}

// Utilities
function reload_page() {
  location.href = 'sidepanel.html'
}

// Consider https://stackoverflow.com/questions/6961022/measure-bounding-box-of-text-node-in-javascript
function getVisibleText() {
  const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
  const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  let visibleText = '';
  var walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
  );
  var node;
  var textNodes = [];
  while (node = walker.nextNode()) {
    const rect = (node.parentNode as Element).getBoundingClientRect();
    console.log(node, rect);
    // Check if element is within the viewport
    if (rect.width > 0 &&
      rect.height > 0 &&
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= viewportHeight &&
      rect.right <= viewportWidth) {
      visibleText += node.textContent!.trim() + ' '; // Extract text and trim whitespace
      textNodes.push(node.parentNode);
    } else {
      console.log("invisible node", node.parentNode)
    }
  }
  console.log(textNodes);
  console.log(visibleText);
  return visibleText;
}

async function inspect_page_EventHandler(this: HTMLButtonElement, _ev: MouseEvent) {
  return inspect_page()
}

async function inspect_page() {
  const currentTab = await chrome.tabs.query({ active: true, currentWindow: true })
  console.log(currentTab)

  updateStatus("🚀 Inspection starts.")
  var newVisibleText = ''
  if (isOwnEditorPage(currentTab[0])) {
    const response = await chrome.runtime.sendMessage({ action: "callFunction" })
    // TODO: Support the case multiple editor pages are open at the same time.
    if (response.status === "success") {
      console.log("Function call successful!");
      newVisibleText = response.visibleText
    } else {
      console.error("Failed to call function.");
      throw new Error("Failed to call Editor by sendMessage")
    }
  } else {
    const scriptingResults = await chrome.scripting.executeScript({ target: { tabId: currentTab[0].id!, allFrames: true }, func: getVisibleText })
    // const scriptingResult = await chrome.scripting.executeScript(
    //   { target: { tabId: currentTab[0].id! },
    //   files: [ 'inject.js' ] })

    console.log(scriptingResults)

    newVisibleText = scriptingResults.reduce((acc, curr) => { return acc + curr.result }, "")
  }
  console.log(newVisibleText)

  document.querySelector<HTMLDivElement>('#visible_text')!.innerText = newVisibleText
  if (last_inspection_content == newVisibleText) { // TODO: Refactor the entangled crap of auto-inspection logic....
    updateStatus("Visible Text does not change from the last run.")
    return
  }

  // TODO: Add prefix to control the language more forcibly.
  const promptPrefixMap = new Map<string, string>() // prefix is determined only by language.
  promptPrefixMap.set('en', 'Answer in English.')
  promptPrefixMap.set('ja', '日本語で回答してください.')

  const promptPostfixMap = new Map<string, string>()
  promptPostfixMap.set("summary-en", 'The above text is from a web page. Give the summary in English.')
  promptPostfixMap.set("summary-ja", '以上の文章はウェブページから取得されました。日本語で要約してください.')
  promptPostfixMap.set("writing-en", 'Suggest an improvement for the above text, especially focusing on wording and expression, and show the revised text. If you see a text "~~~", suggest appropriate context to fill it. Please ignore some UI elements as they are included unintentionally. Give the improved text suggestions in English.')
  promptPostfixMap.set("writing-ja", '以上の文章を改善した後の文章を提示してください。"～～～"という文字列があれば、その部分に当てはまる内容を提案してください。誤字や脱字があれば指摘してください。また、UI要素も含まれてしまっていますが、無視してください。推敲した結果の文を、日本語で回答してください。')
  promptPostfixMap.set("ideation-en", 'Suggest one new idea for the above text to expand on the idea, make it more engaging, impactful or relevant? What new possibilities could be explored? Please ignore some UI elements as they are included unintentionally. Give the answer in English.')
  promptPostfixMap.set("ideation-ja", "以上の文章に対し、新しいアイデアを提示して、より魅力的、インパクトのあるものにする方法を考えてください。追加できる新しい可能性はあるでしょうか？また、UI要素も含まれてしまっていますが、無視してください。日本語で回答してください。")

  const modeStr = mode_choice.value + "-" + language_choice.value
  const promptPrefix = promptPrefixMap.get(language_choice.value)
  const promptPostfix = promptPostfixMap.get(modeStr)
  const wholePrompt = custom_prompt.value + ' ' + promptPrefix + '\n===\n' + newVisibleText + "===\n" + promptPostfix

  // Starting the inference with cache in consideration.
  last_inspection_content = newVisibleText
  // Check if we have a cache.
  const cachedResponse = inference_cache.get(wholePrompt)
  if (cachedResponse) {
    console.log("Using cachedReponse.")
    showResponse(cachedResponse)
    inference_cache.set(wholePrompt, cachedResponse)
    return
  }

  last_inspection_promise = ollama.chat({
    model: model_choice.value,
    messages: [{ role: 'user', content: wholePrompt }],
  }).then((res) => {
    console.log(res.message.content)
    inference_cache.set(wholePrompt, res.message.content)
    // pushConversationLog(prompt, response)
    if (auto_update_checkbox.checked) {
      showResponse(res.message.content)
    } else {
      pendingResponse = res.message.content
    }
  }, (reason) => {
    console.log(reason)
    document.querySelector<HTMLDivElement>('#response')!.innerText = "Got a error: " + JSON.stringify(reason)
  })
  console.log(Math.random())
}



// alert(Math.random())
// setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)
document.querySelector<HTMLButtonElement>('#reload_btn')!.addEventListener('click', reload_page)
document.querySelector<HTMLButtonElement>('#inspect_page')!.addEventListener('click', inspect_page_EventHandler)

// For debugging
declare global {
  interface Window { hacky_helper_inspect_page_EventHandler: any; }
}
window.hacky_helper_inspect_page_EventHandler = inspect_page_EventHandler

/// alert(Math.random())


// Setup an inspecting loop.
async function inspection_loop() {
  const enabled = auto_inspection_checkbox.checked
  console.log("inspection_loop", enabled, auto_inspection_remaining_count, last_inspection_run_timestamp, last_inspection_promise, getPromiseState(last_inspection_promise!));

  if (!enabled) {
    updateStatus("🚫 Auto-Inspection is disabled.");
    return
  } else if (auto_inspection_remaining_count <= 0) {
    updateStatus("💤 Auto-Inspection count exceeds the limit.");
    document.querySelector<HTMLInputElement>('#auto_inspecting')!.checked = false
    return
  }

  if (pendingResponse != undefined) {
    updateStatus('✨ A response is awating. Click "Show Pending" to show it.');
    return
  }
  const last_run_state = await getPromiseState(last_inspection_promise!)
  if (last_run_state.state == "pending") {
    // is still runnning.
    updateStatus(`⏳ Waiting for the last run.`)
    console.log("Skip auto inspection as the last run was too close or is still running.", last_inspection_run_timestamp, last_inspection_promise)
    return
  }
  const mSecFromLastRun = new Date().getTime() - last_inspection_run_timestamp
  if (mSecFromLastRun < 60 * 1000) {
    // is still runnning.
    updateStatus(`😴 Cooling down for ${60 * 1000 - mSecFromLastRun} msec.`)
    return
  }

  // Can run the inspection:
  last_inspection_run_timestamp = new Date().getTime()
  auto_inspection_remaining_count--
  inspect_page()
}
window.setInterval(inspection_loop, 5 * 1000)


// Promise Helpers
// TODO: Move to a dedicated file.
const pending = {
  state: 'pending',
};

function getPromiseState(promise: Promise<any>): Promise<any> {
  // We put `pending` promise after the promise to test, 
  // which forces .race to test `promise` first
  return Promise.race([promise, pending]).then(
    (value) => {
      if (value === pending) {
        return value;
      }
      return {
        state: 'resolved',
        value
      };
    },
    (reason) => ({ state: 'rejected', reason })
  );
}

async function updateStatus(status_line_str: string) {
  status_line.innerText = status_line_str + ' ' + await generateStatusLine()
  console.log(status_line_str)
}

function isOwnEditorPage(currentTab: chrome.tabs.Tab) {
  const extensionUrl = chrome.runtime.getURL('editor.html');
  return currentTab.url === extensionUrl
}
// function pushConversationLog(prompt: (message?: string, _default?: string) => string | null, response: any) {
//   throw new Error('Function not implemented.')
// }
