// src/components.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchOllamaModels } from "./components";

// Mock global fetch
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

describe("fetchOllamaModels", () => {
  it("returns model names from Ollama tags response", async () => {
    const mockResponse = {
      models: [
        { name: "gemma3:1b" },
        { name: "phi4:latest" },
        { name: "llama3.2:latest" },
      ],
    };
    // @ts-ignore
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const models = await fetchOllamaModels();
    expect(models).toEqual(["gemma3:1b", "phi4:latest", "llama3.2:latest"]);
  });

  it("falls back to static list on fetch failure", async () => {
    // @ts-ignore
    global.fetch.mockRejectedValue(new Error("network error"));
    const models = await fetchOllamaModels();
    // The fallback list is defined in components.ts; we check a few known entries
    expect(models).toContain("gemma3:1b");
    expect(models).toContain("phi4:latest");
  });
});
