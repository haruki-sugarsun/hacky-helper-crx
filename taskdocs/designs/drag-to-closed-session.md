# Drag-to-Closed-Session — Design Doc

Status: Draft
Authors: (you)
Created: 2025-12-19

## Summary

Enable dragging one or more open tabs from the active tabs table into a closed (named) session in the sessions list. Dropping tabs onto a closed session will add those tabs to the session's "opened tabs" (so they are recorded in the session bookmark/representation) and then close the original tabs in the browser window.

This document defines UX, data model changes, messaging contracts, error handling, and testing acceptance criteria so engineers can implement the feature consistently.

## Goals

- Primary: Support drag-to-closed-session that appends tab summaries to the target session and closes the dragged tabs.
- Safety: Do not lose tabs silently; provide clear user feedback on success/failure and safe rollback when possible.
- Compatibility: Handle multi-tab drags, pinned/incognito tabs, and behavior with multiple instances.

## Non-goals

- Automatically opening migrated tabs when reactivating a session (separate feature).

## UX Flow

1. User selects one or more tabs in the right-hand tabs table (or drags directly from the table row(s)).
2. User drags to a closed session entry in the left-hand sessions list.
3. While dragging over a closed session, that session shows a clear visual highlight and a tooltip: "Drop to add to session and close tabs".
4. On drop, the UI shows a transient pending state on the target session (spinner/overlay) and sends `MIGRATE_TABS_TO_CLOSED_SESSION_REQUEST` to the service worker.
5. Worker validates and updates session storage. On success, the worker responds success; the UI then attempts to close the original tabs. If the UI cannot close tabs (insufficient permissions or other failure), it displays a toast: "Tabs added to session; failed to close X tab(s)." If close succeeds, show toast: "Moved N tab(s) to session 'NAME' and closed them."

### Optional confirmation behavior

- Default: Instant action with undo toast (preferred for flow speed). Provide an "Undo" action on the toast to reopen closed tabs (re-open via chrome.tabs.create using saved URL list). The undo window can be ~5–10s.
- Alternative: Show confirmation dialog for multi-tab drags > 5 (if UX requires explicit consent).

## Visuals / Microcopy

- Session hover text: "Drop to add to session and close tabs"
- Pending state: small spinner next to session name: "Adding..."
- Success toast: "Moved 3 tabs to session 'Research' — Closed." [Undo]
- Failure toast: "Failed to move tabs: <reason>. Tabs unchanged."

## Message Contract (UI <-> Service Worker)

Request: `MIGRATE_TABS_TO_CLOSED_SESSION_REQUEST`
- payload: {
  sessionId: string,
  tabs: Array<{ tabId?: number, url: string, title?: string, favIconUrl?: string, pinned?: boolean }>,
  requestId?: string,
  originInstanceId?: string
}

Response: `MIGRATE_TABS_TO_CLOSED_SESSION_RESPONSE`
- payload: {
  requestId?: string,
  success: boolean,
  addedCount?: number,
  addedTabSummaries?: Array<{ url:string, title?:string, favIconUrl?:string, timestamp:number }>,
  errors?: string[],
  notes?: string
}

Notes:
- The worker should not attempt to close browser tabs unless the architecture already uses worker-initiated `chrome.tabs.remove`. Prefer UI-initiated close after a success response to avoid permission/context complexity.

## Data Model Changes

- Session record: ensure closed session objects expose an `openedTabs` or `openTabs` array that can accept appended TabSummary entries.

Example TabSummary:
{
  url: string,
  title?: string,
  favIconUrl?: string,
  pinned?: boolean,
  timestamp: number,
  originInstanceId?: string
}

- Migration note: If storage schema needs migration, include versioned migration steps in `session-management.ts`.

## Service Worker Handler

Handler name: `handleMigrateTabsToClosedSession(request)`

Flow:
1. Validate `sessionId` exists and not a currently-open session (we only allow closed named sessions as targets by UX).
2. Normalize tab summaries: dedupe by normalized URL (optional config flag).
3. Append tab summaries to session's `openedTabs` with timestamps and `originInstanceId`.
4. Persist storage atomically (as atomic as the storage API allows); if write fails, return failure and do not instruct tab closing.
5. On success, return list/ack that UI can use to close tabs and to construct undo data (urls + positions).

Error handling:

- If session not found: return error and UI should show "Session not found".
- If storage quota exceeded: return error; UI should not close tabs and should show instructions to retry or free space.

## Who Closes Tabs?

Recommendation: UI (client) should call `chrome.tabs.remove(tabIds)` after receiving a successful response from the worker. Reasons:

- Avoids potential service-worker permission/context issues.
- Keeps UX control for optimistic updates and undo flows.

Implementation detail:

- Worker returns `addedTabSummaries` and `requestId`. UI calls `chrome.tabs.remove(tabIds)` and then shows toast with Undo that can `chrome.tabs.create` for saved URLs if user presses Undo.

## Edge Cases & Decisions

- Pinned tabs: do not close pinned tabs by default. Options:
  - Disallow dragging pinned tabs (show tooltip: "Pinned tabs cannot be moved").
  - Or, allow adding to session but leave pinned tab open. Make this configurable.
- Incognito tabs: disallow migrating incognito tabs; show a warning.
- Duplicate tabs in session: choose dedupe strategy. Default: allow duplicates; later add dedupe by normalized URL option.
- Multiple instances: include `originInstanceId` metadata.

## Undo behavior

- On successful close, show toast with Undo. Undo will re-open the saved URLs in the original order. If pages had stateful data (POST forms), undo cannot restore that state; document the limitation.

## Permissions & Manifest

- UI must have `tabs` permission to call `chrome.tabs.remove` and `chrome.tabs.create` for undo.
- Ensure message handlers are registered in `service-worker-handler.ts`.

## Tests & QA Checklist

- Unit tests:
  - Handler appends correct TabSummary objects.
  - Handler fails cleanly on missing session or storage errors.

- Integration tests (manual/automated):
  - Single tab drag to closed session — session updated, tab closed.
  - Multi-tab drag (2..10) — session updated, tabs closed.
  - Drag with pinned tab — pinned preserved or action blocked per config.
  - Incognito tab drag — blocked with warning.
  - Worker offline: UI shows retry/failure state and does not close tabs.
  - Undo action: reopens closed tabs in order.

## Acceptance Criteria

- Feature implemented and wired end-to-end.
- Unit tests for worker handler added.
- Manual QA checklist passed for common cases.
- Updated docs: `ARCHITECTURE.md` notes + this design doc (finalized in PR).

## Rollout / Migration Plan

- Ship behind a feature flag if desired.
- If data model change is required, include migration steps and fallback for older versions.

## Next Steps

1. Review and confirm UX decisions (confirmation vs undo, pinned behavior).
2. Implement service-worker handler and session store changes.
3. Add drag-and-drop UI affordances and messaging.
4. Add tests and perform QA.

---
Notes: This file is intended to be iterative; update as implementation details refine.
