import { CONFIG_STORE } from "./config_store";
import {
  OLLAMA_API_URL_DEFAULT,
  OLLAMA_MODEL_DEFAULT,
  OLLAMA_EMBEDDINGS_MODEL_DEFAULT,
  SUMMARY_PROMPT,
  KEYWORDS_PROMPT,
  OPENAI_CHAT_MODEL,
  OPENAI_EMBEDDINGS_MODEL,
} from "./lib/constants";
import { Ollama } from "ollama";
import OpenAI from "openai";

// Base class for LLM services
// This base class is useful for:
// 1. Providing common methods used by all LLM services
// 2. Ensuring all services implement the same interface
// 3. Making it easy to add new LLM services in the future
abstract class BaseLLMService implements LLMService {
  // Public methods that implement the LLMService interface
  // These methods handle common logic like timing and error handling
  async chat(prompt: string): Promise<string> {
    const startTime = performance.now();
    try {
      const response = await this.doChat(prompt);
      const endTime = performance.now();
      const duration = endTime - startTime;
      console.log(`Chat Response Time: ${duration.toFixed(2)} ms`);
      return response;
    } catch (error) {
      console.error("Error generating chat response:", error);
      throw new Error("Failed to generate chat response.");
    }
  }

  async createSummary(content: string): Promise<string> {
    const startTime = performance.now();
    try {
      const summary = await this.doCreateSummary(content);
      const endTime = performance.now();
      const duration = endTime - startTime;
      console.log(`Summary Generation Time: ${duration.toFixed(2)} ms`);
      return summary;
    } catch (error) {
      console.error("Error generating summary:", error);
      throw new Error("Failed to generate summary.");
    }
  }

  async listKeywords(content: string): Promise<string[]> {
    const startTime = performance.now();
    try {
      const keywords = await this.doListKeywords(content);
      const endTime = performance.now();
      const duration = endTime - startTime;
      console.log(`Keywords Extraction Time: ${duration.toFixed(2)} ms`);
      return keywords;
    } catch (error) {
      console.error("Error extracting keywords:", error);
      // Return empty array instead of throwing to prevent cascading failures
      return [];
    }
  }

  async generateEmbeddings(content: string): Promise<number[]> {
    const startTime = performance.now();
    try {
      const embeddings = await this.doGenerateEmbeddings(content);
      const endTime = performance.now();
      const duration = endTime - startTime;
      console.log(`Embeddings Generation Time: ${duration.toFixed(2)} ms`);
      return embeddings;
    } catch (error) {
      console.error("Error generating embeddings:", error);
      // Return placeholder embeddings in case of failure to prevent cascading failures
      console.warn("Returning placeholder embeddings due to API error");
      // Default to 1536 dimensions (OpenAI's standard), but allow subclasses to override
      return this.getPlaceholderEmbeddings();
    }
  }

  // Method to get placeholder embeddings, can be overridden by subclasses
  protected getPlaceholderEmbeddings(): number[] {
    // Default to OpenAI's embedding dimensions (1536)
    return Array(1536)
      .fill(0)
      .map(() => Math.random() * 2 - 1);
  }

  // Protected methods that subclasses must implement
  protected abstract doChat(prompt: string): Promise<string>;
  protected abstract doCreateSummary(content: string): Promise<string>;
  protected abstract doListKeywords(content: string): Promise<string[]>;
  protected abstract doGenerateEmbeddings(content: string): Promise<number[]>;

  // Common method to get the summary prompt
  protected getSummaryPrompt(content: string): string {
    return `${SUMMARY_PROMPT}${content}`;
  }

  // Common method to get the keywords prompt
  protected getKeywordsPrompt(content: string): string {
    return `${KEYWORDS_PROMPT}${content}`;
  }
}

export interface LLMService {
  createSummary(content: string): Promise<string>;
  listKeywords(content: string): Promise<string[]>;
  generateEmbeddings(content: string): Promise<number[]>;
  chat(prompt: string): Promise<string>;
}

export class OpenAILLMService extends BaseLLMService {
  private client: OpenAI;
  private model: string;

  constructor(model: string = OPENAI_CHAT_MODEL) {
    super();
    this.model = model;
    this.client = new OpenAI({
      apiKey: "placeholder", // Will be set dynamically in each method
    });

    console.log(`OpenAILLMService initialized with model: ${model}`);
  }

  // Method to update the model
  setModel(model: string): void {
    this.model = model;
    console.log(`OpenAILLMService model updated to: ${model}`);
  }

  protected async doChat(prompt: string): Promise<string> {
    const apiKey = await CONFIG_STORE.get("OPENAI_API_KEY");
    if (!apiKey) {
      console.error("OpenAI API key not set.");
      throw new Error("OpenAI API key not set.");
    }

    // Update the API key dynamically
    this.client.apiKey = apiKey;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const content = response.choices[0].message.content?.trim() || "";
    console.log("OpenAI Chat Response Generated");

    return content;
  }

  protected async doCreateSummary(content: string): Promise<string> {
    const apiKey = await CONFIG_STORE.get("OPENAI_API_KEY");
    if (!apiKey) {
      console.error("OpenAI API key not set.");
      throw new Error("OpenAI API key not set.");
    }

    // Update the API key dynamically
    this.client.apiKey = apiKey;

    const response = await this.client.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that summarizes content.",
        },
        { role: "user", content: this.getSummaryPrompt(content) },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const summary = response.choices[0].message.content?.trim() || "";
    console.log("OpenAI Summary Generated:", summary);

    return summary;
  }

  protected async doListKeywords(content: string): Promise<string[]> {
    const apiKey = await CONFIG_STORE.get("OPENAI_API_KEY");
    if (!apiKey) {
      console.error("OpenAI API key not set.");
      throw new Error("OpenAI API key not set.");
    }

    // Update the API key dynamically
    this.client.apiKey = apiKey;

    const response = await this.client.chat.completions.create({
      model: OPENAI_CHAT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that extracts keywords from content.",
        },
        { role: "user", content: this.getKeywordsPrompt(content) },
      ],
      max_tokens: 100,
      temperature: 0.5,
    });

    const keywordsText = response.choices[0].message.content?.trim() || "";

    // Split the response by commas and trim whitespace
    const keywords = keywordsText
      .split(",")
      .map((keyword: string) => keyword.trim())
      .filter(Boolean);
    console.log("OpenAI Keywords Extracted:", keywords.join(", "));

    return keywords;
  }

  protected async doGenerateEmbeddings(content: string): Promise<number[]> {
    const apiKey = await CONFIG_STORE.get("OPENAI_API_KEY");
    if (!apiKey) {
      console.error("OpenAI API key not set.");
      throw new Error("OpenAI API key not set.");
    }

    // Update the API key dynamically
    this.client.apiKey = apiKey;

    const response = await this.client.embeddings.create({
      model: OPENAI_EMBEDDINGS_MODEL,
      input: content,
    });

    const embeddings = response.data[0].embedding;
    console.log(
      "OpenAI Embeddings Generated:",
      embeddings.length,
      "dimensions",
    );

    return embeddings;
  }
}

export class OllamaLLMService extends BaseLLMService {
  private model: string;
  private embeddingsModel: string;
  private client: Ollama;

  constructor(
    baseUrl: string = OLLAMA_API_URL_DEFAULT,
    model: string = OLLAMA_MODEL_DEFAULT,
    embeddingsModel: string = OLLAMA_EMBEDDINGS_MODEL_DEFAULT,
  ) {
    super(); // Call the parent class constructor

    this.model = model;
    this.embeddingsModel = embeddingsModel;

    // Create a custom Ollama client instance with the specified base URL
    this.client = new Ollama({
      host: baseUrl,
    });

    console.log(
      `OllamaLLMService initialized with model: ${model}, baseUrl: ${baseUrl}`,
    );
  }

  // Method to update the model
  setModel(model: string): void {
    this.model = model;
    console.log(`OllamaLLMService model updated to: ${model}`);
  }

  protected async doChat(prompt: string): Promise<string> {
    const response = await this.client.chat({
      model: this.model,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.message.content.trim();
    console.log("Ollama Chat Response Generated");

    return content;
  }

  protected async doCreateSummary(content: string): Promise<string> {
    const response = await this.client.generate({
      model: this.model,
      prompt: this.getSummaryPrompt(content),
      stream: false,
    });

    const summary = response.response.trim();
    console.log("Ollama Summary Generated:", summary);

    return summary;
  }

  protected async doListKeywords(content: string): Promise<string[]> {
    const response = await this.client.generate({
      model: this.model,
      prompt: this.getKeywordsPrompt(content),
      stream: false,
    });

    // Split the response by commas and trim whitespace
    const keywords = response.response
      .split(",")
      .map((keyword: string) => keyword.trim())
      .filter(Boolean);
    console.log("Ollama Keywords Extracted:", keywords.join(", "));

    return keywords;
  }

  protected async doGenerateEmbeddings(content: string): Promise<number[]> {
    // Use a dedicated embeddings model for better quality embeddings
    const response = await this.client.embeddings({
      model: this.embeddingsModel,
      prompt: content,
    });

    const embeddings = response.embedding;
    console.log(
      "Ollama Embeddings Generated:",
      embeddings.length,
      "dimensions",
    );

    return embeddings;
  }

  // Override to provide Ollama-specific placeholder embeddings
  protected getPlaceholderEmbeddings(): number[] {
    // Ollama embeddings typically have 384 dimensions
    return Array(384)
      .fill(0)
      .map(() => Math.random() * 2 - 1);
  }
}
