# Feature Dev Plans

## Named Session (browser window)

- A session/window can be named.
- A window remains "unnamed" unless explicitly named by the user.
- A named session must have a tabs.html as a pinned tab.
- and the tabs.html has the session name and ID encoded in the URL

- **Session Management**

  - Each browser window is identified and managed as a "Named Session."
  - The session data is temporarily stored in the `service-worker` in-memory storage.
  - The `Bookmark API` is used to persist session data in Chrome bookmarks for synchronization.
  - `session ID` is assigned as a UUID.

- **tabs.html Behavior**

  - `tabs.html` is pinned per Named Session.
  - The URL encodes the `session name` and `session ID` as query parameters.
  - If an existing `tabs.html` for the same session is open, it is selected instead of opening a new one.

- **Session Creation & Management**

  - A new Named Session can be created from the popup or settings page.
  - An existing browser window can be registered as a Named Session.
  - When a Named Session is deleted, the corresponding bookmark folder is also removed.

- **Bookmark Storage Structure**

  - A `Named Sessions` bookmark folder is created to store session data.
  - **Folder name format**: `<session name> (<session ID>)`
  - Each tab is stored as a bookmark inside the session folder (including title and URL).

- **Session Restoration**

  - On extension startup, Named Sessions are restored from bookmarks.
  - The `session ID` is extracted from the bookmark folder name and loaded into `service-worker`.
  - When the user restores a session, the saved tabs are reopened.

- **Tab Synchronization**
  - Any tab addition/removal is reflected in the `service-worker` in-memory storage.
  - The bookmark folder is updated in real-time to maintain synchronization.

## Bookmark as URL Store

- Bookmark chooser UI in settings.html.
- Config object in config_store.ts.
- Named sessions will be stored as bookmarks automatically, and
- Structure: [Bookmark Root] > [Named Sessions] > [Opened Pages]/[Kept Pages]
- A "Session" is a folder in Bookmark. and is a window in the browser, and a set of "Tabs".
- A "Tab" is a bookmark in Bookmark manager. associated with a title, URL.
- We can encode metadata in Bookmark titles as JSON.

## UI Language chooser

- Have a selection option in settings.
- Prepare Japanese and English prompts for necessary LLM integrations.

## Auto-Categorization

- Use embeddings to find automatic categorization
- Suggest reorganization of the tabs, or possible migration destination.
- e.g. Add a button to migrate a tab to another window/sesion, and show a dialog to select the destination. We can show the possible candidates based on the summary/keywords/embeddings.

## Update the LLM prompts

- to focus more on categorization, topic detection. We would like to improve the prompts
- Ability to choose language from English or Japanese.

## Provide an error indicator in popup and the extension icon.

- We may collect errors in the service-worker to let the user confirm it and invest.
- We don't need to collect the error logs themselves, as Chrome browser also provides such functionality.

# Fullfilled Dev Plans

## Disable heavy processing based on battery mode

- Added an easy toggle for power-consuming LLM services in the popup page
- Implemented automatic disabling of LLM services when the device is running on battery power
- Added battery status detection and display in the popup

## service-worker to manage LLM-based digests of the pages (per URL)

## tabs.html opened as a pinned Tab to tab UI.

- in tabs.html UI, We can ignore pinned tab.
- Instead, if the tabs.html is opened for a window, it becomes a pinned tab and behave as as representative tab of the window/session.
- When a tabs.html is opened, it checks the existence of other tabs.html in the same window. If another tabs.html is already opened, select it and close the extra one.
- Use the Chrome Extension's tabs and windows events to keep the UI updated.

## Side Panel Writer Support

- sidepanel.html has a dedicated chooser UI for LLM services (Ollama or OpenAI)
- Model selection based on the chosen LLM service
- Prepared prompts for various document writing scenarios
- Abstracted LLM service interface for consistent interaction with different providers
- Support for interacting with visible page content
