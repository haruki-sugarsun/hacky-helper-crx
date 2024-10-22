import ollama from 'ollama'
import './sidepanel.css'

// Get fixed elements and setup handlers:
const auto_inspection_checkbox = document.querySelector<HTMLInputElement>('#auto_inspecting')!
const status_line = document.querySelector<HTMLDivElement>('#status_line')!
const language_choice = document.querySelector<HTMLInputElement>('#language')!
const mode_choice = document.querySelector<HTMLInputElement>('#mode')!

console.log(status_line)

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

// https://github.com/ollama/ollama-js
console.log(Math.random())
// ollama.chat({
//   model: 'gemma2:2b',
//   messages: [{ role: 'user', content: 'Why is the sky blue? I am asking for a fantasy explanation.' }],
// }).then((res) => {
//   console.log(res.message.content)
//   document.querySelector<HTMLDivElement>('#response')!.innerText = res.message.content
// }, (reason) => {
//   console.log(reason)
// })
// console.log(Math.random())

// document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
//   <div>
//   AB-C
//   </div>
// `

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

var last_inspection_promise: Promise<void> | null = null
async function inspect_page() {
  const currentTab = await chrome.tabs.query({ active: true, currentWindow: true })
  console.log(currentTab)

  const scriptingResults = await chrome.scripting.executeScript({ target: { tabId: currentTab[0].id!, allFrames: true }, func: getVisibleText })
  // const scriptingResult = await chrome.scripting.executeScript(
  //   { target: { tabId: currentTab[0].id! },
  //   files: [ 'inject.js' ] })

  updateStatus("Inspection starts.")
  console.log(scriptingResults)

  const newVisibleText = scriptingResults.reduce((acc, curr) => { return acc + curr.result }, "")
  console.log(newVisibleText)

  document.querySelector<HTMLDivElement>('#visible_text')!.innerText = newVisibleText
  if (last_inspection_content == newVisibleText) { // TODO: Refactor the entangled crap of auto-inspection logic....
    updateStatus("Visible Text does not change from the last run.")
    return
  }

  const promptPrefixMap = new Map<string, string>()
    promptPrefixMap.set("summary-en", 'Summarize the following text fetched from a web page. Give the answer in English: ')
    promptPrefixMap.set("summary-ja", '以下の文章はウェブページから取得されたものです。日本語で要約してください: ')
    promptPrefixMap.set("writing-en", 'Suggest an improvement for the following text, especially focusing on wording and expression. Note that some UI elements are also included. Give the answer in English: ')
    promptPrefixMap.set("writing-ja", "以下の文章の改善を提案してください。特に表現や言葉遣いに集中してください。また、UI要素も含まれてしまっていることに注意してください。日本語で回答してください: ")

  var prompt_prefix = promptPrefixMap.get((mode_choice.value + "-" + language_choice.value))
  last_inspection_content = newVisibleText
  last_inspection_promise = ollama.chat({
    model: 'gemma2:2b',
    messages: [{ role: 'user', content: prompt_prefix + newVisibleText }],
  }).then((res) => {
    console.log(res.message.content)
    document.querySelector<HTMLDivElement>('#response')!.innerText = res.message.content
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
// Auto-inspection runs if (TODO: Pack these into an state object)
// - Auto-Inspection is enabled (auto_inspection_checkbox)
// - Auto-Inspection run counts does not exceed the limit (auto_inspection_remaining_count)
// - No ongoing request is running (last_inspection_promise)
// - 60sec already passed since the last run (last_inspection_run)
// - Inspected content from the tab changed (last_inspection_content)  TODO: Refactor as this lives in inspect_page() and too comlicated...
var last_inspection_run = 0
var last_inspection_content = ""
var auto_inspection_remaining_count = 100
async function inspection_loop() {
  const enabled = document.querySelector<HTMLInputElement>('#auto_inspecting')!.checked
  console.log("inspection_loop", enabled, auto_inspection_remaining_count, last_inspection_run, last_inspection_promise, getPromiseState(last_inspection_promise!));

  if (!enabled) {
    updateStatus("Auto-Inspection is disabled.");
    return
  } else if (auto_inspection_remaining_count <= 0) {
    updateStatus(" 💤 Auto-Inspection count exceeds the limit.");
    document.querySelector<HTMLInputElement>('#auto_inspecting')!.checked = false
    return
  }
  const last_run_state = await getPromiseState(last_inspection_promise!)
  if (last_run_state.state == "pending") {
    // is still runnning.
    updateStatus(`⏳ The last run is still running. (${JSON.stringify(last_run_state)})`)
    console.log("Skip auto inspection as the last run was too close or is still running.", last_inspection_run, last_inspection_promise)
    return
  }
  const mSecFromLastRun = new Date().getTime() - last_inspection_run
  if (mSecFromLastRun < 60 * 1000) {
    // is still runnning.
    updateStatus(`⏳ Skip auto inspection as the last run was too close (${mSecFromLastRun} msec).`)
    return
  }

  // Can run the inspection:
  last_inspection_run = new Date().getTime()
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

function updateStatus(status_line_str: string) {
  status_line.innerText = status_line_str
  console.log(status_line_str)
}
