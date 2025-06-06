# Hacky Helper Chrome Extension Architecture

## Overview

Hacky Helper is a Chrome extension designed to enhance browsing experience with features like tab management, content summarization using LLM (Large Language Models), and bookmark organization. The extension leverages Chrome's Extension APIs and integrates with LLM services (OpenAI and Ollama) to provide intelligent features.

## Core Components

### 1. Background Service Worker (`service-worker.ts`)

The service worker is the central component that runs in the background and manages the extension's core functionality:

- **Tab Management**: Tracks tab creation, updates, and removal events. Also handles tab activation events to trigger content processing.
- **LLM Task Queue**: Manages a queue (`llmTasks`) of content processing tasks (summarization, keyword extraction, embedding generation) triggered by tab updates or activation. Tasks are processed sequentially (`processNextTask`) and periodically via a Chrome Alarm (`processTasksAlarm`).
- **Caching**: Stores processed content results using a persistent LRU (Least Recently Used) cache (`DigestManagement`).
- **Message Handling**: Processes messages from content scripts and other extension components. Message handling is currently split:
  - `service-worker.ts`: Handles core messages defined in `src/lib/constants.ts` (e.g., LLM tasks like `CREATE_SUMMARY`, session lifecycle like `CREATE_NAMED_SESSION`, `UPDATE_NAMED_SESSION_TABS`, `DELETE_NAMED_SESSION`, `RENAME_NAMED_SESSION`, bookmark operations like `SAVE_TAB_TO_BOOKMARKS`, `OPEN_SAVED_BOOKMARK`, `REMOVE_SAVED_BOOKMARK`, and the `SYNC_SESSION_TO_BOOKMARKS` message which triggers `SessionManagement.syncSessionToBackend`).
  - `service-worker-handler.ts`: Handles feature-specific messages defined in `src/features/service-worker-messages.ts` (e.g., session actions like `ACTIVATE_SESSION`, `CLONE_SESSION`, `RESTORE_CLOSED_SESSION`, tab actions like `TAKEOVER_TAB`, and the `MIGRATE_TABS` message which triggers `SessionManagement.migrateTabsToWindow` for migrating tabs between active windows. Migration to closed sessions is currently a TODO).
  - _Note: A refactoring task exists (see `taskdocs/parking_lot.md`) to consolidate handlers into `service-worker-handler.ts`._
- **Automatic Session Sync**: Periodically triggers session synchronization to the backend (bookmarks) via a Chrome Alarm (`autoSessionSyncAlarm`) and `SessionManagement.triggerAutoSessionSync`.

### 2. LLM Services (`llmService.ts`)

Provides an abstraction layer for interacting with different LLM providers:

- **OpenAILLMService**: Connects to OpenAI's API for content processing using the official OpenAI API library
- **OllamaLLMService**: Connects to a local Ollama instance for content processing
- Both implement a common interface for:
  - Content summarization
  - Keyword extraction
  - Embedding generation

### 3. Configuration Management (`config_store.ts`)

Manages extension settings and configuration:

- **ConfigStore**: Central configuration store with persistence to Chrome's storage
- **Config Classes**: Type-specific configuration classes (BoolConfig, StringConfig)
- **Settings**: Includes API keys, model preferences, and feature toggles

### 4. Caching System

Two-level caching system for efficient data storage:

- **LRU Cache** (`lru-cache.ts`): In-memory cache with least-recently-used eviction policy
- **Persistent Cache** (`persistent-cache.ts`): Extends LRU cache with persistence to Chrome's storage

### 5. User Interface Components

Multiple HTML pages for different extension functionalities:

- **Popup** (`index.html`): Main extension popup
- **Side Panel** (`sidepanel.html`, `sidepanel.ts`): Side panel interface for content inspection and analysis
- **Settings** (`settings.html`): Configuration interface
- **Tabs Management** (`tabs.html`, `tabs.ts`): Tab organization interface.
  - Provides a view of active, unnamed, and closed sessions.
  - Displays tabs within the selected session.
  - Implements **drag-and-drop tab migration**: Users can drag one or multiple tabs from the tab list and drop them onto a session item in the session list. The event flow involves `dragstart` (setting data and a custom drag image), `dragover`/`dragleave` (providing visual feedback on the target session item using CSS classes like `drag-over`), and `drop` (triggering `handleTabDrop` which communicates with the service worker via `MIGRATE_TABS` message).
- **Editor** (`editor.html`, `editor.ts`): Text editing interface
- **Log Viewers** (`logview.html`, `voice_log.html`): Logging interfaces

### 6. Content Script (`content.ts`)

Runs in the context of web pages to extract content:

- **Text Extraction**: Extracts visible text from web pages
- **DOM Traversal**: Uses TreeWalker API to efficiently traverse the DOM

### 7. Feature Modules

Specialized modules for specific features:

- **Tab Organizer** (`features/tab_organizer.ts`): Manages tab organization and reordering
- **Bookmark Store** (`features/groupstore_bookmark.ts`): Manages bookmark-based storage for tab groups and sessions
  - **GroupStoreImpl**: Manages bookmark groups (folders) for organizing tabs
  - **BookmarkStoreImpl**: Handles individual bookmarks within groups

## Data Flow

1. **Content Processing**:

   - Content script extracts text from web pages
   - Service worker queues content for processing
   - LLM service processes content (summarization, keywords, embeddings)
   - Results are cached for future use

2. **Tab Management & Migration**:

   - Service worker tracks tab events (creation, update, removal, activation).
   - **UI Interaction (`tabs.html`/`tabs.ts`):**
     - Displays sessions and tabs.
     - Handles user actions like selecting tabs, clicking buttons, or initiating drag-and-drop.
     - **Drag-and-Drop Migration:**
       - `dragstart`: Tab data (IDs) is captured.
       - `dragover`/`dragleave`: Target session item provides visual feedback.
       - `drop`: `handleTabDrop` is triggered.
     - Sends messages (`MIGRATE_TABS`, `SYNC_SESSION_TO_BOOKMARKS`, etc.) to the service worker via `serviceWorkerInterface`.
   - **Service Worker (`service-worker.ts`, `service-worker-handler.ts`):**
     - Receives messages from the UI.
     - Orchestrates actions by calling appropriate modules (e.g., `SessionManagement`).
     - For `MIGRATE_TABS`: Calls `SessionManagement.migrateTabsToWindow` to move tabs between browser windows using `chrome.tabs.move`.
     - For `SYNC_SESSION_TO_BOOKMARKS`: Calls `SessionManagement.syncSessionToBackend` to update the bookmark representation.
   - **Session Management (`features/session-management.ts`):**
     - Manages the state of named sessions (active and associations).
     - Interacts with `BookmarkStorage` for backend persistence.
     - Contains logic for moving tabs (`migrateTabsToWindow`) and syncing session state (`syncSessionToBackend`).
   - **Bookmark Storage (`features/BookmarkStorage.ts`):**
     - Handles the interaction with the Chrome Bookmarks API to persist session data (open tabs, saved bookmarks) in the designated folder structure.

3. **Configuration**:
   - Settings UI allows users to configure the extension
   - Config store persists settings to Chrome's storage
   - Components read configuration to adjust behavior

## Storage

The extension uses multiple storage mechanisms:

- **Chrome Storage**: For persistent configuration and cache data
- **In-Memory Caches**: For frequently accessed data
- **Bookmarks API**: For storing tab groups and sessions

## Implemented Features

1. **Tab UI Improvements**:

   - tabs.html opens as a pinned tab for tab management
   - Duplicate tabs.html tabs are automatically closed (only one tabs.html tab per window)
   - Pinned tabs are excluded from the tab list UI
   - Tab counts in the window list exclude pinned tabs
   - Global hotkey (Alt+X) to quickly open the tabs.html page from anywhere
   - Drag-and-drop functionality for intuitive tab migration between sessions displayed in the Tabs UI.

2. **Bookmark Integration**:

   - Bookmark chooser UI in settings.html for selecting the parent bookmark folder
   - Configuration to specify which bookmark folder is managed by the extension
   - Infrastructure for storing and retrieving bookmarks using Chrome's Bookmarks API

3. **Side Panel Writer Support**:

   - Dedicated UI in sidepanel.html for choosing LLM service (Ollama or OpenAI)
   - Model selection based on the chosen LLM service
   - Prepared prompts for various document writing scenarios
   - Abstracted LLM service interface for consistent interaction with different providers
   - Support for interacting with visible page content

4. **Battery-Aware LLM Processing**:

   - Toggle in popup UI to enable/disable LLM services
   - Option to automatically disable LLM services when running on battery power
   - Battery status detection and display in the popup
   - Automatic toggling of LLM services based on charging state

5. **Tab Auto-Categorization**:
   - Automatic categorization of tabs based on content similarity using embeddings
   - Tab migration functionality to move tabs between windows/sessions
   - Suggestion of destination windows/sessions based on content similarity
   - Dialog interface for viewing tab categories and managing tab migration
   - Integration with the Named Sessions feature for better organization

## Implemented Features (continued)

6. **Named Sessions**:
   - Ability to name browser windows/sessions
   - Automatic storage of named sessions as bookmarks
   - Session management with unique session IDs
   - Bookmark-based persistence for session data
   - Support for closed session management (deletion and restoration)
   - Auto-save functionality to sync sessions to bookmarks after idle time
   - Session-window association persistence via URL query parameters
   - Automatic restoration of session-window associations when service worker is reloaded

## Technical Stack

- **TypeScript**: Primary programming language
- **Chrome Extension APIs**: For browser integration
- **LLM APIs**: OpenAI and Ollama for content processing
- **Web Speech API**: For text-to-speech functionality
- **Modern DOM APIs**: For efficient content extraction
- **Vitest**: For unit and integration testing.

## Testing

The project utilizes **Vitest** for its testing framework, chosen for its speed and compatibility with the Vite build tool. Tests cover core functionalities such as service worker message handling (`service-worker-handler.test.ts`) and session management (`session-management.test.ts`, `bookmark-storage.test.ts`). The testing strategy focuses on ensuring the reliability of key components and interactions.
