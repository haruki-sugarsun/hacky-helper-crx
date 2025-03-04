# Feature Dev Plans

## Named Session (browser window)

- A session/window can be named.

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

## Update the LLM prompts

- to focus more on categorization, topic detection. We would like to improve the prompts
- Ability to choose language from English or Japanese.

# Fullfilled Dev Plans

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
