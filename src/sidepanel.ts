import ollama from 'ollama'

// https://github.com/ollama/ollama-js
console.log(Math.random())
document.querySelector<HTMLDivElement>('#response')!.innerText = "..." + Math.random()

ollama.chat({
  model: 'gemma2:2b',
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

function inspect_page(this: HTMLButtonElement, ev: MouseEvent) {
  throw new Error("Function not implemented.")
}



// alert(Math.random())
// setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)
document.querySelector<HTMLButtonElement>('#reload_btn')!.addEventListener('click', reload_page)
document.querySelector<HTMLButtonElement>('#inspect_page')!.addEventListener('click', inspect_page)

// alert(Math.random())