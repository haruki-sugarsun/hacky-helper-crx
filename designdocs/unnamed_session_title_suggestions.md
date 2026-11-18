# Unnamed Session Title Suggestions

## Status

Implemented. The Tabs UI displays a generated label for an unnamed window as a presentation-only suggestion; it does not create or rename a session.

## Behavior

- The service worker collects cached summaries from eligible, unpinned tabs in the requested window and asks the configured LLM for a concise title.
- It caches suggestions by window and summary fingerprint and deduplicates concurrent requests.
- If no cached summaries are available, LLM processing is disabled, or generation fails, the UI falls back to `Window <id>`.
- The generated label is used in the unnamed-session list and as the selected window's session summary. It is not persisted as a session name.

## Canonical Design and Task Records

- `designdocs/tabs_ui.md` documents the Tabs UI behavior.
- `designdocs/concepts.md` records that unnamed windows remain unnamed in storage.
- `taskdocs/unnamed_session_title_suggestion.md` documents implementation details, tests, and follow-up considerations.
