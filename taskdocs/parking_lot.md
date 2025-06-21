## Fallback Strategy if No Next Steps

- Locate a TODO requiring minimal changes and work on it.
  - Use the command: <code>find _.html src/ _.md designdocs/ -type f | xargs grep TODO | shuf | head -n100</code>
  - Refer to PRIVATE_MEMO.md for additional ideas.

## Just Idea Parking Lot

We have unstructured, just-idea notes here:

- Tabs UI updates based on the window/tabs/sessions(open tabs/saved bookmarks) updates.
- Use some webfont for emojis?
- Make sure to generate keywords only for the generateKeywords function maybe by specifiying JSON output? -　Show the current LLMTasks status in the popup? e.g. number of the pending tasks, currently-running task etc.
- Open the sidepanel from popup.
- Hot key to trigger the sidepanel feature?
- Keeping pinned tabs feature following the active window. Refer the old Hacky-Tab-Enhancer impl.
- Support migrate to a closed Named Session. We may update the existing UI in Tabs UI or Popup with a search for named sessions.
- Improve session restoration on browser start. We can refer the sessionId in URL, but it is not working well yet.
- Action label for "force sync" session should say "to Backend".
- Replace the new-tab-page with the minimal UI like Tabs UI. ref: https://developer.chrome.com/docs/extensions/develop/ui/override-chrome-pages?hl=ja
- Allow migration to the closed named session. Migrated tab is just added to the Open Tab in the chosen (closed named) session.
- Add a flag for saved bookmarks and open them automatically when the session gets activated.
- In the search result, show the name of the session the open tab belongs to.
- Session Name should be reflected if updated by other instance. We can compare the timestamp metadata.
- Allow the user to rename the saved bookmarks.
- Search for the "saved bookmarks" as well.
- Close Window in the action menu in Tabs UI.
- Refactoring Tasks:
  - Replace config accesses to read values with CONFIG_RO.
  - Replace sendMessage usage with service-worker-interface.ts, service-worker-handler.ts, and service-worker-messages.ts.
  - Migrate message handlers from `service-worker.ts` to `service-worker-handler.ts` for better organization (as indicated by TODO comments).
- Search for the "saved bookmarks" as well.
- Close Window in the action menu in Tabs UI.
- Style in Settings UI.
- Reactivating the session restores the tabs owned by others, but won't take over the ownership. This can result in many dups. Consider automatically taking over them.
- Common modal behavior e.g. close on ESC.
- Session restoration should open the tabs owned by the current instance. Other synced open tabs can be open via "takeover". We may show a dialog with timeout to ask the user if they want to open or takeover others' tabs.
- end-to-end tests
- Toast message+log collection instead of alert, and timeout measurement stops while the focus is not on the window.
- Clear the query in the input on focus-search-bar key action.
- Search for entries matching the URL.
- Show Favicon in Tabs UI Tab list table.
- Show the last sync timestamp for sessions and diff timer.
- When there is no pending LLM task, pick up a random tab that is not yet cached?
- LLM task queueing should behave in LRU style?
- LLM Task queue should check the currently active tabs and remove the obsolete ones from the queue?
- Implement tab migration (including drag-and-drop) _to_ closed named sessions. This involves:
  - Backend logic in the service worker (`service-worker-handler.ts`, `session-management.ts`) to handle adding the tab data to the closed session's bookmark representation.
  - Potential UI updates (`tabs.ts`) to enable dropping onto closed session elements and provide appropriate user feedback (e.g., confirmation dialog).
- Fix: Improve message handler for `SYNC_SESSION_TO_BOOKMARKS` in `service-worker-handler.ts` to have better layer/wording for "Force Sync to Backend" (instead of Bookmark) functionality.
