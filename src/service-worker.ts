import { LLMService, OpenAILLMService, OllamaLLMService } from "./llmService";

import {
  CREATE_SUMMARY,
  LIST_KEYWORDS,
  CREATE_EMBEDDINGS,
  GET_CACHED_SUMMARIES,
  CREATE_NAMED_SESSION,
  UPDATE_NAMED_SESSION_TABS,
  DELETE_NAMED_SESSION,
  OLLAMA_API_URL_DEFAULT,
  OLLAMA_MODEL_DEFAULT,
  OLLAMA_EMBEDDINGS_MODEL_DEFAULT,
  GET_NAMED_SESSIONS,
  CATEGORIZE_TABS,
  SUGGEST_TAB_DESTINATIONS,
  MIGRATE_TAB,
  SIMILARITY_THRESHOLD,
  SAVE_TAB_TO_BOOKMARKS,
  GET_SAVED_BOOKMARKS,
  OPEN_SAVED_BOOKMARK,
  SYNC_SESSION_TO_BOOKMARKS,
  GET_SYNCED_BOOKMARKS,
  GET_CLOSED_NAMED_SESSIONS,
  RESTORE_CLOSED_SESSION,
} from "./lib/constants";

import { CONFIG_STORE, getConfig } from "./config_store";
import { DigestEntry, TabSummary } from "./lib/types";
import { getPromiseState } from "./lib/helpers.ts"; // Import the function

import "./features/tab_organizer.ts";
import * as SessionManagement from "./features/session_management";
import * as TabCategorization from "./features/tab_categorization";
import * as DigestManagement from "./features/digest_management";
import { bookmarkStorage } from "./features/bookmark_storage";
import { openTabsPage } from "./features/tabs_helpers";

// Entrypoint logging:
console.log("service-worker.ts", new Date());

// Listen for keyboard commands
chrome.commands.onCommand.addListener((command) => {
  if (command === "open-tabs-page") {
    console.log("Command received: open-tabs-page");
    openTabsPage();
  }
});

// Information for the queued LLM-related tasks:
// enum LLMTaskType {
//     CREATE_SUMMARY,
//     GET_CACHED_SUMMARIES,
//     LIST_KEYWORDS,
//     CREATE_EMBEDDINGS
// }

// Digest management has been moved to features/digest_management.ts
// TODO: If we have a summary cache here, we might not need the caching layer in llmService?
// TODO: Implement a cache for embeddings as well.
// URL to embeddings cache map.
// const embeddings = {};

// Initialize LLM service based on configuration
// TODO: Reload the service-worker on config changes.
let llmService: LLMService;

async function initializeLLMService() {
  const useOllama = await CONFIG_STORE.get("USE_OLLAMA"); // TODO: use the read-only config.
  if (useOllama) {
    const ollamaApiUrl =
      (await CONFIG_STORE.get("OLLAMA_API_URL")) || OLLAMA_API_URL_DEFAULT;
    const ollamaModel =
      (await CONFIG_STORE.get("OLLAMA_MODEL")) || OLLAMA_MODEL_DEFAULT;
    const ollamaEmbeddingsModel =
      (await CONFIG_STORE.get("OLLAMA_EMBEDDINGS_MODEL")) ||
      OLLAMA_EMBEDDINGS_MODEL_DEFAULT;
    console.log(
      `Using Ollama LLM service with model ${ollamaModel} and embeddings model ${ollamaEmbeddingsModel} at ${ollamaApiUrl}`,
    );
    llmService = new OllamaLLMService(
      ollamaApiUrl,
      ollamaModel,
      ollamaEmbeddingsModel,
    );
  } else {
    console.log("Using OpenAI LLM service");
    llmService = new OpenAILLMService();
    // TODO: Use a OpenAI API Key config.
  }
}

// Initialize LLM service
initializeLLMService().catch((error) => {
  console.error("Failed to initialize LLM service:", error);
  // Fallback to OpenAI
  // TODO: Implement a "simple" LLM Service which just do some string operation as the final fallback.
  llmService = new OpenAILLMService();
});

// TODO: Clean-up and organize the init functions.
// We use https://developer.chrome.com/docs/extensions/reference/api/runtime?hl=ja#event-onInstalled
// These events might not work in dev-mode, as we install the scripts via loader, not directly.
self.addEventListener("install", () => console.log("service-worker installed"));
self.addEventListener("activate", () =>
  console.log("service-worker activated"),
);

// In-Memory Store for Currently Opened Tabs.
// TODO: Implement the details.
// Page State
// var _windowIds: (number | undefined)[] = [];
// Track current tabs and their states
let currentTabs: chrome.tabs.Tab[] = [];

async function initializeTabManagement() {
  currentTabs = await chrome.tabs.query({});
  console.log("Initial tabs:", currentTabs);

  // Event Listeners for Tab Management
  chrome.tabs.onCreated.addListener((tab) => {
    console.log("Tab created:", tab);
    currentTabs.push(tab);
    console.log("Updated currentTabs:", currentTabs);
    // Add your logic here
    // TODO: Implement sessions sync based on the events. or we may just rely on querying by tabs API.
  });

  chrome.tabs.onRemoved.addListener((tabId, _removeInfo) => {
    console.log("Tab removed:", tabId);
    currentTabs = currentTabs.filter((t) => t.id !== tabId);

    // TODO: Clear the pending tasks in the llmTasks.
    console.log("Updated currentTabs:", currentTabs);
  });

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    console.log("Tab updated:", tab);
    const index = currentTabs.findIndex((t) => t.id === tabId);
    if (index !== -1) {
      currentTabs[index] = tab;
      console.log("Updated currentTabs:", currentTabs);
    }

    // Generate and cache summary when a tab's content is updated
    if (
      changeInfo.status === "complete" &&
      tab.url &&
      !tab.url.startsWith("chrome://")
    ) {
      try {
        // Get the tab's content
        const content = await getTabContent(tabId);
        if (content) {
          // Queue a task to generate and cache the summary
          maybeQueueTaskForProcessing(tab.url, content, tab.title || "");
          console.log(
            `Queued to generate and cache summary for tab ${tabId} at ${tab.url}`,
          );
        }
      } catch (error) {
        console.error(`Error generating summary for tab ${tabId}:`, error);
      }
    }
  });

  // Listen to tab activation
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const activeTab = await chrome.tabs.get(activeInfo.tabId);
    console.log("Tab Activated:", activeTab);

    // Conditions for task enqueue: empty task queue or no digest computed
    const canEnqueue =
      llmTasks.length === 0 || !(await getCachedSummaries(activeTab.url || ""));

    if (canEnqueue && activeTab.url && !activeTab.url.startsWith("chrome://")) {
      try {
        const content = await getTabContent(activeInfo.tabId);
        if (content) {
          maybeQueueTaskForProcessing(
            activeTab.url,
            content,
            activeTab.title || "",
          );
          console.log(
            `Queued to generate and cache summary for active tab ${activeInfo.tabId} at ${activeTab.url}`,
          );
        }
      } catch (error) {
        console.error(
          `Error generating summary for active tab ${activeInfo.tabId}:`,
          error,
        );
      }
    }
  });
}

// Initialize Tab Management
// TODO: Catch error and log or workaround.
initializeTabManagement();

// Queue of the background LLM related tasks:
// TODO: Implement the limit for the llmTasks count.
const LLM_TASK_QUEUE_MAX_LENGTH = 10; // or any appropriate value
let llmTasks: {
  content: string;
  url: string;
  title: string;
  timestamp: number;
  resolve: (summary: string, keywords: string[], embeddings: number[]) => void;
}[] = [];
let runningLlmTask: Promise<void> | undefined = undefined;

async function maybeQueueTaskForProcessing(
  url: string,
  content: string,
  title: string = "",
) {
  try {
    // Check if LLM services are enabled
    const llmEnabled = await CONFIG_STORE.get("LLM_ENABLED");
    if (llmEnabled === false) {
      console.log("Skipping task as LLM services are disabled.");
      // TODO: We can also clear the pending llmTasks.
      return;
    }

    // Check if we already have similar tasks (typically with the same URL),
    // and update such task instead of pushing a new one at the end. The intention is
    const existingTask = llmTasks.find((task) => task.url === url);
    if (existingTask) {
      existingTask.content = content;
      existingTask.title = title;
      return;
    }

    // If the cache already has digests newer than the specified time, e.g. 1 hour.
    const oneHourAgo = new Date().getTime() - 60 * 60 * 1000;
    const cachedDigests = await DigestManagement.getCachedSummaries(url); // Assume this function retrieves cached digests
    if (
      cachedDigests &&
      cachedDigests.some((digest) => digest.timestamp > oneHourAgo)
    ) {
      console.log("Skipping task as recent cache exists.");
      // TODO: We may also consider re-generationg digests if we have some spare resource e.g. no pending tasks
      return;
    }

    if (llmTasks.length >= LLM_TASK_QUEUE_MAX_LENGTH) {
      console.log(`Skipping task as we already have ${llmTasks.length} tasks.`);
      // TODO: We may also consider re-generationg digests if we have some spare resource e.g. no pending tasks
      return;
    }

    // TODO: Consider splitting the tasks into 3 dedicated tasks for each.
    llmTasks.push({
      url: url,
      content: content,
      title: title,
      timestamp: new Date().getTime(),
      resolve: function (
        summary: string,
        keywords: string[],
        embeddings: number[],
      ) {
        // Log the parameters
        console.log("Resolved Summary:", summary);
        console.log("Resolved Keywords:", keywords.join(", "));
        console.log("Resolved Embeddings:", embeddings);

        // TODO: Consider if we should cache them here or in the createSummary/getEmbeddings().
        // Implement the logic to handle the resolved data
        // For example, you can store it in a cache or send it back to the content script
      },
    });
  } finally {
    processNextTask(); // Start processing immediately if no task is currently being processed
  }
}

// Setup a periodic call of processNextTask every 1 minute
chrome.alarms.create("processTasksAlarm", {
  periodInMinutes: 1,
});

// Listen for the alarm and process tasks
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "processTasksAlarm") {
    console.log("Periodic task processing triggered", new Date());
    processNextTask();
  }
});
async function processNextTask() {
  // TODO: Check if we enable the LLM service via LLM_ENABLED config. and clear the queue if disabled.

  // Check the llmTasks if we have anything to execute:
  console.log(`Number of tasks in the queue: ${llmTasks.length}`);
  if (
    llmTasks.length == 0 ||
    (runningLlmTask &&
      (await getPromiseState(runningLlmTask)).state == "pending")
  ) {
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
          summary,
          keywords,
          embeddings,
          timestamp,
        };
        updateCache(url, digestEntry);
        resolveTask();
      } catch (error) {
        console.error("Error during LLM task:", error);
        rejectTask(error);
      } finally {
        runningLlmTask = undefined;
      }
    });
  } catch (error) {
    console.error("Error processing task:", error);
  }
}

// Handle incoming messages from content scripts
// TODO: Define an abstraction layer to define message `type`, `params`, `results` in more organized way.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { type, payload } = message;
  // Return true to indicate we will send a response asynchronously
  const handleAsync = async () => {
    // TODO: Consider organize the switch-case and try-catch structures for readability.
    try {
      switch (type) {
        case CREATE_SUMMARY: // TODO: Consider if we really need this or not.
          const summary = await generateSummary(
            payload.content,
            payload.url,
            payload.title || "",
          );
          sendResponse({
            type: "SUMMARY_RESULT",
            payload: {
              summary,
              tabId: payload.tabId,
              url: payload.url,
            },
          });
          break;
        case GET_CACHED_SUMMARIES:
          // Handle the new format with multiple tabs
          if (payload.tabUrls && Array.isArray(payload.tabUrls)) {
            // Process each tab and get its summaries
            const tabSummariesPromises = payload.tabUrls.map(
              async (url: string) => {
                const cachedSummaries = await getCachedSummaries(url);
                return {
                  url: url,
                  summaries: cachedSummaries || [],
                };
              },
            );

            const tabSummaries: TabSummary[] =
              await Promise.all(tabSummariesPromises);

            sendResponse({
              type: "CACHED_SUMMARIES_RESULT",
              payload: {
                tabSummaries,
              },
            });
          } else {
            // TODO: We don't need this backword compatibility, as it's a chrome extension.
            // Fallback for backward compatibility
            const cachedSummaries = await getCachedSummaries(payload.url);
            sendResponse({
              type: "CACHED_SUMMARIES_RESULT",
              payload: {
                summaries: cachedSummaries || [],
                tabId: payload.tabId,
                url: payload.url,
              },
            });
          }
          break;
        case LIST_KEYWORDS:
          const keywords = await generateKeywords(payload.content);
          sendResponse({ type: "KEYWORDS_RESULT", payload: keywords });
          break;
        case CREATE_EMBEDDINGS:
          const embeddings = await generateEmbeddings(payload.content);
          sendResponse({ type: "EMBEDDINGS_RESULT", payload: embeddings });
          break;
        case CREATE_NAMED_SESSION:
          try {
            const { windowId, sessionName } = payload;
            const session = await SessionManagement.createNamedSession(
              windowId,
              sessionName,
            );
            sendResponse({
              type: "CREATE_NAMED_SESSION_RESULT",
              payload: session,
            });
          } catch (error) {
            console.error("Error creating named session:", error);
            sendResponse({
              type: "ERROR",
              payload: error instanceof Error ? error.message : String(error),
            });
          }
          break;
        case UPDATE_NAMED_SESSION_TABS:
          try {
            const { sessionId, windowId } = payload;
            const success = await SessionManagement.updateNamedSessionTabs(
              sessionId,
              windowId,
            );
            sendResponse({
              type: "UPDATE_NAMED_SESSION_TABS_RESULT",
              payload: {
                success,
                sessionId,
                windowId,
              },
            });
          } catch (error) {
            console.error("Error updating named session tabs:", error);
            sendResponse({
              type: "ERROR",
              payload: error instanceof Error ? error.message : String(error),
            });
          }
          break;
        case DELETE_NAMED_SESSION:
          try {
            const { sessionId } = payload;
            await SessionManagement.deleteNamedSession(sessionId);
            sendResponse({
              type: "DELETE_NAMED_SESSION_RESULT",
              payload: "success",
            });
          } catch (error) {
            console.error("Error deleting named session:", error);
            sendResponse({
              type: "ERROR",
              payload: error instanceof Error ? error.message : String(error),
            });
          }
          break;
        case GET_NAMED_SESSIONS:
          try {
            const sessions = await SessionManagement.getNamedSessions();
            sendResponse({
              type: "GET_NAMED_SESSIONS_RESULT",
              payload: sessions,
            });
          } catch (error) {
            console.error("Error getting named sessions:", error);
            sendResponse({
              type: "ERROR",
              payload: error instanceof Error ? error.message : String(error),
            });
          }
          break;
        case CATEGORIZE_TABS:
          try {
            // Get tab summaries for all tabs in the payload
            const tabUrls = payload.tabUrls;
            if (!tabUrls || !Array.isArray(tabUrls)) {
              throw new Error("Invalid tab URLs provided");
            }

            // Get cached summaries for all tabs
            const tabSummariesPromises = tabUrls.map(async (url: string) => {
              const cachedSummaries = await getCachedSummaries(url);
              return {
                // TODO: If we don't need the tabId here, we may use map url->TabSummart[] or define a new type.
                tabId: 0, // Using 0 as a placeholder since we're working with URLs, not tab IDs
                url: url,
                summaries: cachedSummaries || [],
              };
            });

            const tabSummaries: TabSummary[] =
              await Promise.all(tabSummariesPromises);

            // Filter tabs that have embeddings
            const tabsWithEmbeddings = tabSummaries.filter(
              (tab) => tab.summaries.length > 0 && tab.summaries[0].embeddings,
            );

            if (tabsWithEmbeddings.length < 2) {
              sendResponse({
                type: "CATEGORIZE_TABS_RESULT",
                payload: {
                  categories: [],
                  message: "Not enough tabs with embeddings to categorize",
                },
              });
              return;
            }

            // Use the threshold from payload or default
            const threshold = payload.threshold || SIMILARITY_THRESHOLD;

            // Categorize tabs by similarity
            const categories = TabCategorization.categorizeTabsBySimilarity(
              tabsWithEmbeddings,
              threshold,
            );

            sendResponse({
              type: "CATEGORIZE_TABS_RESULT",
              payload: {
                categories,
              },
            });
          } catch (error) {
            console.error("Error categorizing tabs:", error);
            sendResponse({
              type: "ERROR",
              payload: error instanceof Error ? error.message : String(error),
            });
          }
          break;
        case SUGGEST_TAB_DESTINATIONS:
          try {
            const { tabUrl, tabUrls } = payload;
            if (!tabUrl || !tabUrls || !Array.isArray(tabUrls)) {
              throw new Error("Invalid tab URL or tab URLs provided");
            }

            // Get cached summaries for all tabs
            const tabSummariesPromises = tabUrls.map(async (url: string) => {
              const cachedSummaries = await getCachedSummaries(url);
              return {
                // TODO: If we don't need the tabId here, we may use map url->TabSummart[] or define a new type.
                tabId: 0, // Using 0 as a placeholder since we're working with URLs, not tab IDs
                url: url,
                summaries: cachedSummaries || [],
              };
            });

            const tabSummaries: TabSummary[] =
              await Promise.all(tabSummariesPromises);

            // Get suggested destinations
            const suggestions = await TabCategorization.suggestTabDestinations(
              tabUrl,
              tabSummaries,
            );

            sendResponse({
              type: "SUGGEST_TAB_DESTINATIONS_RESULT",
              payload: {
                suggestions,
              },
            });
          } catch (error) {
            console.error("Error suggesting tab destinations:", error);
            sendResponse({
              type: "ERROR",
              payload: error instanceof Error ? error.message : String(error),
            });
          }
          break;
        case MIGRATE_TAB:
          try {
            const { tabId, windowId } = payload;
            if (!tabId || !windowId) {
              throw new Error("Tab ID and window ID are required");
            }

            // Migrate the tab to the destination window
            const migratedTab = await TabCategorization.migrateTabToWindow(
              tabId,
              windowId,
            );

            sendResponse({
              type: "MIGRATE_TAB_RESULT",
              payload: {
                success: true,
                tab: migratedTab,
              },
            });
          } catch (error) {
            console.error("Error migrating tab:", error);
            sendResponse({
              type: "ERROR",
              payload: error instanceof Error ? error.message : String(error),
            });
          }
          break;
        case SAVE_TAB_TO_BOOKMARKS:
          try {
            const { sessionId, tabId, metadata } = payload;
            if (!sessionId || !tabId) {
              throw new Error("Session ID and Tab ID are required");
            }

            // Get the tab details
            const tab = await chrome.tabs.get(tabId);

            // Save the tab to bookmarks
            const success = await SessionManagement.saveTabToBookmarks(
              sessionId,
              tab,
              metadata,
            );

            sendResponse({
              type: "SAVE_TAB_TO_BOOKMARKS_RESULT",
              payload: {
                success,
                tabId,
                sessionId,
              },
            });
          } catch (error) {
            console.error("Error saving tab to bookmarks:", error);
            sendResponse({
              type: "ERROR",
              payload: error instanceof Error ? error.message : String(error),
            });
          }
          break;
        case GET_SAVED_BOOKMARKS:
          try {
            const { sessionId } = payload;
            if (!sessionId) {
              throw new Error("Session ID is required");
            }

            // Get saved bookmarks for the session
            const bookmarks =
              await SessionManagement.getSavedBookmarks(sessionId);

            sendResponse({
              type: "GET_SAVED_BOOKMARKS_RESULT",
              payload: {
                bookmarks,
                sessionId,
              },
            });
          } catch (error) {
            console.error("Error getting saved bookmarks:", error);
            sendResponse({
              type: "ERROR",
              payload: error instanceof Error ? error.message : String(error),
            });
          }
          break;
        case OPEN_SAVED_BOOKMARK:
          try {
            const { bookmarkId, windowId } = payload;
            if (!bookmarkId) {
              throw new Error("Bookmark ID is required");
            }

            // Get the bookmark details
            const bookmarkNodes = await chrome.bookmarks.get(bookmarkId);
            if (
              !bookmarkNodes ||
              bookmarkNodes.length === 0 ||
              !bookmarkNodes[0].url
            ) {
              throw new Error("Bookmark not found or has no URL");
            }

            // Open the bookmark URL in a new tab
            const tab = await chrome.tabs.create({
              url: bookmarkNodes[0].url,
              windowId: windowId || undefined,
            });

            sendResponse({
              type: "OPEN_SAVED_BOOKMARK_RESULT",
              payload: {
                success: true,
                tab,
              },
            });
          } catch (error) {
            console.error("Error opening saved bookmark:", error);
            sendResponse({
              type: "ERROR",
              payload: error instanceof Error ? error.message : String(error),
            });
          }
          break;
        case SYNC_SESSION_TO_BOOKMARKS:
          try {
            const { sessionId } = payload;
            if (!sessionId) {
              throw new Error("Session ID is required");
            }

            // Get the session
            const sessions = await SessionManagement.getNamedSessions();
            const session = sessions.find((s) => s.id === sessionId);
            if (!session) {
              throw new Error("Session not found");
            }

            // Sync the session to bookmarks
            const success =
              await SessionManagement.syncSessionToBookmarks(session);

            sendResponse({
              type: "SYNC_SESSION_TO_BOOKMARKS_RESULT",
              payload: {
                success,
                sessionId,
              },
            });
          } catch (error) {
            console.error("Error syncing session to bookmarks:", error);
            sendResponse({
              type: "ERROR",
              payload: error instanceof Error ? error.message : String(error),
            });
          }
          break;
        case GET_SYNCED_BOOKMARKS:
          try {
            const { sessionId } = payload;
            if (!sessionId) {
              throw new Error("Session ID is required");
            }

            // Get synced bookmarks for the session
            const bookmarks =
              await SessionManagement.getSyncedBookmarks(sessionId);

            sendResponse({
              type: "GET_SYNCED_BOOKMARKS_RESULT",
              payload: {
                bookmarks,
                sessionId,
              },
            });
          } catch (error) {
            console.error("Error getting synced bookmarks:", error);
            sendResponse({
              type: "ERROR",
              payload: error instanceof Error ? error.message : String(error),
            });
          }
          break;
        case GET_CLOSED_NAMED_SESSIONS:
          try {
            // Get closed named sessions
            const closedSessions =
              await SessionManagement.getClosedNamedSessions();

            sendResponse({
              type: "GET_CLOSED_NAMED_SESSIONS_RESULT",
              payload: {
                closedSessions,
              },
            });
          } catch (error) {
            console.error("Error getting closed named sessions:", error);
            sendResponse({
              type: "ERROR",
              payload: error instanceof Error ? error.message : String(error),
            });
          }
          break;
        case RESTORE_CLOSED_SESSION:
          try {
            const { sessionId } = payload;
            if (!sessionId) {
              throw new Error("Session ID is required");
            }

            // Restore the closed session
            const restoredSession =
              await SessionManagement.restoreClosedSession(sessionId);

            if (restoredSession) {
              sendResponse({
                type: "RESTORE_CLOSED_SESSION_RESULT",
                payload: {
                  success: true,
                  session: restoredSession,
                },
              });
            } else {
              sendResponse({
                type: "RESTORE_CLOSED_SESSION_RESULT",
                payload: {
                  success: false,
                  error: "Failed to restore session",
                },
              });
            }
          } catch (error) {
            console.error("Error restoring closed session:", error);
            sendResponse({
              type: "ERROR",
              payload: error instanceof Error ? error.message : String(error),
            });
          }
          break;
        default:
          console.warn("Unknown LLM task type:", type);
          if (message.action === "callFunction") {
            // This is for editor.html, which has own handling logic.
            // TODO: implement proper targetting logic.
          } else {
            sendResponse({ type: "ERROR", payload: "Unknown LLM task type" });
          }
      }
    } catch (error) {
      console.error("Error handling message:", error);
      sendResponse({
        type: "ERROR",
        payload: error instanceof Error ? error.message : String(error),
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
      func: () => document.body.innerText,
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
async function generateSummary(
  content: string,
  url: string,
  title: string,
): Promise<string> {
  // Include URL and title in the summary generation process
  const context = `URL: ${url}, Title: ${title}`;
  const summary = await llmService.createSummary(content + "\n" + context);
  return summary;
}

/**
 * Wrapper for DigestManagement.getCachedSummaries
 * TODO: This can be inlined?
 * @param url The URL of the page
 * @returns An array of cached summary entries, or null if none exist
 */
async function getCachedSummaries(url: string): Promise<DigestEntry[] | null> {
  return DigestManagement.getCachedSummaries(url);
}

// Functions for keyword extraction and embeddings
async function generateKeywords(text: string): Promise<string[]> {
  try {
    const keywords = await llmService.listKeywords(text);
    console.log("Extracted Keywords:", keywords.join(", "));
    return keywords;
  } catch (error) {
    throw new Error("Keyword extraction failed");
  }
}

async function generateEmbeddings(text: string): Promise<number[]> {
  try {
    const embeddings = await llmService.generateEmbeddings(text);
    console.log("Embeddings Created:", embeddings.length, "dimensionality");
    return embeddings;
  } catch (error) {
    throw new Error("Embedding creation failed");
  }
}

/**
 * Wrapper for DigestManagement.updateCache
 * TODO: This can be inlined?
 * @param url The URL of the page
 * @param digestEntry The digest entry to add to the cache
 */
async function updateCache(url: string, digestEntry: DigestEntry) {
  return DigestManagement.updateCache(url, digestEntry);
}
// TODO: Implement syncing with
// in-Memory Model and the background store.
// Sessions (groups of tabs/URLs)

// Bookmark folder as a Storage
// Initialize bookmark parent folder
async function initializeBookmarkParentFolder() {
  try {
    // Check if we already have a parent folder ID in config
    const config = await getConfig();
    if (config.bookmarkParentId) {
      // Verify the folder still exists
      try {
        await chrome.bookmarks.get(config.bookmarkParentId);
        console.log(
          "Bookmark parent folder already exists:",
          config.bookmarkParentId,
        );
        return;
      } catch (error) {
        console.warn(
          "Configured bookmark parent folder no longer exists, will create a new one",
        );
      }
    }

    // Create a parent folder for our bookmarks
    const parentFolder = await chrome.bookmarks.create({
      title: "Hacky Helper Sessions",
    });

    // Save the folder ID to config
    CONFIG_STORE.set("bookmarkParentId", parentFolder.id);
    console.log("Created bookmark parent folder:", parentFolder.id);
  } catch (error) {
    console.error("Error initializing bookmark parent folder:", error);
  }
}

// Call the initialization function when the service worker starts
// TODO: Ask before creating a folder, or let the user choose the bookmark folder to use.
// TODO: And better to kick initialization via SessionManager instead of direcly calling bookmarkStorage here.
initializeBookmarkParentFolder().then(async () => {
  try {
    // Initialize the bookmark storage system after the parent folder is set up
    const initialized = await bookmarkStorage.initialize();
    if (initialized) {
      console.log("Bookmark storage system initialized successfully");
    } else {
      console.warn("Failed to initialize bookmark storage system");
    }
  } catch (error) {
    console.error("Error initializing bookmark storage:", error);
  }
});
