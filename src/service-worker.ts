import { LLMService, OpenAILLMService, OllamaLLMService } from './llmService';
import { CREATE_SUMMARY, LIST_KEYWORDS, CREATE_EMBEDDINGS } from './llmService';

import './features/tab_organizer.ts'

console.log('service-worker');

function sendMessage(source: MessageEventSource | null, message: any) {
    if (source instanceof MessagePort || source instanceof Client) {
        source.postMessage(message);
    } else {
        console.warn('Source is missing for message:', message);
    }
}

const llmService: LLMService = new OpenAILLMService();

// In-Memory Store for Currently Opened Tabs.
// TODO: Implement the details.
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

    chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
        console.log('Tab removed:', tabId);
        currentTabs = currentTabs.filter(t => t.id !== tabId);
        console.log('Updated currentTabs:', currentTabs);
        // Add your logic here
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        console.log('Tab updated:', tab);
        const index = currentTabs.findIndex(t => t.id === tabId);
        if (index !== -1) {
            currentTabs[index] = tab;
            console.log('Updated currentTabs:', currentTabs);
        }
        // Add your logic here
    });
}

// Initialize Tab Management
initTabManagement();

self.addEventListener('message', async (event) => {
    const { type, payload } = event.data;
    switch (type) {
        case CREATE_SUMMARY:
            const summary = await createSummary(payload.content);
            sendMessage(event.source, { type: 'SUMMARY_RESULT', payload: summary });
            break;
        case LIST_KEYWORDS:
            const keywords = await listKeywords(payload.content);
            sendMessage(event.source, { type: 'KEYWORDS_RESULT', payload: keywords });
            break;
        case CREATE_EMBEDDINGS:
            const embeddings = await createEmbeddings(payload.content);
            sendMessage(event.source, { type: 'EMBEDDINGS_RESULT', payload: embeddings });
            break;
        default:
            console.warn('Unknown LLM task type:', type);
    }
});

// Tab Management Event Listeners
chrome.tabs.onCreated.addListener((tab) => {
    console.log('Tab created:', tab);
    // Add your logic here
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    console.log('Tab removed:', tabId);
    // Add your logic here
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    console.log('Tab updated:', tab);
    // Add your logic here
});
async function createSummary(content: string): Promise<string> {
    return await llmService.createSummary(content);
}

async function listKeywords(content: string): Promise<string[]> {
    return await llmService.listKeywords(content);
}

async function createEmbeddings(content: string): Promise<number[]> {
    return await llmService.createEmbeddings(content);
}