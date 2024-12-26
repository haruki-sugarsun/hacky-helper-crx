import './style.css'
import './editor.css'

// Consider https://github.com/Ionaru/easy-markdown-editor
// 

// Page Elements
const editorContent = document.querySelector<HTMLDivElement>('#editor_content')!
// Initial load:
const previousSave = await chrome.storage.local.get('editor_content_save')
console.log(previousSave)
if (previousSave.editor_content_save) {
  editorContent.innerText = previousSave.editor_content_save

}

editorContent.addEventListener('input', (_ev) => {
  console.log(editorContent.innerText)

  chrome.storage.local.set({ 'editor_content_save': editorContent.innerText })
})

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "callFunction") {
    // Call the desired function here
    console.log("Function called from side panel!", sender);

    const text = getVisibleText()
    sendResponse({ status: "success", visibleText: text });
  }
});

// function myFunction(sender: chrome.runtime.MessageSender) {
//   console.log("Function called from side panel!", sender);
//   // Your function logic here
// }

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
    const range = document.createRange();
    range.selectNodeContents(node);
    const rect = range.getBoundingClientRect();

    // const rect = (node.parentNode as Element).getBoundingClientRect();
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


