# NEXT_TODO

## Instruction (KEEP THIS SECTION AS-IS)

This is a note to track work plan and status.
We will first "Plan" and then "Execute." For the details, see `taskdocs/strategy_for_strategy.md`.
And always refer `.clinerules` as well.
Example Instructions:

- Think PLAN!: Check the Next Steps in NEXT_TODO.md and detail up reading related files as much as possible.
- Go EXECUTE!: Implement the TODOs and manage the tasks status accordinly.

## Strategy and Next Steps

- Search for the "saved bookmarks" as well.
  - Implement GET_SAVED_BOOKMARKS in service-worker-interface.
    - Define a new constant `GET_SAVED_BOOKMARKS` in `src/features/service-worker-messages.ts`.
      - Add the constant `GET_SAVED_BOOKMARKS` with a descriptive string value, e.g., `"GET_SAVED_BOOKMARKS"`.
    - Create a method `getSavedBookmarks` in `src/features/service-worker-interface.ts`.
      - Implement the method to send a message using `chrome.runtime.sendMessage` with the `GET_SAVED_BOOKMARKS` constant.
      - Parse the response to extract the saved bookmarks.
      - Add error handling for cases like message failure or invalid responses.
    - Ensure the method communicates with the storage layer to retrieve bookmarks for all sessions.
      - Use `session-management.ts` to fetch bookmarks stored for all sessions.
      - Validate the data structure and handle corrupted or missing data gracefully.
  - Use the new method in search-functionality.ts to fetch saved bookmarks.
    - Import and call `getSavedBookmarks` from `src/features/service-worker-interface.ts`.
    - Integrate the method into the existing search pipeline by appending the fetched bookmarks to the search results.
    - Add unit tests to validate the integration, ensuring bookmarks are fetched and displayed correctly.
  - Filter bookmarks based on the search query.
    - Implement a filtering function `filterBookmarksByQuery` in `src/features/search-functionality.ts`.
      - Use a case-insensitive search to match bookmarks against the query string.
      - Ensure partial matches are included in the results.
    - Optimize the function for performance with large datasets.
      - Use efficient algorithms to minimize search time.
      - Add benchmarks to measure performance improvements.
    - Write tests to ensure accurate filtering.
      - Include edge cases like empty queries, special characters, and large datasets.
  - Add a "Saved Bookmarks" category in the search results UI.
    - Update the UI components to include a new category for "Saved Bookmarks."
    - Ensure the category is styled consistently with the existing UI.
    - Add tests to verify the UI changes.
  - Test the integration thoroughly.
    - Perform end-to-end testing to validate the entire flow.
    - Address any bugs or inconsistencies discovered during testing.
