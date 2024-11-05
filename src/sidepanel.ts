import LRU from './lru-cache.ts'

import ollama from 'ollama'
import './sidepanel.css'

// Get references to the fixed elements and setup handlers:
const auto_inspection_checkbox = document.querySelector<HTMLInputElement>('#auto_inspecting')!
const status_line = document.querySelector<HTMLDivElement>('#status_line')!
const language_choice = document.querySelector<HTMLInputElement>('#language')!
const mode_choice = document.querySelector<HTMLInputElement>('#mode')!

// tabId -> { language: ..., mode: ... }
const choicesMemo = new Map()

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
language_choice.addEventListener('change', (_event) => {
  saveChoices()
})
mode_choice.addEventListener('change', (_event) => {
  saveChoices()
})


function saveChoices() {
  chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    const currentTab = tabs[0]
    choicesMemo.set(currentTab.id, { language: language_choice.value, mode: mode_choice.value })
  })
}

function restoreChoices(id: number) {
  const memo = choicesMemo.get(id)
  console.log('restoreChoices', choicesMemo, memo)
  if (memo) {
    language_choice.value = memo.language
    mode_choice.value = memo.mode
  } else { // to default
    language_choice.value = 'ja'
    mode_choice.value = 'summary'
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
// - No ongoing request is running (last_inspection_promise)
// - 60sec already passed since the last run (last_inspection_run)
// - Inspected content from the tab changed (last_inspection_content)  TODO: Refactor as this lives in inspect_page() and too comlicated...
var last_inspection_promise: Promise<void> | null = null
var last_inspection_run_timestamp = 0
var last_inspection_content = ""
var auto_inspection_remaining_count = 100

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

async function inspect_page_EventHandler(this: HTMLButtonElement, ev: MouseEvent) {
  return inspect_page()
}

async function inspect_page() {
  const currentTab = await chrome.tabs.query({ active: true, currentWindow: true })
  console.log(currentTab)

  const scriptingResults = await chrome.scripting.executeScript({ target: { tabId: currentTab[0].id!, allFrames: true }, func: getVisibleText })
  // const scriptingResult = await chrome.scripting.executeScript(
  //   { target: { tabId: currentTab[0].id! },
  //   files: [ 'inject.js' ] })

  updateStatus("🚀 Inspection starts.")
  console.log(scriptingResults)

  const newVisibleText = scriptingResults.reduce((acc, curr) => { return acc + curr.result }, "")
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
  promptPostfixMap.set("writing-en", 'Suggest an improvement for the above text, especially focusing on wording and expression. Please ignore some UI elements as they are included unintentionally. Give the improved text suggestions in English.')
  promptPostfixMap.set("writing-ja", "以上の文章の改善を提案してください。特に表現や言葉遣いに集中してください。また、UI要素も含まれてしまっていますが、無視してください。推敲した結果の文を、日本語で回答してください。")
  promptPostfixMap.set("ideation-en", 'Suggest one new idea for the above text to expand on the idea, make it more engaging, impactful or relevant? What new possibilities could be explored? Please ignore some UI elements as they are included unintentionally. Give the answer in English.')
  promptPostfixMap.set("ideation-ja", "以上の文章に対し、新しいアイデアを提示して、より魅力的、インパクトのあるものにする方法を考えてください。追加できる新しい可能性はあるでしょうか？また、UI要素も含まれてしまっていますが、無視してください。日本語で回答してください。")

  const modeStr = mode_choice.value + "-" + language_choice.value
  const promptPrefix = promptPrefixMap.get(language_choice.value)
  const promptPostfix = promptPostfixMap.get(modeStr)
  const wholePrompt = promptPrefix + '\n===\n' + newVisibleText + "===\n" + promptPostfix

  // Starting the inference with cache in consideration.
  last_inspection_content = newVisibleText
  // Check if we have a cache.
  const cachedResponse = inference_cache.get(wholePrompt)
  if (cachedResponse) {
    console.log("Using cachedReponse.")
    document.querySelector<HTMLDivElement>('#response')!.innerText = cachedResponse
    inference_cache.set(wholePrompt, cachedResponse)
    return
  }

  last_inspection_promise = ollama.chat({
    model: 'gemma2:2b',
    messages: [{ role: 'user', content: wholePrompt }],
  }).then((res) => {
    console.log(res.message.content)
    document.querySelector<HTMLDivElement>('#response')!.innerText = res.message.content
    inference_cache.set(wholePrompt, res.message.content)
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

// alert(Math.random())


// Setup an inspecting loop.
async function inspection_loop() {
  const enabled = document.querySelector<HTMLInputElement>('#auto_inspecting')!.checked
  console.log("inspection_loop", enabled, auto_inspection_remaining_count, last_inspection_run_timestamp, last_inspection_promise, getPromiseState(last_inspection_promise!));

  if (!enabled) {
    updateStatus("🚫 Auto-Inspection is disabled.");
    return
  } else if (auto_inspection_remaining_count <= 0) {
    updateStatus("💤 Auto-Inspection count exceeds the limit.");
    document.querySelector<HTMLInputElement>('#auto_inspecting')!.checked = false
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
