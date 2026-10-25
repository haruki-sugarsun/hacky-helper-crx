# Task: Suggest Titles for Unnamed Sessions

## Description

Use the configured LLM to suggest a concise title for an unnamed browser
window from the summaries cached for its current tabs. The suggestion is a
presentation-only label in the Tabs UI; it must not create, rename, or persist
a named session.

## Strategy and Next Steps

1. **Collect source context**
   - Query the non-pinned tabs for the unnamed window in the service worker.
   - Read the most recent cached digest for each supported tab URL.
   - Combine tab titles and summaries into bounded prompt input.

2. **Generate and normalize the suggestion**
   - Add a dedicated prompt requiring a short title with no explanation.
   - Normalize model output by removing markdown fences, quotes, trailing
     punctuation, excess whitespace, and content beyond the character limit.
   - Return an empty suggestion when no cached summaries are available or the
     LLM request fails.

3. **Connect the Tabs UI**
   - Add a typed service-worker message and interface method for requesting a
     title by window ID.
   - Display the generated title for unnamed windows while preserving the
     existing `Window <id>` fallback.
   - Keep named-session labels and session selection identifiers unchanged.

4. **Control request cost and freshness**
   - Cache suggestions by window ID and a fingerprint of the current summary
     inputs.
   - Deduplicate concurrent requests for the same window.
   - Regenerate when the summaries change.

5. **Test and document**
   - Add unit tests for prompt construction and title normalization.
   - Verify that disabled or unavailable LLM services degrade to the window
     label without interrupting the UI.
   - Keep the architecture, design, development-plan, and agent workflow
     documentation aligned with the presentation-only behavior.

## Status

- [x] Service-worker title suggestion flow implemented.
- [x] Tabs UI fallback and non-persistent display implemented.
- [x] Request caching and concurrent-request deduplication implemented.
- [x] Unit tests added.
- [x] Project documentation updated.

## Implementation Notes

- Unnamed session title suggestions use cached tab summaries and are presentation-only.
- LLM failures, disabled LLM services, and missing summaries fall back to the existing window label.
- Suggestions are cached and request-deduplicated in the service worker to limit repeated processing.
- This flow intentionally passes the active `LLMService` from the service worker into the
  message handler. It follows the longer-term design in which all LLM processing is
  centralized in the service worker.

## Verification

- `npm test` — all tests pass.
- `npm run build` — TypeScript compilation and Vite build pass.

## Follow-up Considerations

- Consider exposing a user setting to disable title suggestions independently
  of other LLM features.
- Consider adding an explicit loading indicator if title generation latency
  becomes noticeable in the Tabs UI.
- Refresh the service-worker-owned `LLMService` instance when LLM configuration
  changes so future requests use the new provider settings without a separate
  initialization path in UI code.
