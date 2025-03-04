import { LLMService, OpenAILLMService, OllamaLLMService } from './llmService';
import {
    CREATE_SUMMARY, LIST_KEYWORDS, CREATE_EMBEDDINGS, GET_CACHED_SUMMARIES,
    OLLAMA_API_URL_DEFAULT, OLLAMA_MODEL_DEFAULT, OLLAMA_EMBEDDINGS_MODEL_DEFAULT
} from './lib/constants';
import { CONFIG_STORE } from './config_store';
import { DigestEntry, TabSummary } from './lib/types';
import { PersistentCache } from './persistent-cache';
import { getPromiseState } from './lib/helpers.ts'; // Import the function

import './features/tab_organizer.ts'

// Entrypoint logging:
console.log('service-worker.ts', new Date());

// Information for the queued LLM-related tasks:
// enum LLMTaskType {
//     CREATE_SUMMARY,
//     GET_CACHED_SUMMARIES,
//     LIST_KEYWORDS,
//     CREATE_EMBEDDINGS
// }

// Constants for cache configuration
const SUMMARY_CACHE_SIZE = 5; // Store the latest 5 summaries per tab+URL

// Cache for storing summaries
// Cache to store the latest N summary results for each tabID and URL combination
// The key is a combination of tabID and URL, and the value is an array of summary results with timestamps
const digestCache = new PersistentCache<DigestEntry[]>('tab_digest', 100); // Caches up to 100 unique tab+URL entries
// TODO: Consider removing tabID from the caching key, as only URL might be sufficient?
// TODO: If we have a summary cache here, we might not need the caching layer in llmService?
// TODO: Implement a cache for embeddings as well.
// URL to embeddings cache map.
// const embeddings = {};



// Initialize LLM service based on configuration
// TODO: Reload the service-worker on config changes.
let llmService: LLMService;

async function initializeLLMService() {
    const useOllama = await CONFIG_STORE.get('USE_OLLAMA'); // TODO: use the read-only config.
    if (useOllama) {
        const ollamaApiUrl = await CONFIG_STORE.get('OLLAMA_API_URL') || OLLAMA_API_URL_DEFAULT;
        const ollamaModel = await CONFIG_STORE.get('OLLAMA_MODEL') || OLLAMA_MODEL_DEFAULT;
        const ollamaEmbeddingsModel = await CONFIG_STORE.get('OLLAMA_EMBEDDINGS_MODEL') || OLLAMA_EMBEDDINGS_MODEL_DEFAULT;
        console.log(`Using Ollama LLM service with model ${ollamaModel} and embeddings model ${ollamaEmbeddingsModel} at ${ollamaApiUrl}`);
        llmService = new OllamaLLMService(ollamaApiUrl, ollamaModel, ollamaEmbeddingsModel);
    } else {
        console.log('Using OpenAI LLM service');
        llmService = new OpenAILLMService();
        // TODO: Use a OpenAI API Key config.
    }
}

// Initialize LLM service
initializeLLMService().catch((error) => {
    console.error('Failed to initialize LLM service:', error);
    // Fallback to OpenAI
    // TODO: Implement a "simple" LLM Service which just do some string operation as the final fallback.
    llmService = new OpenAILLMService();
});

// TODO: Clean-up and organize the init functions.
// We use https://developer.chrome.com/docs/extensions/reference/api/runtime?hl=ja#event-onInstalled
// These events might not work in dev-mode, as we install the scripts via loader, not directly.
self.addEventListener('install', () => console.log('service-worker installed'));
self.addEventListener('activate', () => console.log('service-worker activated'));

// In-Memory Store for Currently Opened Tabs.
// TODO: Implement the details.
// Page State
// var _windowIds: (number | undefined)[] = [];
// Track current tabs and their states
let currentTabs: chrome.tabs.Tab[] = [];

async function initializeTabManagement() {
    currentTabs = await chrome.tabs.query({});
    console.log('Initial tabs:', currentTabs);

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

        // TODO: Clear the pending tasks in the llmTasks.
        console.log('Updated currentTabs:', currentTabs);
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
                    // Queue a task to generate and cache the summary
                    maybeQueueTaskForProcessing(tab.url, content, tab.title || '')
                    // TODO: Implement in the queueTaskForProcessing();
                    console.log(`Queued to generate and cache summary for tab ${tabId} at ${tab.url}`);
                }
            } catch (error) {
                console.error(`Error generating summary for tab ${tabId}:`, error);
            }
        }
    });
}

// Initialize Tab Management
// TODO: Catch error and log or workaround.
initializeTabManagement();

// Queue of the background LLM related tasks:
// TODO: Implement the limit for the llmTasks count.
let llmTasks: {
    content: string; url: string; title: string; timestamp: number;
    resolve: (summary: string, keywords: string[], embeddings: number[]) => void
}[] = [];
let runningLlmTask: Promise<void> | undefined = undefined;

async function maybeQueueTaskForProcessing(url: string, content: string, title: string = '') {
    try {
        // Check if we already have similar tasks (typically with the same URL),
        // and update such task instead of pushing a new one at the end. The intention is
        const existingTask = llmTasks.find(task => task.url === url);
        if (existingTask) {
            existingTask.content = content;
            existingTask.title = title;
            return;
        }

        // If the cache already has digests newer than the specified time, e.g. 1 hour.
        const oneHourAgo = new Date().getTime() - (60 * 60 * 1000);
        const cachedDigests = await getCachedSummaries(url); // Assume this function retrieves cached digests
        if (cachedDigests && cachedDigests.some(digest => digest.timestamp > oneHourAgo)) {
            console.log('Skipping task as recent cache exists.');
            // TODO: We may also consider re-generationg digests if we have some spare resource e.g. no pending tasks
            return;
        }

        llmTasks.push({
            url: url, content: content, title: title, timestamp: new Date().getTime(),
            resolve: function (summary: string, keywords: string[], embeddings: number[]) {
                // Log the parameters
                console.log("Resolved Summary:", summary);
                console.log("Resolved Keywords:", keywords.join(', '));
                console.log("Resolved Embeddings:", embeddings);

                // TODO: Consider if we should cache them here or in the createSummary/getEmbeddings().
                // Implement the logic to handle the resolved data
                // For example, you can store it in a cache or send it back to the content script
            }
        });
    } finally {
        processNextTask(); // Start processing immediately if no task is currently being processed
    }
}

// Setup a periodic call of processNextTask every 1 minute
chrome.alarms.create('processTasksAlarm', {
    periodInMinutes: 1
});

// Listen for the alarm and process tasks
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'processTasksAlarm') {
        console.log('Periodic task processing triggered', new Date());
        processNextTask();
    }
});
async function processNextTask() {
    // Check the llmTasks if we have anything to execute:
    console.log(`Number of tasks in the queue: ${llmTasks.length}`);
    if (llmTasks.length == 0 || runningLlmTask && ((await getPromiseState(runningLlmTask)).state == "pending")) {
        // Nothing to do.
        return;
    }

    try {
        const task = llmTasks.shift()!;
        const { url, timestamp, title, content, resolve } = task;

        // TODO: Refactor to breakdown the generation requests into multi-tasks.
        runningLlmTask = new Promise<void>(async (resolveTask, rejectTask) => {
            try {
                let embeddings = await generateEmbeddings(content);
                let keywords = await generateKeywords(content);
                let summary = await generateSummary(content, url, title);

                resolve(summary, keywords, embeddings);

                const digestEntry: DigestEntry = {
                    summary, keywords, embeddings, timestamp
                };
                updateCache(url, digestEntry);
                resolveTask();
            } catch (error) {
                console.error('Error during LLM task:', error);
                rejectTask(error);
            } finally {
                runningLlmTask = undefined;
            }
        });
    } catch (error) {
        console.error('Error processing task:', error);
    }
}

// Handle incoming messages from content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const { type, payload } = message;
    // Return true to indicate we will send a response asynchronously
    const handleAsync = async () => {
        try {
            switch (type) {
                case CREATE_SUMMARY: // TODO: Consider if we really need this or not.
                    const summary = await generateSummary(
                        payload.content,
                        payload.url,
                        payload.title || ''
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
                    if (payload.tabUrls && Array.isArray(payload.tabUrls)) {
                        // Process each tab and get its summaries
                        const tabSummariesPromises = payload.tabUrls.map(async (url: string) => {
                            const cachedSummaries = await getCachedSummaries(url);
                            return {
                                url: url,
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
                        const cachedSummaries = await getCachedSummaries(payload.url);
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
                    const keywords = await generateKeywords(payload.content);
                    sendResponse({ type: 'KEYWORDS_RESULT', payload: keywords });
                    break;
                case CREATE_EMBEDDINGS:
                    const embeddings = await generateEmbeddings(payload.content);
                    sendResponse({ type: 'EMBEDDINGS_RESULT', payload: embeddings });
                    break;
                default:
                    console.warn('Unknown LLM task type:', type);
                    if (message.action === "callFunction") {
                        // This is for editor.html, which has own handling logic.
                        // TODO: implement proper targetting logic.
                    } else {
                        sendResponse({ type: 'ERROR', payload: 'Unknown LLM task type' });
                    }
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
 * Retrieves the visible text content from a specific browser tab based on its ID.
 * @param tabId The unique identifier of the browser tab from which content is to be extracted.
 * @returns A promise that resolves with the tab's content as a string, or null if retrieval fails.
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
 * @returns The generated summary
 */
async function generateSummary(content: string, url: string, title: string): Promise<string> {
    // Include URL and title in the summary generation process
    const context = `URL: ${url}, Title: ${title}`;
    const summary = await llmService.createSummary(content + '\n' + context);
    return summary;
}

/**
 * Retrieves the cached summaries for a specific tab and URL
 * TODO: Return all the info from this; keywords and embeddings
 * @param tabId The ID of the tab
 * @param url The URL of the page
 * @returns An array of cached summary entries, or null if none exist
 */
async function getCachedSummaries(url: string): Promise<DigestEntry[] | null> {
    const cacheKey = url;
    const cachedEntries = await digestCache.get(cacheKey);

    if (cachedEntries && cachedEntries.length > 0) {
        // TODO: We only need the latest?
        return cachedEntries;
    }
    return null;
}

// Functions for keyword extraction and embeddings
async function generateKeywords(text: string): Promise<string[]> {
    try {
        const keywords = await llmService.listKeywords(text);
        console.log('Extracted Keywords:', keywords.join(', '));
        return keywords;
    } catch (error) {
        throw new Error('Keyword extraction failed');
    }
}

async function generateEmbeddings(text: string): Promise<number[]> {
    try {
        const embeddings = await llmService.generateEmbeddings(text);
        console.log('Embeddings Created:', embeddings.length, 'dimensionality');
        return embeddings;
    } catch (error) {
        throw new Error('Embedding creation failed');
    }
}


async function updateCache(url: string, digestEntry: DigestEntry) {
    const existingEntries = (await digestCache.get(url)) || [];
    existingEntries.unshift(digestEntry);

    if (existingEntries.length > SUMMARY_CACHE_SIZE) {
        existingEntries.length = SUMMARY_CACHE_SIZE;
    }

    await digestCache.set(url, existingEntries);
    console.log(`Cached summary for ${url}. Cache now has ${existingEntries.length} entries.`);
}
// TODO: Implement syncing with
// in-Memory Model and the background store.
// Sessions (groups of tabs/URLs)

// Bookmark folder as a Storage
// TODO: Implement properly.
// TODO: Implement properly.
