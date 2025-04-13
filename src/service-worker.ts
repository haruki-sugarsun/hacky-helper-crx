/**
 * @file service-worker.ts
 *
 * This file serves as the service worker for the Hacky Helper Chrome extension.
 * The service worker listens for various Chrome extension events such as tab creation, removal, and updates,
 * and processes tasks related to LLM services or session management in the background.
 * It also sets up periodic task triggers to process related tasks.
 *
 * The file imports various modules and features required for its functionality, including:
 * - LLM services (OpenAI and Ollama)
 * - Constants and configuration store
 * - Helper functions and types
 * - Features for tab organization, session management, tab categorization, digest management, and bookmark storage
 *
 * The service worker initializes the LLM service based on configuration settings and sets up event listeners
 * for tab management and task processing. It also handles incoming messages from content scripts and performs
 * actions such as generating summaries, extracting keywords, creating embeddings, and managing sessions and bookmarks.
 *
 * @module service-worker
 */
import {
  LLMService,
  OpenAILLMService,
  OllamaLLMService,
} from "./features/llm-service.ts";

import {
  CREATE_SUMMARY,
  LIST_KEYWORDS,
  CREATE_EMBEDDINGS,
  GET_CACHED_SUMMARIES,
  CREATE_NAMED_SESSION,
  UPDATE_NAMED_SESSION_TABS,
  DELETE_NAMED_SESSION,
  RENAME_NAMED_SESSION,
  OLLAMA_API_URL_DEFAULT,
  OLLAMA_MODEL_DEFAULT,
  OLLAMA_EMBEDDINGS_MODEL_DEFAULT,
  CATEGORIZE_TABS,
  SUGGEST_TAB_DESTINATIONS,
  MIGRATE_TAB,
  SIMILARITY_THRESHOLD,
  SAVE_TAB_TO_BOOKMARKS,
  GET_SAVED_BOOKMARKS,
  OPEN_SAVED_BOOKMARK,
  SYNC_SESSION_TO_BOOKMARKS,
  GET_SYNCED_OPENTABS,
  GET_CLOSED_NAMED_SESSIONS,
  RESTORE_CLOSED_SESSION,
  REMOVE_SAVED_BOOKMARK,
} from "./lib/constants";

import { CONFIG_RO } from "./features/config-store.ts";
import { DigestEntry, TabSummary } from "./lib/types";
import { getPromiseState } from "./lib/helpers.ts"; // Import the function

import "./features/tab-organizer.ts";
import * as SessionManagement from "./features/session-management.ts";
import * as TabCategorization from "./features/tab-categorization.ts";
import * as DigestManagement from "./features/digest-management";
import { BookmarkStorage } from "./features/BookmarkStorage.ts";
import { openTabsPage } from "./features/tabs-helpers.ts";
import { handleServiceWorkerMessage } from "./features/service-worker-handler";

// Entrypoint logging:
console.log("service-worker.ts", new Date());

// Listen for keyboard commands
chrome.commands.onCommand.addListener((command) => {
  console.log(`Command received: ${command}`);

  switch (command) {
    case "open-tabs-page":
      console.log("Opening tabs page");
      openTabsPage();
      break;

    case "focus-search-bar":
      // TODO: Have a common implementation to find the Tabs UI for the active window.
      chrome.tabs.query(
        { currentWindow: true, url: chrome.runtime.getURL("tabs.html*") },
        (tabs) => {
          if (tabs.length > 0) {
            // Send message to the first tab only
            if (tabs[0] && tabs[0].id) {
              // First activate the tab
              chrome.tabs.update(tabs[0].id, { active: true });
              // Then send the message
              chrome.tabs.sendMessage(tabs[0].id, {
                type: "hotkey",
                command: "focus-search-bar",
              });
            }
          } else {
            // No Tabs UI page found; open one and send a message.
            // TODO: Use await for more readability.
            // TODO: Or use another approach passing event via URL fragment?
            // TODO: Have a common implementation to open the Tabs UI page.
            chrome.tabs.create(
              { url: chrome.runtime.getURL("tabs.html"), active: true },
              (tab) => {
                setTimeout(() => {
                  chrome.tabs.sendMessage(tab.id!, {
                    type: "hotkey",
                    command: "focus-search-bar",
                  });
                }, 1000);
              },
            );
          }
        },
      );
      break;

    default:
      console.log(`Unhandled command: ${command}`);
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
  const useOllama = await CONFIG_RO.USE_OLLAMA(); // TODO: use the read-only config.
  // TODO: Make the LLM option configurable in the settings UI.
  if (useOllama) {
    const ollamaApiUrl =
      (await CONFIG_RO.OLLAMA_API_URL()) || OLLAMA_API_URL_DEFAULT;
    const ollamaModel =
      (await CONFIG_RO.OLLAMA_MODEL()) || OLLAMA_MODEL_DEFAULT;
    const ollamaEmbeddingsModel =
      (await CONFIG_RO.OLLAMA_EMBEDDINGS_MODEL()) ||
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

// New integration: Update session updatedAt on window/tab events
async function updateSessionForWindow(windowId: number) {
  const sessions = await SessionManagement.getNamedSessions();
  sessions.forEach((session) => {
    if (session.windowId === windowId) {
      SessionManagement.updateSessionUpdatedAt(session.id);
    }
  });
}

chrome.windows.onCreated.addListener((window) => {
  if (window && window.id) {
    updateSessionForWindow(window.id); // TODO: Can it be meaninful?
  }
});
chrome.windows.onRemoved.addListener((windowId) => {
  updateSessionForWindow(windowId); // TODO: This should be something else?
});
chrome.tabs.onCreated.addListener((tab) => {
  if (tab && tab.windowId) {
    updateSessionForWindow(tab.windowId);
  }
});
chrome.tabs.onUpdated.addListener((_tabId, _changeInfo, tab) => {
  if (tab && tab.windowId) {
    updateSessionForWindow(tab.windowId);
  }
});
chrome.tabs.onRemoved.addListener((_tabId, removeInfo) => {
  if (removeInfo && removeInfo.windowId) {
    updateSessionForWindow(removeInfo.windowId);
  }
});

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
    const llmEnabled = await CONFIG_RO.LLM_ENABLED();
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

// Setup periodic alarm for auto session sync, triggers every 10 minutes
// TODO: extract these alarm strings to CONSTANTS.
chrome.alarms.create("autoSessionSyncAlarm", { periodInMinutes: 10 });

// Setup a periodic call of processNextTask every 1 minute
chrome.alarms.create("processTasksAlarm", {
  periodInMinutes: 1,
});

// Listen for the alarm and process tasks
// Alarm listener: handle processTasksAlarm and autoSessionSyncAlarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "processTasksAlarm") {
    console.log("Periodic task processing triggered", new Date());
    processNextTask();
  } else if (alarm.name === "autoSessionSyncAlarm") {
    console.log("Auto session sync alarm triggered", new Date());
    SessionManagement.triggerAutoSessionSync();
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
          {
            const { windowId, sessionName } = payload;
            const session = await SessionManagement.createNamedSession(
              windowId,
              sessionName,
            );
            sendResponse({
              type: "CREATE_NAMED_SESSION_RESULT",
              payload: session,
            });
          }
          break;
        case UPDATE_NAMED_SESSION_TABS:
          {
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
          }
          break;
        case DELETE_NAMED_SESSION:
          {
            const { sessionId } = payload;
            await SessionManagement.deleteNamedSession(sessionId);
            sendResponse({
              type: "DELETE_NAMED_SESSION_RESULT",
              payload: "success",
            });
          }
          break;
        case RENAME_NAMED_SESSION:
          {
            const { sessionId, newName } = payload;
            if (!sessionId || !newName) {
              throw new Error("Session ID and new name are required");
            }

            const success = await SessionManagement.renameNamedSession(
              sessionId,
              newName,
            );

            sendResponse({
              type: "RENAME_NAMED_SESSION_RESULT",
              payload: {
                success,
              },
            });
          }
          break;
        case CATEGORIZE_TABS:
          // TODO: Factor out to a method.
          {
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
          }
          break;
        case SUGGEST_TAB_DESTINATIONS:
          {
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
          }
          break;
        case MIGRATE_TAB:
          // TODO: We can rename the message type to MIGRATE_TABS, and let the caller only use `tabIds`.
          {
            const { tabId, tabIds, windowId } = payload;
            if (!windowId) {
              throw new Error("Window ID is required");
            }

            if (tabIds && Array.isArray(tabIds)) {
              // Handle multiple tabs
              if (tabIds.length === 0) {
                throw new Error("No tab IDs provided");
              }

              // Migrate the tabs to the destination window
              const migratedTabs = await SessionManagement.migrateTabsToWindow(
                tabIds,
                windowId,
              );

              sendResponse({
                type: "MIGRATE_TAB_RESULT",
                payload: {
                  success: true,
                  tabs: migratedTabs,
                },
              });
            } else if (tabId) {
              // Handle single tab (backward compatibility)
              const migratedTabs = await SessionManagement.migrateTabsToWindow(
                [tabId],
                windowId,
              );

              sendResponse({
                type: "MIGRATE_TAB_RESULT",
                payload: {
                  success: true,
                  tab: migratedTabs[0],
                },
              });
            } else {
              throw new Error("Either tabId or tabIds must be provided");
            }
          }
          break;
        case SAVE_TAB_TO_BOOKMARKS:
          {
            const { sessionId, tabId, metadata } = payload;
            if (!sessionId || !tabId) {
              throw new Error("Session ID and Tab ID are required");
            }

            // Get the tab details
            const tab = await chrome.tabs.get(tabId);

            // Save the tab to bookmarks
            const success = await SessionManagement.saveTabToBackend(
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
          }
          break;
        case GET_SAVED_BOOKMARKS:
          {
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
          }
          break;
        case OPEN_SAVED_BOOKMARK:
          {
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
          }
          break;
        case REMOVE_SAVED_BOOKMARK:
          {
            const { bookmarkId } = payload;
            if (!bookmarkId) {
              throw new Error("Bookmark ID is required");
            }
            await chrome.bookmarks.remove(bookmarkId);
            sendResponse({
              type: "REMOVE_SAVED_BOOKMARK_RESULT",
              payload: {
                success: true,
                bookmarkId,
              },
            });
          }
          break;
        case SYNC_SESSION_TO_BOOKMARKS:
          {
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
              await SessionManagement.syncSessionToBackend(session);

            sendResponse({
              type: "SYNC_SESSION_TO_BOOKMARKS_RESULT",
              payload: {
                success,
                sessionId,
              },
            });
          }
          break;
        case GET_SYNCED_OPENTABS:
          {
            const { sessionId } = payload;
            if (!sessionId) {
              throw new Error("Session ID is required");
            }

            // Get synced bookmarks for the session
            // TODO: Rename the method to getSyncedOpenTabs().
            const bookmarks =
              await SessionManagement.getSyncedOpenTabs(sessionId);

            sendResponse({
              // TODO: Have constants for these "RESULT" types, e.g. GET_SYNCED_OPENTABS_RESULT
              type: "GET_SYNCED_OPENTABS_RESULT",
              payload: {
                bookmarks,
                sessionId,
              },
            });
          }
          break;
        case GET_CLOSED_NAMED_SESSIONS:
          sendResponse({
            type: "GET_CLOSED_NAMED_SESSIONS_RESULT",
            payload: {
              closedSessions: await SessionManagement.getClosedNamedSessions(),
            },
          });
          break;
        case RESTORE_CLOSED_SESSION:
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
          break;
        case "DEBUG_TRIGGER":
          // For dedugging:
          console.log("Auto session sync alarm triggered", new Date());
          SessionManagement.triggerAutoSessionSync();
          break;
        default:
          // TODO: Migrate the handlers to `service-worker-handler.ts`.
          if (!handleServiceWorkerMessage(message, _sender, sendResponse)) {
            console.warn("Unknown Message type:", type);
            if (message.action === "callFunction") {
              // This is for editor.html, which has own handling logic.
              // TODO: implement proper targetting logic.
            } else {
              throw new Error(`Unknown Message type: ${type}`);
            }
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

// TODO: Have src/service-worker/bookmark-storage-support.ts to have implementations.
// TODO: Fix error `Top-level await is not available in the configured target environment ("chrome87", "edge88", "es2020", "firefox78", "safari14" + 2 overrides)`
(async () => {
  try {
    // Initialize the bookmark storage system after the parent folder is set up
    const initialized = await BookmarkStorage.getInstance().initialize();
    if (initialized) {
      console.log("Bookmark storage system initialized successfully");
    } else {
      console.warn("Failed to initialize bookmark storage system");
    }
  } catch (error) {
    console.error("Error initializing bookmark storage:", error);
  }
})();
