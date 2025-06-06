# Hacky Helper Chrome Extension - Development Plan

## Mission Overview

_"Space: the final frontier. These are the voyages of the Chrome Extension Hacky Helper..."_

This document outlines our strategic development roadmap, organizing scattered ideas into a cohesive plan for enhanced browser session management and tab organization.

## Development Categories

### 🚀 Core Features (High Priority)

**Status: Mission Critical**

#### 1. Real-time UI Updates

- **Task**: Implement live Tabs UI updates based on window/tabs/sessions changes
- **Complexity**: Medium
- **Dependencies**: None
- **Target**: Q1 2024

#### 2. Session Management Enhancements

- **Task**: Improve session restoration on browser startup
- **Details**: Fix sessionId URL referencing issues
- **Complexity**: High
- **Dependencies**: Backend refactoring

#### 3. Search & Discovery

- **Task**: Enhanced search functionality
- **Sub-tasks**:
  - Search for saved bookmarks
  - Show session names in search results
  - URL-based search matching
  - Prioritize "Open tabs" over "saved bookmarks" in results
- **Complexity**: Medium

### 🔧 User Experience (Medium Priority)

**Status: Quality of Life Improvements**

#### 1. UI/UX Enhancements

- **Tasks**:
  - Implement webfont for emojis
  - Show favicons in Tabs UI
  - Style improvements in Settings UI
  - Common modal behavior (ESC to close)
  - Toast messages instead of alerts

#### 2. Keyboard & Shortcuts

- **Tasks**:
  - Hotkey for sidepanel trigger
  - Clear query on focus-search-bar action
  - Open sidepanel from popup

#### 3. Session Operations

- **Tasks**:
  - Migration to closed Named Sessions
  - Auto-bookmark restoration flags
  - Session renaming capabilities
  - Close Window action in Tabs UI

### ⚙️ Technical Debt (Medium Priority)

**Status: "Make it so, Number One"**

#### 1. Code Refactoring

- **Tasks**:
  - Replace config accesses with CONFIG_RO
  - Migrate to service-worker-interface pattern
  - Move message handlers to service-worker-handler.ts
  - Improve SYNC_SESSION_TO_BOOKMARKS messaging

#### 2. Architecture Improvements

- **Tasks**:
  - LLM task queueing with LRU behavior
  - Queue management for obsolete tabs
  - Better layer separation

### 🧪 Advanced Features (Low Priority)

**Status: "Fascinating, Captain"**

#### 1. AI/LLM Integration

- **Tasks**:
  - LLM task status display in popup
  - Automatic keyword generation
  - Random tab processing when idle

#### 2. Advanced Session Management

- **Tasks**:
  - Drag-and-drop to closed sessions
  - Automatic ownership takeover
  - Pinned tabs following active window
  - Session restoration dialogs with timeout

#### 3. New Tab Page Override

- **Task**: Replace new-tab-page with minimal Tabs UI
- **Reference**: Chrome Extension Override Pages API

### 🧪 Quality Assurance

**Status: "The needs of the many outweigh the needs of the few"**

#### 1. Testing

- **Task**: End-to-end test implementation
- **Complexity**: High
- **Priority**: Medium

#### 2. Monitoring

- **Tasks**:
  - Log collection system
  - Sync timestamp display
  - Performance monitoring

## Implementation Strategy

### Phase 1: Foundation (Weeks 1-4)

1. Real-time UI updates
2. Core refactoring tasks
3. Basic search enhancements

### Phase 2: Enhancement (Weeks 5-8)

1. Session management improvements
2. UI/UX polishing
3. Keyboard shortcuts

### Phase 3: Advanced (Weeks 9-12)

1. AI/LLM features
2. Advanced session operations
3. Testing implementation

## Success Metrics

- Reduced user clicks for common operations
- Improved session restoration reliability
- Enhanced search accuracy and speed
- Zero critical bugs in production

## Notes

- Keep each change small and apply diffs one-by-one
- Maximum 1000 lines per file, 80 lines per method
- Update ARCHITECTURE.md when implementing new concepts
- Regular commits with clear intent descriptions

---

_"Don't Panic" - The Hitchhiker's Guide to the Galaxy_

**Status**: Ready for implementation
**Last Updated**: Current stardate
**Captain's Log**: All systems operational, ready to engage warp drive on development tasks.
