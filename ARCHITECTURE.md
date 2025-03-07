# Hacky Helper Chrome Extension Architecture

## Overview

Hacky Helper is a Chrome extension designed to enhance browsing experience with features like tab management, content summarization using LLM (Large Language Models), and bookmark organization. The extension leverages Chrome's Extension APIs and integrates with LLM services (OpenAI and Ollama) to provide intelligent features.

## Core Components

### 1. Background Service Worker (`service-worker.ts`)

The service worker is the central component that runs in the background and manages the extension's core functionality:

- **Tab Management**: Tracks tab creation, updates, and removal events
- **LLM Task Queue**: Manages a queue of content processing tasks (summarization, keyword extraction, embedding generation)
- **Caching**: Stores processed content results using a persistent LRU (Least Recently Used) cache
- **Message Handling**: Processes messages from content scripts and other extension components

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
- **Tabs Management** (`tabs.html`, `tabs.ts`): Tab organization interface
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

2. **Tab Management**:

   - Service worker tracks tab events
   - Tab organizer handles tab organization logic
   - UI components display and allow interaction with tabs

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

## Planned Features

As documented in DEVPLANS.md:

1. **Named Sessions**:
   - Ability to name browser windows/sessions
   - Automatic storage of named sessions as bookmarks

## Technical Stack

- **TypeScript**: Primary programming language
- **Chrome Extension APIs**: For browser integration
- **LLM APIs**: OpenAI and Ollama for content processing
- **Web Speech API**: For text-to-speech functionality
- **Modern DOM APIs**: For efficient content extraction
