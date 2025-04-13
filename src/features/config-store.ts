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

export class ConfigStore {
  asConfigStoreRO() {
    return {
      // TODO: This might just needs some wrapper functions. and we can remove the each method definitions.
      SORT_ON_TAB_SWITCH: this.SORT_ON_TAB_SWITCH.bind(this),
      OPENAI_API_KEY: this.OPENAI_API_KEY.bind(this),
      OPENAI_API_BASE_URL: this.OPENAI_API_BASE_URL.bind(this),
      USE_OLLAMA: this.USE_OLLAMA.bind(this),
      OLLAMA_API_URL: this.OLLAMA_API_URL.bind(this),
      OLLAMA_MODEL: this.OLLAMA_MODEL.bind(this),
      OLLAMA_EMBEDDINGS_MODEL: this.OLLAMA_EMBEDDINGS_MODEL.bind(this),
      BOOKMARK_PARENT_ID: this.BOOKMARK_PARENT_ID.bind(this),
      BOOKMARK_AUTO_SAVE_IDLE_TIME:
        this.BOOKMARK_AUTO_SAVE_IDLE_TIME.bind(this),
      DISABLE_LLM_ON_BATTERY: this.DISABLE_LLM_ON_BATTERY.bind(this),
      LLM_ENABLED: this.LLM_ENABLED.bind(this),
      INSTANCE_ID: this.INSTANCE_ID.bind(this),
    };
  }
  private config: Record<string, any> = {};

  // TODO: Reorder the instances and getters to group them by features.
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
    "The URL of the OpenAI API endpoint. Defaults to the client library's built-in value if not provided.",
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
    "BOOKMARK_PARENT_ID",
    "Bookmark Parent ID",
    "The parent folder ID where named sessions and bookmarks are stored.",
  );

  // TODO: settings.html misses a config menu for this.
  // TODO: Use this for auto-sync feature.
  static BOOKMARK_AUTO_SAVE_IDLE_TIME = new StringConfig(
    "BOOKMARK_AUTO_SAVE_IDLE_TIME",
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

  private static INSTANCE_ID = new StringConfig(
    "INSTANCE_ID",
    "Instance ID",
    "A unique alphanumerical identifier for this instance. Editable via Settings UI.",
  );

  constructor() {
    // Initialize configurations if needed
  }

  public async INSTANCE_ID(): Promise<string> {
    let id = await ConfigStore.INSTANCE_ID.get();
    if (!id) {
      id = Math.random().toString(36).substring(2, 10);
      ConfigStore.INSTANCE_ID.set(id);
    }
    return id;
  }

  public updateInstanceId(value: string): boolean {
    if (!/^[a-zA-Z0-9]+$/.test(value)) {
      console.error("Invalid instance ID: must be alphanumerical.");
      return false;
    }
    this.set("INSTANCE_ID", value);
    return true;
  }

  public async OPENAI_API_KEY(): Promise<string> {
    return await ConfigStore.OPENAI_API_KEY.get();
  }

  public async SORT_ON_TAB_SWITCH(): Promise<boolean> {
    return await ConfigStore.SORT_ON_TAB_SWITCH.get();
  }

  public async OPENAI_API_BASE_URL(): Promise<string> {
    return await ConfigStore.OPENAI_API_BASE_URL.get();
  }

  public async USE_OLLAMA(): Promise<boolean> {
    return await ConfigStore.USE_OLLAMA.get();
  }

  public async OLLAMA_API_URL(): Promise<string> {
    return await ConfigStore.OLLAMA_API_URL.get();
  }

  public async OLLAMA_MODEL(): Promise<string> {
    return await ConfigStore.OLLAMA_MODEL.get();
  }

  public async OLLAMA_EMBEDDINGS_MODEL(): Promise<string> {
    return await ConfigStore.OLLAMA_EMBEDDINGS_MODEL.get();
  }

  public async BOOKMARK_PARENT_ID(): Promise<string> {
    return await ConfigStore.BOOKMARK_PARENT_ID.get();
  }

  public async BOOKMARK_AUTO_SAVE_IDLE_TIME(): Promise<string> {
    return await ConfigStore.BOOKMARK_AUTO_SAVE_IDLE_TIME.get();
  }

  public async DISABLE_LLM_ON_BATTERY(): Promise<boolean> {
    return await ConfigStore.DISABLE_LLM_ON_BATTERY.get();
  }

  public async LLM_ENABLED(): Promise<boolean> {
    return await ConfigStore.LLM_ENABLED.get();
  }

  // TODO: We would like to make this private.
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

// This is only used by Settings UI or other features that need to set the config.
export const CONFIG_STORE = new ConfigStore();

// Other pages/features should use this interface.
export interface ConfigStoreRO {
  SORT_ON_TAB_SWITCH(): Promise<boolean>;
  OPENAI_API_KEY(): Promise<string>;
  OPENAI_API_BASE_URL(): Promise<string>;
  USE_OLLAMA(): Promise<boolean>;
  OLLAMA_API_URL(): Promise<string>;
  OLLAMA_MODEL(): Promise<string>;
  OLLAMA_EMBEDDINGS_MODEL(): Promise<string>;
  BOOKMARK_PARENT_ID(): Promise<string>;
  BOOKMARK_AUTO_SAVE_IDLE_TIME(): Promise<string>;
  DISABLE_LLM_ON_BATTERY(): Promise<boolean>;
  LLM_ENABLED(): Promise<boolean>;
  INSTANCE_ID(): Promise<string>;
}
export const CONFIG_RO = CONFIG_STORE.asConfigStoreRO();
