This is a work stack. Take the top one and process it.

## Strategy to build a Strategy

- Read the related files as much as possible.
- Break down the plan in "Strategy and Next Steps" and add details as much as possible.
  - Refer the "Example Plan" for example steps.
- Repeat until we get to the confidence about what to do and where to change.
- Typically, start implementation with "Work on this. with checking whether each change plan is already done or not."

## Example Plan

1. (filename.ext) Define method `function a()`.
2. (filename.ext) Describe the behavior of the method `function a()` as unittest.
3. (filename.ext) In the method `function a()`, implement handling X.

## Strategy and Next Steps

### Implement Emoji Support Using Twemoji

1. (package.json) Add "twemoji" npm package dependency and "@types/twemoji" for TypeScript type definitions.
2. (src/lib/emoji-helper.ts) Create a new helper module for emoji rendering:
   - Implement a `renderEmoji` function to parse text and replace emoji characters with Twemoji SVGs/PNGs
   - Implement a `createEmojiElement` function to create an emoji element for a specific character
   - Add configuration options for size (SVG or PNG), CSS classes, etc.
3. (src/ui/session-label.ts) No changes needed for the "⋮" emoji in the menu button.
4. (src/tabs.ts) Update emoji usage in status indicators:
   - Replace "⭐", "✓", "⚠️" with Twemoji versions
5. (src/sidepanel.ts) Update emoji usage in status messages:
   - Replace "🚀", "✨", "🤔", "⏳", "😴", "🚫", "💤" with Twemoji versions
6. (tabs.html) Update emoji usage in the bookmark toggle button:
   - Replace "🔖" with Twemoji version
7. (src/style.css) Add CSS to properly style Twemoji elements.
8. (vite.config.js) Ensure Vite is configured to properly bundle the Twemoji package.
9. Test the implementation in Chrome to ensure consistent emoji rendering.

## Fallback Strategy if No No Next Steps

- Find a TODO which requires the smallest changes and work on the implementation.
  - You may use `find *.html src/ *.md designdocs/ -type f | xargs grep TODO | shuf | head -n100`
  - PRIVATE_MEMO.md also has ideas.

## Just Idea Parking Lot

We have unstructured, just-idea notes here:

- Drag-n-Drop for Tab Migrations.
- Tabs UI updates based on the window/tabs/sessions(open tabs/saved bookmarks) updates.
- Make sure to generate keywords only for the generateKeywords function maybe by specifiying JSON output? -　Show the current LLMTasks status in the popup? e.g. number of the pending tasks, currently-running task etc.
- Open the sidepanel from popup.
- Hot key to trigger the sidepanel feature?
- Keeping pinned tabs feature following the active window. Refer the old Hacky-Tab-Enhancer impl.
- Support migrate to a closed Named Session. We may update the existing UI in Tabs UI or Popup with a search for named sessions.
- Improve session restoration on browser start. We can refer the sessionId in URL, but it is not working well yet.
- Action label for "force sync" session should say "to Backend".
- Replace the new-tab-page with the minimal UI like Tabs UI. ref: https://developer.chrome.com/docs/extensions/develop/ui/override-chrome-pages?hl=ja
- Allow migration to the closed named session. Migrated tab is just added to the Open Tab in the chosen (closed named) session.
- Function and hotkey to copy the current page title+URL for easier sharing.
- Add a flag for saved bookmarks and open them automatically when the session gets activated.
- In the search result, show the name of the session the open tab belongs to.
- Session Name should be reflected if updated by other instance. We can compare the timestamp metadata.
- Allow the user to rename the saved bookmarks.
- Search for the "saved bookmarks" as well.
- Close Window in the action menu in Tabs UI.
- Refactoring Tasks:
  - Replace config accesses to read values with CONFIG_RO.
  - Replace sendMessage usage with service-worker-interface.ts, service-worker-handler.ts, and service-worker-messages.ts.
- Search for the "saved bookmarks" as well.
- Close Window in the action menu in Tabs UI.
- Style in Settings UI.
- Hotkey to open the SidePanel UI.

---

Refer .clinerules as well.
