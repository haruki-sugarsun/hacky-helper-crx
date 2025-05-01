# Session Management Constants Relocation Plan

## Overview

This task involves refactoring how we handle session management messages in the extension:

1. Remove the following constants from constants.ts:

   - CREATE_NAMED_SESSION
   - UPDATE_NAMED_SESSION_TABS
   - RENAME_NAMED_SESSION

2. Add these constants to service-worker-messages.ts where other session-related constants are already defined

3. Implement the equivalent messaging methods in service-worker-interface.ts:

   - createNamedSession()
   - updateNamedSessionTabs()
   - renameNamedSession()

4. Update all usages of these constants to use the new methods from service-worker-interface.ts

## Implementation Plan

### Phase 1: Analysis

- [x] Identify current implementation and usage of these constants
- [x] Examine how similar messaging is already implemented in service-worker-interface.ts
- [x] Determine the correct method signatures based on existing patterns

### Phase 2: Implementation

1. Move Constants:

   - [x] Remove constants from `/src/lib/constants.ts`
   - [x] Add them to `/src/features/service-worker-messages.ts`

2. Implement Interface Methods:

   - [x] Add createNamedSession() to ServiceWorkerInterface class
   - [x] Add updateNamedSessionTabs() to ServiceWorkerInterface class
   - [x] Add renameNamedSession() to ServiceWorkerInterface class

3. Add Handler Functions:

   - [x] Add handleCreateNamedSession() to service-worker-handler.ts
   - [x] Add handleUpdateNamedSessionTabs() to service-worker-handler.ts
   - [x] Add handleRenameNamedSession() to service-worker-handler.ts
   - [x] Add cases to handleServiceWorkerMessage switch statement

4. Update Service Worker:

   - [x] Update imports in service-worker.ts to import constants from new location
   - [x] Remove direct handling of these constants in service-worker.ts
   - [x] Ensure messages are forwarded to handleServiceWorkerMessage

5. Update Client-side Code:
   - [x] Find and update all usages to use the new ServiceWorkerInterface methods

### Phase 3: Testing

- [x] Test creating a named session
- [x] Test updating tabs in a named session
- [x] Test renaming a named session
- [x] Verify all functionality works as before

## Status Update - May 1, 2025

1. Constants were successfully moved from `constants.ts` to `service-worker-messages.ts`
2. Interface methods were implemented in `service-worker-interface.ts` following the established patterns
3. Handler functions were added to `service-worker-handler.ts` to process the messages
4. Service worker code was updated to use the new handlers instead of direct processing
5. Type consistency was improved across return types using `SuccessResult` and `ErrorResult` interfaces
6. All client-side code in `tabs.ts` has been updated to use the new service worker interface methods:
   - `promptCreateNamedSession` function
   - `updateSessionTabs` function 
   - `renameSession` function
   - `createNamedSessionButton` event listener
7. All functionality has been tested and verified to work correctly
8. **TASK COMPLETED** - All session management related constants have been relocated and all functionality has been properly migrated

## Reference Implementations

### Service Worker Interface Methods

For the methods in service-worker-interface.ts, we'll follow the pattern of existing methods:

```typescript
async methodName(parameters): Promise<ReturnType> {
  try {
    return await chrome.runtime.sendMessage({
      type: CONSTANT_NAME,
      payload: { /* parameters */ },
    });
  } catch (error) {
    console.error("Error in methodName:", error);
    // Return appropriate fallback or throw
  }
}
```

### Handler Functions

For the handler functions in service-worker-handler.ts, we'll follow this pattern:

```typescript
async function handleMethodName(
  message: { payload: { /* parameters */ } },
  sendResponse: (response?: ReturnType | ErrorResult) => void,
): Promise<void> {
  const { /* destructure parameters */ } = message.payload;

  if (!/* validate parameters */) {
    console.error("Parameter validation error");
    sendResponse({ error: "Parameter validation error message" });
    return;
  }

  try {
    const result = await SessionManagement.methodName(/* parameters */);
    sendResponse(/* format result */);
  } catch (error) {
    console.error("Error in handleMethodName:", error);
    sendResponse({ error: "Error message" });
  }
}
```

## Notes

- All three operations work with named sessions, which are stored and managed by the SessionManagement module
- The functionality should remain identical after the refactoring
- This change improves code organization, maintainability, and consistency
- Future message types should follow this pattern for consistency
