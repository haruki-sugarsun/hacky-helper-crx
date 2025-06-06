# Real-time UI Updates - Detailed Implementation Plan

## Mission Brief

_"The needs of the many outweigh the needs of the few... and the needs include efficient UI updates."_

Implement smart UI updates for Tabs UI that mark content as "outdated" on tab/window events and refresh when the UI regains focus.

## Technical Strategy

### Approach: Event-Driven Lazy Updates

Instead of continuous real-time updates, we'll use a two-phase approach:

1. **Event Detection**: Mark UI as outdated on tab/window changes
2. **Focus-Based Refresh**: Update UI when Tabs UI regains focus

This approach provides better performance while maintaining user experience.

## Implementation Breakdown

### Phase 1: State Management (Week 1)

**Status: Foundation**

#### Task 1.1: Outdated State Flag

- **File**: `src/tabs.ts` or relevant UI state management
- **Implementation**:
  - Add `isOutdated: boolean` flag to UI state
  - Add `lastUpdateTimestamp: number` for debugging
  - Create getter/setter methods for outdated state

#### Task 1.2: Visual Indicator

- **File**: `src/tabs.html` / `src/tabs.css`
- **Implementation**:
  - Add visual indicator (e.g., subtle banner or icon) when UI is outdated
  - Style with appropriate colors/animations
  - Ensure accessibility compliance

### Phase 2: Event Listeners (Week 2)

**Status: Event Detection**

#### Task 2.1: Tab Event Listeners

- **File**: `src/service-worker.ts` or `src/service-worker-handler.ts`
- **Events to Monitor**:
  - `chrome.tabs.onCreated`
  - `chrome.tabs.onRemoved`
  - `chrome.tabs.onUpdated`
  - `chrome.tabs.onMoved`
  - `chrome.tabs.onActivated`

#### Task 2.2: Window Event Listeners

- **File**: Same as above
- **Events to Monitor**:
  - `chrome.windows.onCreated`
  - `chrome.windows.onRemoved`
  - `chrome.windows.onFocusChanged`

#### Task 2.3: Session Event Listeners

- **File**: Extension-specific session management
- **Events to Monitor**:
  - Session creation/deletion
  - Bookmark sync events
  - Session metadata changes

### Phase 3: Focus Detection (Week 2-3)

**Status: UI Refresh Trigger**

#### Task 3.1: Tabs UI Focus Detection

- **File**: `src/tabs.ts` (JavaScript for tabs.html)
- **Implementation Details**:
  - Listen for `window.focus` event on tabs.html window
  - Listen for `document.visibilitychange` event for tab switching
  - Handle `window.pageshow` event for back/forward navigation
  - Implement debouncing to avoid excessive updates (100ms delay)
  - Special handling for extension tab being activated vs just gaining focus

**Example Implementation:**

```typescript
// In tabs.ts
let focusDebounceTimer: number | null = null;

function setupFocusListeners() {
  // Window focus (extension tab becomes active window)
  window.addEventListener("focus", handleFocusEvent);

  // Visibility change (extension tab becomes visible tab)
  document.addEventListener("visibilitychange", handleVisibilityChange);

  // Page show (back/forward navigation)
  window.addEventListener("pageshow", handlePageShow);
}

function handleFocusEvent() {
  debouncedUpdateCheck("window-focus");
}

function handleVisibilityChange() {
  if (!document.hidden) {
    debouncedUpdateCheck("visibility-change");
  }
}

function debouncedUpdateCheck(reason: string) {
  if (focusDebounceTimer) {
    clearTimeout(focusDebounceTimer);
  }

  focusDebounceTimer = window.setTimeout(() => {
    checkAndUpdateIfOutdated(reason);
    focusDebounceTimer = null;
  }, 100);
}
```

### Phase 4: Update Mechanism (Week 3)

**Status: Smart Refresh**

#### Task 4.1: Conditional Update Logic

- **File**: `src/tabs.ts`
- **Implementation**:

```typescript
async function checkAndUpdateIfOutdated(reason: string) {
  if (uiState.isOutdated) {
    console.log(`Refreshing UI due to: ${reason}`);
    uiState.refreshInProgress = true;
    showRefreshIndicator();

    try {
      await refreshTabsData();
      setOutdated(false, []);
      hideOutdatedIndicator();
    } catch (error) {
      console.error("Failed to refresh tabs data:", error);
      // Keep outdated state, show error indicator
    } finally {
      uiState.refreshInProgress = false;
      hideRefreshIndicator();
    }
  }
}
```

#### Task 4.2: Efficient Data Fetching

- **File**: Data management layer
- **Implementation**:
  - Implement incremental updates where possible
  - Cache comparison to minimize DOM manipulation
  - Background pre-loading when appropriate

### Phase 5: Optimization (Week 4) - **OPTIONAL**

**Status: Performance Tuning - Can be implemented later**

#### Task 5.1: Advanced Debouncing & Throttling - **OPTIONAL**

- **Priority**: Low (implement after core functionality is stable)
- **Implementation**:
  - Advanced debounce patterns for different event types
  - Intelligent throttling based on system performance
  - Smart batching of multiple events
  - Adaptive delay timing based on usage patterns

#### Task 5.2: Memory Management - **OPTIONAL**

- **Priority**: Low (implement if performance issues arise)
- **Implementation**:
  - Advanced cleanup strategies
  - Memory leak detection and prevention
  - Data structure optimization
  - Background garbage collection hints

## Technical Details

### Event Flow

```
Tab/Window Change → Mark UI Outdated → Show Indicator
                                    ↓
Tabs UI Focus Gained → Check Outdated Flag → Refresh if Needed
```

### State Structure

```typescript
interface UIState {
  isOutdated: boolean;
  lastUpdateTimestamp: number;
  outdatedReasons: string[]; // For debugging
  refreshInProgress: boolean;
}
```

### Configuration Options

```typescript
interface UpdateConfig {
  debounceDelay: number; // Default: 100ms
  maxOutdatedTime: number; // Force refresh after X minutes
  enableVisualIndicator: boolean; // Default: true
  enableDebugLogging: boolean; // Default: false
}
```

## Implementation Priority

### Core Implementation (Required)

1. **Phase 1**: State Management - Essential foundation
2. **Phase 2**: Event Listeners - Core functionality
3. **Phase 3**: Focus Detection - User experience critical
4. **Phase 4**: Update Mechanism - Complete the feature

### Optional Optimizations (Later)

5. **Phase 5**: Advanced optimizations - Performance tuning when needed

## User Experience Considerations

### Visual Feedback

- Subtle "outdated" indicator (not intrusive)
- Smooth transition when refreshing
- Loading state during refresh

### Performance Targets

- < 100ms refresh time for typical tab sets
- < 10MB memory footprint
- Minimal impact on browser performance

## Testing Strategy

### Unit Tests

- State management functions
- Event listener registration/cleanup
- Focus detection logic

### Integration Tests

- End-to-end event flow
- Multiple window scenarios
- Session sync integration

### Performance Tests (Optional)

- Memory usage over time
- Update frequency under heavy tab usage
- Browser responsiveness impact

## Success Metrics

### Core Functionality Metrics

- UI marks as outdated when events occur
- UI refreshes correctly on focus
- Zero missed updates when returning to UI
- Basic performance acceptable

### Optional Performance Metrics (Phase 5)

- Reduced CPU usage compared to real-time updates
- Improved battery life on mobile devices
- Advanced performance optimizations

## Risk Mitigation

### Potential Issues

1. **Missed Events**: Implement event queue backup
2. **Focus Detection Failures**: Add manual refresh button
3. **Performance Degradation**: Monitor and implement Phase 5 if needed

### Fallback Strategy

- Manual refresh button always available
- Automatic fallback to polling if events fail
- User preference to disable smart updates

## Dependencies

### Chrome APIs

- `chrome.tabs.*` events
- `chrome.windows.*` events
- Web API: `visibilitychange`, `focus`, `pageshow` events

### Internal Dependencies

- Session management system
- UI state management
- Service worker message handling

## Completion Criteria

### Core Feature Complete

- [ ] UI marks as outdated on relevant events
- [ ] Visual indicator appears when outdated
- [ ] Tabs UI refreshes on focus with current data
- [ ] Basic tests pass
- [ ] Documentation updated

### Optional Optimizations (Phase 5)

- [ ] Advanced debouncing implemented
- [ ] Memory management optimized
- [ ] Performance targets met
- [ ] Advanced performance tests pass

---

_"Make it so, Number One"_ - Core functionality first, optimizations when needed!

**Status**: Detailed plan ready for execution
**Complexity**: Medium (core), Low (optimizations)
**Estimated Timeline**: 3 weeks (core) + 1 week (optional optimizations)
**Captain's Assessment**: Practical approach - establish working foundation before pursuing perfection.
