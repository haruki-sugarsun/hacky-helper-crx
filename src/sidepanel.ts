import ollama from 'ollama'

// https://github.com/ollama/ollama-js
console.log(Math.random())
document.querySelector<HTMLDivElement>('#response')!.innerText = "..." + Math.random()

ollama.chat({
  model: 'gemma2:27b',
  messages: [{ role: 'user', content: 'Why is the sky blue? I am asking for a fantasy explanation.' }],
}).then((res) => {
  console.log(res.message.content)
  document.querySelector<HTMLDivElement>('#response')!.innerText = res.message.content
}, (reason) => {
  console.log(reason)
})
console.log(Math.random())

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
  AB-C
  </div>
`

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

async function inspect_page(this: HTMLButtonElement, ev: MouseEvent) {
  const currentTab = await chrome.tabs.query({ active: true, currentWindow: true })
  console.log(currentTab)

  const scriptingResult = await chrome.scripting.executeScript({ target: { tabId: currentTab[0].id! }, func: getVisibleText })
  // const scriptingResult = await chrome.scripting.executeScript(
  //   { target: { tabId: currentTab[0].id! },
  //   files: [ 'inject.js' ] })


  console.log(scriptingResult[0].result)
  document.querySelector<HTMLDivElement>('#visible_text')!.innerText = scriptingResult[0].result || ""


  throw new Error("Function not implemented.")
}



// alert(Math.random())
// setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)
document.querySelector<HTMLButtonElement>('#reload_btn')!.addEventListener('click', reload_page)
document.querySelector<HTMLButtonElement>('#inspect_page')!.addEventListener('click', inspect_page)

// alert(Math.random())