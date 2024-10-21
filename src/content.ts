// import 'chrome'
// import src from './image.png'
import './content.css'

const html = `
<div class="crx">
  Edit!
  <img src=${chrome.runtime.getURL("")}>
</div>
`

const doc = new DOMParser().parseFromString(html, 'text/html')
document.body.append(doc.body.firstElementChild!)

function getVisibleText() {
  return nativeTreeWalker()
}

function nativeTreeWalker() {
  const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
  const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  let visibleText = '';
    var walker = document.createTreeWalker(
        document.body, 
        NodeFilter.SHOW_TEXT, 
        null, 
        false
    );
    var node;
    var textNodes = [];
    while(node = walker.nextNode()) {
        const rect = node.parentNode.getBoundingClientRect();
        console.log(node, rect);
        // Check if element is within the viewport
        if (rect.width > 0 &&
            rect.height > 0 &&
            rect.top >= 0 && 
            rect.left >= 0 && 
            rect.bottom <= viewportHeight && 
            rect.right <= viewportWidth) {
          visibleText += node.textContent.trim() + ' '; // Extract text and trim whitespace
          textNodes.push(node.parentNode);
        } else {
            console.log("invisible node", node.parentNode)
        }
    }
    console.log(textNodes);
    console.log(visibleText);
}

const btn = document.createElement("button");
btn.type = "button"
btn.innerHTML="getVisibleText"
console.log(btn)
console.log(Math.random())

btn.onclick = (ev) => { console.log(ev); getVisibleText() }
document.body.append(btn)
