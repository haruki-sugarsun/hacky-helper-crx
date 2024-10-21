import 'chrome'
// import src from './image.png'
import './content.css'

const html = `
<div class="crx">
  Edit!asd
  <img src=${chrome.runtime.getURL("")}>
</div>
`

const doc = new DOMParser().parseFromString(html, 'text/html')
document.body.append(doc.body.firstElementChild!)

function getVisibleText() {

}

