export const LOCAL_STORAGE_PREFIX = "hacky_helper_";
export const OPENAI_API_KEY_PLACEHOLDER = "YOUR_OPENAI_API_KEY";
export const OLLAMA_API_URL_DEFAULT = "http://localhost:11434";
export const OLLAMA_MODEL_DEFAULT = "llama2";
export const OLLAMA_EMBEDDINGS_MODEL_DEFAULT = "nomic-embed-text";

// LLM Prompts
export const SUMMARY_PROMPT =
  "Summarize the following content in a single line of exactly 140 characters or less. Return only the summary itself without any additional text or explanation:\n\n";
export const KEYWORDS_PROMPT =
  "Extract 5-10 important keywords from the following content. Return **only** the keywords as a comma-separated list.:\n\n";

// OpenAI API Models
export const OPENAI_CHAT_MODEL = "gpt-3.5-turbo";
export const OPENAI_EMBEDDINGS_MODEL = "text-embedding-ada-002";

// Constants for the messaging interactions between Ext pages:
export const CREATE_SUMMARY = "CREATE_SUMMARY";
export const LIST_KEYWORDS = "LIST_KEYWORDS";
export const CREATE_EMBEDDINGS = "CREATE_EMBEDDINGS";
export const GET_CACHED_SUMMARIES = "GET_CACHED_SUMMARIES";
export const CREATE_NAMED_SESSION = "CREATE_NAMED_SESSION";
export const UPDATE_NAMED_SESSION_TABS = "UPDATE_NAMED_SESSION_TABS";
export const DELETE_NAMED_SESSION = "DELETE_NAMED_SESSION";
export const GET_NAMED_SESSIONS = "GET_NAMED_SESSIONS";

// Tab Categorization Constants
export const CATEGORIZE_TABS = "CATEGORIZE_TABS";
export const SUGGEST_TAB_DESTINATIONS = "SUGGEST_TAB_DESTINATIONS";
export const MIGRATE_TAB = "MIGRATE_TAB";
export const SIMILARITY_THRESHOLD = 0.7; // Default similarity threshold for tab categorization

// Bookmark Storage Constants
export const SAVE_TAB_TO_BOOKMARKS = "SAVE_TAB_TO_BOOKMARKS";
export const GET_SAVED_BOOKMARKS = "GET_SAVED_BOOKMARKS";
export const OPEN_SAVED_BOOKMARK = "OPEN_SAVED_BOOKMARK";
export const SYNC_SESSION_TO_BOOKMARKS = "SYNC_SESSION_TO_BOOKMARKS";
export const GET_SYNCED_OPENTABS = "GET_SYNCED_OPENTABS";
export const GET_CLOSED_NAMED_SESSIONS = "GET_CLOSED_NAMED_SESSIONS";
export const RESTORE_CLOSED_SESSION = "RESTORE_CLOSED_SESSION";
