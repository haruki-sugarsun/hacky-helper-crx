# NEXT_TODO

## Instruction (KEEP THIS SECTION AS-IS)

This is a note to track work plan and status.
We will first "Plan" and then "Execute." For the details, see `taskdocs/strategy_for_strategy.md`.
And always refer `.clinerules` as well.

## Strategy and Next Steps (UPDATE THIS SECTION TO TRACK THE CURRENT STATUS)

- [ ] **Copy Page Title & URL Hotkey**
  - Merge functionality for retrieving the page title and URL into a single method, for example, `copyPageInfo()`.
  - Use Chrome extension commands in _service-worker.ts_ to capture the hotkey event (e.g., via `chrome.commands.onCommand`).
  - Forward the event from the service worker to the popup context via message passing. Detailed steps:
  - In _service-worker.ts_, listen for the hotkey event using `chrome.commands.onCommand`. When triggered, call `chrome.runtime.sendMessage` with a payload such as `{ action: "copyPageInfo", params: {} }`.
  - Alternatively, if the popup is not already open, consider using `chrome.action.openPopup()` and then pass parameters via messaging or temporary storage.
  - In _popup.ts_, set up a listener using `chrome.runtime.onMessage.addListener` to intercept messages with the action `"copyPageInfo"`. When such a message is received, invoke the `copyPageInfo()` function.
  - In _popup.ts_, implement `copyPageInfo()` to retrieve the current active tab’s title and URL (using chrome.tabs.query if necessary), concatenate them, and use `navigator.clipboard.writeText()` to copy the content.
  - Optionally update _popup.html_ to display a confirmation message upon successful copy.
