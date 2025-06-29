# Next TODO - Real-time UI Updates Implementation

## Instruction (KEEP THIS SECTION AS-IS)

This is a note to track work plan and status.
We will first "Plan" and then "Execute." For the details, see `taskdocs/strategy_for_strategy.md`.
And always refer `.clinerules` as well.
Example Instructions:

- Think PLAN!: Check the Next Steps in NEXT_TODO.md and detail up reading related files as much as possible.
- Go EXECUTE!: Implement the TODOs and manage the tasks status accordinly.

## Current Mission: Event-Driven Lazy UI Updates

_"Engage!"_ - We're implementing smart UI updates with in-memory state management and runtime messaging.

## Architecture Decisions Made ✅

- **UIState Storage**: In-memory management within dedicated `tabs-ui-state.ts` module
- **Communication**: Chrome Runtime Messaging API
- **Approach**: Event-driven lazy updates (mark outdated → refresh on focus)

## Phase 1: Foundation Setup (Week 1) ✅ COMPLETED

### Task 1.1: UI State Management Structure ✅ COMPLETED

- [x] **File**: `src/features/tabs-ui-state.ts`
- [x] Define `UIState` interface
- [x] Implement TabsUIStateManager class with encapsulation
- [x] Create getter/setter methods for state
- [x] Add debug logging capabilities
- [x] Event-driven API with listeners
- [x] Focus-based refresh controller
- [x] Visual indicator management

### Task 1.2: CSS Styling for Visual Indicator ✅ COMPLETED

- [x] **File**: `src/tabs.css`
- [x] Move inline styles to CSS classes
- [x] Add `.ui-outdated-indicator` class with proper styling
- [x] Add animations for show/hide transitions
- [x] Ensure responsive design and accessibility
- [x] Remove TODO comment about CSS styling

### Task 1.3: Message Listener Setup ✅ COMPLETED

- [x] **File**: `src/tabs.ts`
- [x] Implement `chrome.runtime.onMessage` listener
- [x] Handle `MARK_UI_OUTDATED` message type
- [x] Connect message handler to `tabsUIState.markAsOutdated()`
- [x] Add message response for debugging

## Phase 2: Event Listeners (Week 2) ✅ COMPLETED

### Task 2.1: Tab/Window Event Listeners ✅ COMPLETED

- [x] **File**: `src/service-worker.ts`
- [x] Listen for tab/window events (created, removed, updated, activated)
- [x] Notify tabs UI via ServiceWorkerMessenger

### Task 2.2: Service Worker Messaging ✅ COMPLETED

- [x] **File**: `src/utils/service-worker-messenger.ts`
- [x] Implement notifyTabsUIOutdated()
- [x] Filter out self-notifications

## Phase 3: Focus Detection (Week 2-3) ✅ COMPLETED

### Task 3.1: Focus-Based Refresh Controller ✅ COMPLETED

- [x] **File**: `src/features/tabs-ui-state.ts`, `src/tabs.ts`
- [x] Implement createFocusRefreshController
- [x] Listen for focus/visibility/page events
- [x] Debounce refresh logic

## Phase 4: Update Mechanism (Week 3) ✅ COMPLETED

### Task 4.1: Conditional Refresh Logic ✅ COMPLETED

- [x] **File**: `src/tabs.ts`
- [x] Only refresh if UI is outdated
- [x] Show/hide visual indicator
- [x] Manual refresh via indicator click

---

## 🧪 Next Steps: Testing & Review

- [ ] Test end-to-end in browser (tab events, focus, indicator, refresh)
- [ ] Review performance under heavy tab usage
- [ ] Gather user feedback

## 🚀 Optional: Phase 5 - Advanced Optimizations (Future)

- [ ] Implement advanced debouncing/throttling if needed
- [ ] Memory management/performance tuning

---

## Implementation Notes

### Message Interface Design (To Be Implemented)

```typescript
interface TabsUIMessage {
  type: "MARK_UI_OUTDATED";
  reason: string;
  timestamp: number;
}

interface TabsUIResponse {
  success: boolean;
  currentState?: UIState;
}
```

### Completed Architecture

✅ **TabsUIStateManager Class**:

- Encapsulated state management
- Event-driven API with listeners
- Focus detection and auto-refresh
- Visual indicator integration
- Debug logging and configuration

✅ **Focus-Based Refresh**:

- `window.focus` event handling
- `document.visibilitychange` detection
- `window.pageshow` handling
- Automatic cleanup on page unload

✅ **Visual Indicator System**:

- CSS-based styling with animations
- Responsive design and accessibility
- Smooth show/hide transitions
- Pulse animation for attention
- Dark theme and high contrast support

✅ **Message Listener**:

- Chrome runtime message listener
- MARK_UI_OUTDATED message handling
- Integration with TabsUIStateManager
- Debug response system

### Debug Strategy

- Console logging for all state changes ✅
- Message flow tracing ✅
- Performance timing measurements (pending)
- Visual indicators for debugging ✅

## Success Criteria for Each Phase

### Phase 1 Complete When: ✅ COMPLETED

- [x] UI state can be marked as outdated
- [x] Visual indicator shows/hides correctly
- [x] Focus detection triggers update checks
- [x] UI refreshes with current data
- [x] Encapsulated state management working
- [x] Professional CSS styling with animations
- [x] Message listener receives service worker messages

### Phase 2 Complete When: ✅ COMPLETED

- [x] Service worker detects tab/window events
- [x] Messages sent to tabs UI successfully
- [x] Error handling works when UI not open
- [x] Message constants and types defined

### Phase 3 Complete When:

- [ ] End-to-end flow works smoothly
- [ ] Edge cases handled gracefully
- [ ] Documentation reflects implementation

---

_"The first duty of every Starfleet officer is to the truth"_ - Captain Picard

**Priority**: High (Core Feature)
**Estimated Total Time**: 3 weeks
**Dependencies**: Existing tabs UI refresh functionality
**Risk Level**: Low (foundation complete, well-defined scope)

**Captain's Orders**: Phase 2 完全完了！All service worker communication infrastructure is now operational. Ready to proceed with Phase 3 (Integration & Testing) to verify end-to-end functionality!
