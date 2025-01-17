function component_model(elm: HTMLSelectElement) {
    console.log(elm)
    elm.innerHTML = `
        <option value="gemma2:2b" selected="selected">gemma2:2b</option>
        <option value="gemma2:latest">gemma2:latest</option>
        <option value="gemma2:27b">gemma2:27b</option>

        <option value="phi3.5:latest">phi3.5:latest</option>
        <option value="phi4:latest">phi4:latest</option>

        <option value="llama3.2:latest">llama3.2:latest</option>
        <option value="amberchat:latest">amberchat:latest</option>

        <option value="7shi/tanuki-dpo-v1.0:latest">7shi/tanuki-dpo-v1.0:latest</option>
        <option value="llm-jp-3-1.8b-instruct:latest">llm-jp-3-1.8b-instruct:latest</option>
        <option value="llm-jp-3-3.7b-instruct-gguf_Q4_K_M:mod">llm-jp-3-3.7b-instruct-gguf_Q4_K_M:mod</option>
    `
}

document.addEventListener('DOMContentLoaded', function() {
    const select_model = document.querySelector<HTMLSelectElement>('[data-sickhack-component="select_model"]');
    if (select_model) {
        component_model(select_model);
    }
  });