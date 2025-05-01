# Implementation Plan: DELETE_NAMED_SESSION in service-worker-interface

## Objective

Move the DELETE_NAMED_SESSION message handling from service-worker.ts to the structured approach using service-worker-interface.ts, service-worker-handler.ts, and service-worker-messages.ts.

## Current Implementation

Currently, DELETE_NAMED_SESSION is directly handled in service-worker.ts without going through the service-worker-interface abstraction layer. We need to refactor this to use the proper architecture.

## Implementation Steps

### 1. Update service-worker-messages.ts

Add the DELETE_NAMED_SESSION constant to the exported message types in service-worker-messages.ts.

### 2. Update service-worker-interface.ts

Implement a new method `deleteNamedSession(sessionId: string)` in the ServiceWorkerInterface class that will:

- Send a message with type DELETE_NAMED_SESSION to the service worker
- Handle the response appropriately
- Return a Promise that resolves to a SuccessResult or ErrorResult

### 3. Update service-worker-handler.ts

Add a new handler function `handleDeleteNamedSession` to process DELETE_NAMED_SESSION messages by:

- Extracting the sessionId from the message payload
- Calling the SessionManagement.deleteNamedSession method
- Sending back an appropriate response

### 4. Update service-worker.ts

Refactor the existing DELETE_NAMED_SESSION case in service-worker.ts to use the handleServiceWorkerMessage function instead of direct handling.

## Testing Strategy

- Verify that the DELETE_NAMED_SESSION functionality works through the service-worker-interface
- Ensure that both active and closed sessions can be deleted properly
- Check for any error cases and ensure they're handled appropriately

## Success Criteria

- DELETE_NAMED_SESSION messages are properly processed via the service-worker-interface
- No changes to the user-facing behavior of deleting sessions
- Code follows the established pattern for service worker message handling
