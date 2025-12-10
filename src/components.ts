import { CONFIG_RO } from "./features/config-store";

// Fallback static model list (used if Ollama backend is unreachable)
const FALLBACK_MODELS = [
  "gemma3:1b",
  "gemma3:4b",
  "gemma2:2b",
  "gemma2:latest",
  "gemma2:27b",
  "phi3.5:latest",
  "phi4:latest",
  "llama3.2:latest",
  "amberchat:latest",
  "granite3.1-dense:latest",
  "openthinker:7b",
  "deepseek-r1:32b",
  "deepseek-r1:14b",
  "deepseek-r1:8b",
  "yuiseki/tinyswallow:1.5b",
  "7shi/tanuki-dpo-v1.0:latest",
  "llm-jp-3-1.8b-instruct:latest",
  "llm-jp-3-3.7b-instruct-gguf_Q4_K_M:mod",
];

/**
 * Fetch available Ollama model names from the configured backend.
 * Returns an array of model names. If the request fails, returns the fallback list.
 */
export async function fetchOllamaModels(): Promise<string[]> {
  const baseUrl = await CONFIG_RO.OLLAMA_API_URL();
  const url = `${baseUrl.replace(/\/*$/, "")}/api/tags`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (Array.isArray(data.models)) {
      return data.models.map((m: any) => m.name);
    }
    console.warn("Unexpected Ollama tags response format", data);
    return FALLBACK_MODELS;
  } catch (e) {
    console.warn(
      "Failed to fetch Ollama models, falling back to static list",
      e,
    );
    return FALLBACK_MODELS;
  }
}

export async function component_model(elm: HTMLSelectElement) {
  const models = await fetchOllamaModels();
  // Populate the select element; select the first model by default
  elm.innerHTML = models
    .map(
      (m, i) =>
        `<option value="${m}"${i === 0 ? ' selected="selected"' : ""}>${m}</option>`,
    )
    .join("\n");
}

document.addEventListener("DOMContentLoaded", async function () {
  const select_model = document.querySelector<HTMLSelectElement>(
    '[data-sickhack-component="select_model"]',
  );
  if (select_model) {
    await component_model(select_model);
  }
});
