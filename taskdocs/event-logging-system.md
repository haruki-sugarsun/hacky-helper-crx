# Event Logging System — Implementation Design & Plan

## Mission

Provide a lightweight, privacy-conscious, reliable event logging system shared between extension pages (tabs.html, popup.html, sidepanel.html, etc.) and the service worker so developers can record UI actions, important events, errors, timing measurements, and optional telemetry for debugging and performance analysis.

Goals

- Capture structured events with levels (debug/info/warn/error) and contextual metadata.
- Make logs available locally to extension pages and the service worker.
- Provide simple retention, filtering, and export facilities (JSON download).
- Keep privacy-first: do not exfiltrate PII by default; require explicit opt-in for sending to external servers.
- Minimal runtime overhead and graceful degradation on low storage.

## Requirements (extracted)

- Centralized, shared event log accessible from service worker and extension pages.
- Structured event schema and message types for reporting logs across contexts.
- Local persistence (chrome.storage.local) with size and retention policy.
- Querying API to read logs and basic filters (level, time range, type).
- UI to view logs (simple log viewer page or sidepanel) and ability to export logs.
- Test coverage for core components (state, storage, messaging).
- Privacy controls and opt-in for external telemetry.

## Contract (2–4 bullets)

- Inputs: structured events posted from any extension context: {type, level, message, ts, meta}
- Outputs: append-only local log store; query responses; exported JSON file
- Error modes: storage full/denied, message failures — degrade to in-memory buffer and notify consumers
- Success: logs persisted within retention limits and retrievable via API

## Data Model (schema)

```ts
interface EventLogEntry {
  id: string; // uuid
  ts: number; // epoch ms
  level: "debug" | "info" | "warn" | "error";
  type: string; // event category e.g. "TAB_CREATED", "UI_OUTDATED"
  message?: string; // human-friendly short message
  context?: Record<string, unknown>; // small contextual payload
  source?: "service-worker" | "tabs" | "popup" | "sidepanel" | string;
}
```

Meta constraints:

- Context value size limit: 4 KB per event (truncate larger fields)
- Max events stored: configurable (default: 10,000 entries)
- Retention window: configurable (default: 14 days)

## High-level Architecture

- Single authoritative store managed by the service worker.
  - Service worker keeps an in-memory ring buffer and mirrors to `chrome.storage.local` periodically.
  - Other contexts (tabs, popup, sidepanel) post messages to service worker to append log events.
  - For pages that might be closed, fallback to local in-page queue + send on visibilitychange/unload.
- Expose messaging API (`service-worker-messages.ts`) with message types for `LOG_EVENT`, `QUERY_LOGS`, `CLEAR_LOGS`, `EXPORT_LOGS`, `SET_LOGGING_CONFIG`.
- UI components use `serviceWorkerInterface` wrapper to send/receive logs and query results.

## Message Types (service-worker-messages.ts)

- LOG_EVENT
  - payload: EventLogEntry (without id or ts permitted)
  - response: { success: boolean, id?: string }
- QUERY_LOGS
  - payload: { level?: string[], type?: string[], fromTs?: number, toTs?: number, limit?: number, offset?: number }
  - response: { success: boolean, entries: EventLogEntry[], total: number }
- CLEAR_LOGS
  - payload: { } or { beforeTs?: number }
  - response: { success: boolean }
- EXPORT_LOGS
  - payload: same as QUERY_LOGS or empty
  - response: { success: boolean, url?: string } // url is blob URL served by extension page
- SET_LOGGING_CONFIG
  - payload: { enabled: boolean, maxEntries?: number, retentionMs?: number, allowExternalUpload?: boolean }
  - response: { success: boolean }

## Storage & Persistence

- Primary persistence: `chrome.storage.local` under key `EVENT_LOG_STORE`.
- On startup, service worker loads persisted logs (up to `maxEntries`) into buffer.
- On `storage` errors (quota), implement eviction policy (oldest-first) and emit a warn-level log about eviction.

## Batching & Throttling

- Append requests are accepted immediately and buffered.
- Writes to storage in background.
- High-frequency events should be sampled or coalesced by source (configurable sampling).

## APIs / Helper Utility

- serviceWorkerInterface.logEvent(type, level, message, context, source) -> { success, id }
- serviceWorkerInterface.queryLogs(filters) -> { entries, total }
- serviceWorkerInterface.exportLogs(filters) -> Blob/URL
- local `Log` helper for pages: provide `log.info(...)`, `log.error(...)` which send messages; when service worker not available, use fallback local queue and attempt to send later.

## UI: Log Viewer (taskdoc plan)

- Add new page `logview.html` (already present in repo) and `logview.ts` to query and render logs.
- Features:
  - Filter by level, type, time range, free-text search on message/context
  - Pagination (limit/offset) for large logs
  - Highlight errors and collapsed context JSON viewer
  - Export button (JSON)
  - Simple toast for "logs cleared" or "export ready"

## Privacy & Security

- Default: do not upload logs outside the local extension.
- If `allowExternalUpload` is enabled by user, allow export/upload to configured endpoint with explicit consent.
- Redact common PII keys in `context` (e.g., email, password, token, authorization) by default.
- Limit context blobs to safe types (string, number, boolean, small arrays/objects).
- Persist only event metadata and small context fields; avoid full request/response bodies.

## Error Handling & Edge Cases

- Service worker absent/unavailable: pages buffer events locally (in-memory) and resend on visibilitychange or when receiving a heartbeat from the service worker.
- Storage quota errors: evict oldest entries, notify UI via a warn-level log.
- Extremely large events: truncate and emit a warn-level log indicating truncation.

## Testing Plan

- Unit tests (vitest):
  - `LogStore` behavior — append, eviction, retention trimming
  - `serviceWorker` handlers for LOG_EVENT and QUERY_LOGS
  - Message serialization/validation
- Integration tests (manual / headful):
  - Append events from popup / tabs / service worker and verify visibility in `logview.html`.
  - Simulate storage quota and verify eviction and warnings.
- Smoke test: generate many debug events, check write batching and UI responsiveness.

## Implementation Roadmap — Step-by-step

1. Add message types and TS interfaces
   - Files: `src/messages/service-worker-logging-messages.ts`
   - ETA: 1–2 hours
2. Implement LogStore utility (in `src/lib/event-log-store.ts`)
   - Responsibilities: in-memory ring buffer, persistence to chrome.storage.local, eviction, retention trimming
   - ETA: 4–6 hours
3. Wire service worker handlers (in `src/service-worker-handler.ts` or `src/service-worker.ts`)
   - Handle LOG_EVENT, QUERY_LOGS, CLEAR_LOGS, EXPORT
   - Provide batched write flush
   - ETA: 3–5 hours
4. Implement `serviceWorkerInterface` client helpers
   - Add `logEvent`, `queryLogs`, `exportLogs` wrappers to `src/features/service-worker-interface.ts` (or existing wrapper)
   - ETA: 1–2 hours
5. Implement `logview.html` + `src/logview.ts` UI
   - Query and render logs, filters, export
   - ETA: 6–8 hours
6. Add privacy controls in `settings.html` -> `SET_LOGGING_CONFIG`
   - ETA: 1–2 hours
7. Tests & validation
   - Add unit tests for `event-log-store` and message handlers
   - ETA: 3–4 hours

Total estimate: ~20–28 hours (split across 3–5 working days)

## Files to add / edit (concrete)

- Add: `src/lib/event-log-store.ts` — core storage helper
- Add: `src/messages/service-worker-logging-messages.ts` — message types & interfaces
- Edit: `src/service-worker.ts` or `src/service-worker-handler.ts` — handlers + initialization
- Edit: `src/features/service-worker-interface.ts` — client wrapper APIs
- Add: `src/logview.ts` & update `logview.html` — UI for logs
- Edit: `src/taskdocs` (this doc)
- Add: `test/event-log-store.test.ts` and handler tests

## Acceptance Criteria / Success Metrics

- [ ] Logs can be generated from pages and service worker and appear in `logview.html` within 2s
- [ ] Storage retention and maxEntries enforceable and tested
- [ ] Export and clear operations work reliably
- [ ] No PII is exfiltrated by default; opt-in required for external uploads
- [ ] Unit tests for core components pass

## Quick Implementation Snippets

- Example: client-side log helper

```ts
// pages
function sendLog(type, level, message, context = {}) {
  chrome.runtime.sendMessage({
    type: "LOG_EVENT",
    payload: { type, level, message, context },
  });
}
```

- Example: service-worker handler (pseudo)

```ts
chrome.runtime.onMessage.addListener(async (msg, _sender, sendResponse) => {
  if (msg?.type === "LOG_EVENT") {
    const entry = LogStore.normalizeAndAppend(
      msg.payload,
      msg.source || "page",
    );
    sendResponse({ success: true, id: entry.id });
  }
});
```

## Next Steps (what I can do now)

- Implement `src/lib/event-log-store.ts` and wire minimal handlers in the service worker for `LOG_EVENT` + `QUERY_LOGS` and add the client helper in `service-worker-interface`.
- Optionally, create `logview.ts` skeleton that queries logs and renders a simple list.

If you want, I will implement the first two items now (LogStore + basic handlers) and run unit tests. Which would you like me to start with?
