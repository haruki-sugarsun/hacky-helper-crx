import { setupCounter } from './counter.ts'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
  AB
  </div>
`

function reload_page() {
    location.href='sidepanel.html'
}



// alert(Math.random())
setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)
document.querySelector<HTMLButtonElement>('#reload_btn')!.addEventListener('click', reload_page)
// alert(Math.random())