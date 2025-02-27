export const LOCAL_STORAGE_PREFIX = 'hacky_helper_';
export const OPENAI_API_KEY_PLACEHOLDER = 'YOUR_OPENAI_API_KEY';
export const OLLAMA_API_URL_DEFAULT = 'http://localhost:11434';
export const OLLAMA_MODEL_DEFAULT = 'llama2';

// LLM Prompts
export const SUMMARY_PROMPT = 'Summarize the following content in a single line of exactly 140 characters or less. Return only the summary itself without any additional text or explanation:\n\n';

// Constants for the messaging interactions between Ext pages:
export const CREATE_SUMMARY = 'CREATE_SUMMARY';
export const LIST_KEYWORDS = 'LIST_KEYWORDS';
export const CREATE_EMBEDDINGS = 'CREATE_EMBEDDINGS';
export const GET_CACHED_SUMMARIES = 'GET_CACHED_SUMMARIES';
