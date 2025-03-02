# Feature Dev Plans

## Named Session (browser window)
* A session/window can be named.


## Bookmark as URL Store
* Bookmark chooser UI in settings.html.
* Named sessions will be stored as bookmarks automatically, and 
* Structure: [Bookmark Root] > [Named Sessions] > [Opened Pages]/[Kept Pages]

## UI Language chooser
* Have a selection option in settings.
* Prepare Japanese and English prompts for necessary LLM integrations.

## Auto-Categorization
* Use embeddings to find automatic categorization
* Suggest reorganization of the tabs, or possible migration destination.

## Update the LLM prompts
- to focus more on categorization, topic detection.


# Fullfilled Dev Plans 
## service-worker to manage LLM-based digests of the pages (per URL)

## tabs.html opened as a pinned Tab to tab UI.
* in tabs.html UI, We can ignore pinned tab.
* Instead, if the tabs.html is opened for a window, it becomes a pinned tab and behave as as representative tab of the window/session.
* When a tabs.html is opened, it checks the existence of other tabs.html in the same window. If another tabs.html is already opened, select it and close the extra one.
* Use the Chrome Extension's tabs and windows events to keep the UI updated.
