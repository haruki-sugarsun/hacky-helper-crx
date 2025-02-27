import { LLMService, OpenAILLMService, OllamaLLMService } from './llmService';
import { CREATE_SUMMARY, LIST_KEYWORDS, CREATE_EMBEDDINGS, GET_CACHED_SUMMARIES, OLLAMA_API_URL_DEFAULT, OLLAMA_MODEL_DEFAULT } from './lib/constants';
import { CONFIG_STORE } from './config_store';
import { SummaryEntry, TabInfo, TabSummary } from './lib/types';
import { PersistentCache } from './persistent-cache';

import './features/tab_organizer.ts'

console.log('service-worker');

// Cache to store the latest N summary results for each tabID and URL combination
// The key is a combination of tabID and URL, and the value is an array of summary results with timestamps

const SUMMARY_CACHE_SIZE = 5; // Store the latest 5 summaries per tab+URL
const summaryCache = new PersistentCache<SummaryEntry[]>('tab_summaries', 100); // Cache for up to 100 different tab+URL combinations
// TODO: If we have a summary cache here, we don't need the caching layer in llmService?


// This function is no longer needed as we'll use sendResponse directly

// Initialize LLM service based on configuration
// TODO: Reload the service-worker on config changes.
let llmService: LLMService;

async function initLLMService() {
    const useOllama = await CONFIG_STORE.get('USE_OLLAMA'); // TODO: use the read-only config.
    
    if (useOllama) {
        const ollamaApiUrl = await CONFIG_STORE.get('OLLAMA_API_URL') || OLLAMA_API_URL_DEFAULT;
        const ollamaModel = await CONFIG_STORE.get('OLLAMA_MODEL') || OLLAMA_MODEL_DEFAULT;
        console.log(`Using Ollama LLM service with model ${ollamaModel} at ${ollamaApiUrl}`);
        llmService = new OllamaLLMService(ollamaApiUrl, ollamaModel);
    } else {
        console.log('Using OpenAI LLM service');
        llmService = new OpenAILLMService();
    }
}

// Initialize LLM service
initLLMService().catch(error => {
    console.error('Failed to initialize LLM service:', error);
    // Fallback to OpenAI
    // TODO: Implement a "simple" LLM Service which just do some string operation as the final fallback.
    llmService = new OpenAILLMService();
});

// In-Memory Store for Currently Opened Tabs.
// TODO: Implement the details.
// Page State
// var _windowIds: (number | undefined)[] = [];
let currentTabs: chrome.tabs.Tab[] = [];

async function initTabManagement() {
    // Initialize the currentTabs array with existing tabs
    currentTabs = await chrome.tabs.query({});
    console.log('Initialized currentTabs:', currentTabs);

    // Event Listeners for Tab Management
    chrome.tabs.onCreated.addListener((tab) => {
        console.log('Tab created:', tab);
        currentTabs.push(tab);
        console.log('Updated currentTabs:', currentTabs);
        // Add your logic here
    });

    chrome.tabs.onRemoved.addListener((tabId, _removeInfo) => {
        console.log('Tab removed:', tabId);
        currentTabs = currentTabs.filter(t => t.id !== tabId);
        console.log('Updated currentTabs:', currentTabs);
        // Add your logic here
    });

    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
        console.log('Tab updated:', tab);
        const index = currentTabs.findIndex(t => t.id === tabId);
        if (index !== -1) {
            currentTabs[index] = tab;
            console.log('Updated currentTabs:', currentTabs);
        }
        
        // Generate and cache summary when a tab's content is updated
        if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
            try {
                // Get the tab's content
                const content = await getTabContent(tabId);
                if (content) {
                    // Generate and cache the summary
                    await createSummary(content, tabId, tab.url);
                    console.log(`Generated and cached summary for tab ${tabId} at ${tab.url}`);
                }
            } catch (error) {
                console.error(`Error generating summary for tab ${tabId}:`, error);
            }
        }
    });
}

// Initialize Tab Management
initTabManagement();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const { type, payload } = message;
    
    // Return true to indicate we will send a response asynchronously
    const handleAsync = async () => {
        try {
            switch (type) {
                case CREATE_SUMMARY:
                    const summary = await createSummary(
                        payload.content, 
                        payload.tabId, 
                        payload.url
                    );
                    sendResponse({ 
                        type: 'SUMMARY_RESULT', 
                        payload: {
                            summary,
                            tabId: payload.tabId,
                            url: payload.url
                        }
                    });
                    break;
                case GET_CACHED_SUMMARIES:
                    // Handle the new format with multiple tabs
                    if (payload.tabs && Array.isArray(payload.tabs)) {
                        // Process each tab and get its summaries
                        const tabSummariesPromises = payload.tabs.map(async (tab: TabInfo) => {
                            const cachedSummaries = await getCachedSummaries(tab.tabId, tab.url);
                            return {
                                tabId: tab.tabId,
                                url: tab.url,
                                summaries: cachedSummaries || []
                            };
                        });
                        
                        const tabSummaries: TabSummary[] = await Promise.all(tabSummariesPromises);
                        
                        sendResponse({
                            type: 'CACHED_SUMMARIES_RESULT',
                            payload: {
                                tabSummaries
                            }
                        });
                    } else {
                        // TODO: We don't need this backword compatibility, as it's a chrome extension.
                        // Fallback for backward compatibility
                        const cachedSummaries = await getCachedSummaries(payload.tabId, payload.url);
                        sendResponse({
                            type: 'CACHED_SUMMARIES_RESULT',
                            payload: {
                                summaries: cachedSummaries || [],
                                tabId: payload.tabId,
                                url: payload.url
                            }
                        });
                    }
                    break;
                case LIST_KEYWORDS:
                    const keywords = await listKeywords(payload.content);
                    sendResponse({ type: 'KEYWORDS_RESULT', payload: keywords });
                    break;
                case CREATE_EMBEDDINGS:
                    const embeddings = await createEmbeddings(payload.content);
                    sendResponse({ type: 'EMBEDDINGS_RESULT', payload: embeddings });
                    break;
                default:
                    console.warn('Unknown LLM task type:', type);
                    sendResponse({ type: 'ERROR', payload: 'Unknown LLM task type' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ 
                type: 'ERROR', 
                payload: error instanceof Error ? error.message : String(error) 
            });
        }
    };
    
    handleAsync();
    return true; // Indicates we'll respond asynchronously
});

/**
 * Creates a summary of the provided content and caches it for the given tabId and URL
 * @param content The content to summarize
 * @param tabId The ID of the tab where the content is from
 * @param url The URL of the page where the content is from
 * @returns The generated summary
 */
/**
 * Gets the content of a tab
 * @param tabId The ID of the tab
 * @returns The content of the tab, or null if it couldn't be retrieved
 */
async function getTabContent(tabId: number): Promise<string | null> {
    try {
        // Execute a script in the tab to get its content
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => document.body.innerText
        });
        
        if (results && results[0] && results[0].result) {
            return results[0].result;
        }
        return null;
    } catch (error) {
        console.error(`Error getting content for tab ${tabId}:`, error);
        return null;
    }
}

/**
 * Creates a summary of the provided content and caches it for the given tabId and URL
 * @param content The content to summarize
 * @param tabId The ID of the tab where the content is from
 * @param url The URL of the page where the content is from
 * @returns The generated summary
 */
async function createSummary(content: string, tabId?: number, url?: string): Promise<string> {
    // Generate a cache key if tabId and url are provided
    const cacheKey = tabId && url ? `${tabId}:${url}` : null;
    
    // Generate the summary
    const summary = await llmService.createSummary(content);
    
    // If we have a valid cache key, store the summary in the cache
    if (cacheKey) {
        // Get existing summaries for this tab+URL combination or create a new entry
        const existingEntries = await summaryCache.get(cacheKey) || [];
        
        // Create a new summary entry with the current timestamp
        const newEntry: SummaryEntry = {
            text: summary,
            timestamp: Date.now()
        };
        
        // Add the new summary to the beginning of the array (most recent first)
        existingEntries.unshift(newEntry);
        
        // Keep only the latest N summaries
        if (existingEntries.length > SUMMARY_CACHE_SIZE) {
            existingEntries.length = SUMMARY_CACHE_SIZE;
        }
        
        // Store the updated entries in the cache
        await summaryCache.set(cacheKey, existingEntries);
        
        const cacheSize = await summaryCache.size();
        console.log(`Cached summary for ${cacheKey}. Cache now has ${cacheSize} entries.`);
    }
    
    return summary;
}

/**
 * Retrieves the cached summaries for a specific tab and URL
 * @param tabId The ID of the tab
 * @param url The URL of the page
 * @returns An array of cached summary entries, or null if none exist
 */
async function getCachedSummaries(tabId: number, url: string): Promise<SummaryEntry[] | null> {
    const cacheKey = `${tabId}:${url}`;
    const cachedEntries = await summaryCache.get(cacheKey);
    
    if (cachedEntries && cachedEntries.length > 0) {
        return cachedEntries;
    }
    
    return null;
}

async function listKeywords(content: string): Promise<string[]> {
    return await llmService.listKeywords(content);
}

async function createEmbeddings(content: string): Promise<number[]> {
    return await llmService.createEmbeddings(content);
}
