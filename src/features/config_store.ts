const LOCAL_STORAGE_PREFIX = "hacky_helper_";

// Class representing configurable values.
export class Config {
  key: string;
  description: string;
  longDescription: string;

  constructor(key: string, description: string, longDescription: string) {
    this.key = key;
    this.description = description;
    this.longDescription = longDescription;
  }

  get() {
    throw new Error("Method implemented in subclasses.");
  }

  set(_value: any) {
    throw new Error("Method implemented in subclasses.");
  }
}

export class BoolConfig extends Config {
  constructor(key: string, description: string, longDescription: string) {
    super(key, description, longDescription);
  }

  async get() {
    const value = await CONFIG_STORE.get(this.key);
    if (typeof value === "boolean") {
      return value;
    } else {
      console.warn(
        `Expected boolean for key ${this.key}, but got ${typeof value}`,
      );
      return false;
    }
  }

  set(value: boolean) {
    try {
      CONFIG_STORE.set(this.key, value);
      return true;
    } catch (error) {
      console.error("Failed to set value:", error);
      return false;
    }
  }
}

export class StringConfig extends Config {
  constructor(key: string, description: string, longDescription: string) {
    super(key, description, longDescription);
  }

  async get() {
    const value = await CONFIG_STORE.get(this.key);
    if (typeof value === "string") {
      return value;
    } else {
      console.warn(
        `Expected string for key ${this.key}, but got ${typeof value}`,
      );
      return "";
    }
  }

  set(value: string) {
    try {
      CONFIG_STORE.set(this.key, value);
      return true;
    } catch (error) {
      console.error("Failed to set value:", error);
      return false;
    }
  }
}

export class ConfigStore implements ConfigStoreRO {
  asConfigStoreRO() {
    return this;
  }
  private config: Record<string, any> = {};

  static SORT_ON_TAB_SWITCH = new BoolConfig(
    "SORT_ON_TAB_SWITCH",
    "Reorder Tabs on the end-to-start circular tab switch.",
    "When enabled, switching from the right-most tab to the left-most tab (circular tab switching) will automatically reorder the tabs",
  );

  static OPENAI_API_KEY = new StringConfig(
    "OPENAI_API_KEY",
    "OpenAI API Key",
    "The API key used to authenticate requests to the OpenAI service for tab summarization.",
  );

  // TODO: Consider improving the wording.
  static OPENAI_API_BASE_URL = new StringConfig(
    "OPENAI_API_BASE_URL",
    "OpenAI API Base URL",
    "The URL of the OpenAI API endpoint (default to OpenAI client lib default).",
  );

  static USE_OLLAMA = new BoolConfig(
    "USE_OLLAMA",
    "Use Ollama for LLM services",
    "When enabled, the extension will use a local Ollama instance instead of OpenAI for LLM services.",
  );

  static OLLAMA_API_URL = new StringConfig(
    "OLLAMA_API_URL",
    "Ollama API URL",
    "The URL of the Ollama API endpoint (default: http://localhost:11434).",
  );

  static OLLAMA_MODEL = new StringConfig(
    "OLLAMA_MODEL",
    "Ollama Model",
    "The name of the Ollama model to use (e.g., llama2, mistral, etc.).",
  );

  static OLLAMA_EMBEDDINGS_MODEL = new StringConfig(
    "OLLAMA_EMBEDDINGS_MODEL",
    "Ollama Embeddings Model",
    "The name of the Ollama model to use for generating embeddings (e.g., nomic-embed-text).",
  );

  static BOOKMARK_PARENT_ID = new StringConfig(
    "bookmarkParentId",
    "Bookmark Parent ID",
    "The parent folder ID where named sessions and bookmarks are stored.",
  );

  // TODO: settings.html misses a config menu for this.
  static BOOKMARK_AUTO_SAVE_IDLE_TIME = new StringConfig(
    "bookmarkAutoSaveIdleTime",
    "Auto-save Idle Time (minutes)",
    "The idle time in minutes after which named sessions will be automatically saved to bookmarks.",
  );

  static DISABLE_LLM_ON_BATTERY = new BoolConfig(
    "DISABLE_LLM_ON_BATTERY",
    "Disable LLM on Battery",
    "When enabled, LLM services will be automatically disabled when the device is running on battery power.",
  );

  static LLM_ENABLED = new BoolConfig(
    "LLM_ENABLED",
    "Enable LLM Services",
    "When enabled, LLM services will be available for content processing. When disabled, no LLM processing will occur.",
  );

  constructor() {
    // Initialize configurations if needed
  }
  async OPENAI_API_KEY(): Promise<string> {
    return await ConfigStore.OPENAI_API_KEY.get();
  }

  set(key: string, value: any) {
    this.config[key] = value;

    // Check if chrome.storage is available (in extension context)
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      chrome.storage.local.set(
        { [LOCAL_STORAGE_PREFIX + key]: JSON.stringify(value) },
        () => {
          if (chrome.runtime.lastError) {
            console.error("Failed to set value:", chrome.runtime.lastError);
          }
        },
      );
    } else {
      // Fallback to localStorage in browser context
      try {
        localStorage.setItem(LOCAL_STORAGE_PREFIX + key, JSON.stringify(value));
      } catch (error) {
        console.error("Failed to set value in localStorage:", error);
      }
    }
  }

  async get(key: string) {
    // If we already have the value in memory, return it
    if (this.config[key] !== undefined) {
      return this.config[key];
    }

    // Try to get from storage
    try {
      // Check if chrome.storage is available (in extension context)
      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.local
      ) {
        let res = await chrome.storage.local.get(LOCAL_STORAGE_PREFIX + key);
        console.log(res);
        if (
          Object.keys(res).length > 0 &&
          res[LOCAL_STORAGE_PREFIX + key] !== undefined
        ) {
          this.config[key] = JSON.parse(res[LOCAL_STORAGE_PREFIX + key]);
        }
      } else {
        // Fallback to localStorage in browser context
        const item = localStorage.getItem(LOCAL_STORAGE_PREFIX + key);
        if (item) {
          this.config[key] = JSON.parse(item);
        }
      }
    } catch (error) {
      console.error("Failed to get value from storage:", error);
    }

    return this.config[key];
  }
}

// This is only used by settings UI.
export const CONFIG_STORE = new ConfigStore();

// Other pages/features should use this interface.
export interface ConfigStoreRO {
  OPENAI_API_KEY(): Promise<string>;
}
export const CONFIG_RO = CONFIG_STORE.asConfigStoreRO();

interface ConfigRO {
  bookmarkParentId: string;
  bookmarkAutoSaveIdleTime: string;
  OPENAI_API_KEY: string;
  USE_OLLAMA: boolean;
  OLLAMA_API_URL: string;
  OLLAMA_MODEL: string;
  OLLAMA_EMBEDDINGS_MODEL: string;
  DISABLE_LLM_ON_BATTERY: boolean;
  LLM_ENABLED: boolean;
}
/**
 * Retrieves all configuration settings.
 * @returns An object containing all configuration settings.
 */
export async function getConfig(): Promise<ConfigRO> {
  // TODO: Make the field names consistent.
  const bookmarkParentId = await CONFIG_STORE.get("bookmarkParentId");
  const bookmarkAutoSaveIdleTime = await CONFIG_STORE.get(
    "bookmarkAutoSaveIdleTime",
  );
  const openaiApiKey = await CONFIG_STORE.get("OPENAI_API_KEY");
  const useOllama = await CONFIG_STORE.get("USE_OLLAMA");
  const ollamaApiUrl = await CONFIG_STORE.get("OLLAMA_API_URL");
  const ollamaModel = await CONFIG_STORE.get("OLLAMA_MODEL");
  const ollamaEmbeddingsModel = await CONFIG_STORE.get(
    "OLLAMA_EMBEDDINGS_MODEL",
  );
  const disableLlmOnBattery = await CONFIG_STORE.get("DISABLE_LLM_ON_BATTERY");
  const llmEnabled = await CONFIG_STORE.get("LLM_ENABLED");

  return {
    bookmarkParentId,
    bookmarkAutoSaveIdleTime: bookmarkAutoSaveIdleTime || "5",
    OPENAI_API_KEY: openaiApiKey,
    USE_OLLAMA: useOllama || false,
    OLLAMA_API_URL: ollamaApiUrl || "http://localhost:11434",
    OLLAMA_MODEL: ollamaModel || "llama2",
    OLLAMA_EMBEDDINGS_MODEL: ollamaEmbeddingsModel || "nomic-embed-text",
    DISABLE_LLM_ON_BATTERY: disableLlmOnBattery || false,
    LLM_ENABLED: llmEnabled !== false, // Default to true if not set
  };
}
