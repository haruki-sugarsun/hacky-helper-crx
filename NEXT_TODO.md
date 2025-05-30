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
  - **Completed**: Define a new constant `GET_SAVED_BOOKMARKS` in `src/features/service-worker-messages.ts`.
  - **Completed**: Create a method `getSavedBookmarks` in `src/features/service-worker-interface.ts`.
  - **Completed**: Use the new method in `search-functionality.ts` to fetch saved bookmarks.
    - **Completed**: Import and call `getSavedBookmarks` from `src/features/service-worker-interface.ts`.
    - **Completed**: Integrate the method into the existing search pipeline by appending the fetched bookmarks to the search results.
    - **Pending**: Add unit tests to validate the integration, ensuring bookmarks are fetched and displayed correctly.
  - **Completed**: Filter bookmarks based on the search query.
    - **Completed**: Implement a filtering function `filterBookmarksByQuery` in `src/features/search-functionality.ts`.
      - **Completed**: Use a case-insensitive search to match bookmarks against the query string.
      - **Completed**: Ensure partial matches are included in the results.
    - **Pending**: Optimize the function for performance with large datasets.
      - Use efficient algorithms to minimize search time.
      - Add benchmarks to measure performance improvements.
    - **Pending**: Write tests to ensure accurate filtering.
      - Include edge cases like empty queries, special characters, and large datasets.
  - **Completed**: Add a "Saved Bookmarks" category in the search results UI.
    - **Completed**: Update the UI components to include a new category for "Saved Bookmarks."
    - **Pending**: Ensure the category is styled consistently with the existing UI.
    - **Pending**: Add tests to verify the UI changes.
  - **Pending**: Test the integration thoroughly.
    - Perform end-to-end testing to validate the entire flow.
    - Address any bugs or inconsistencies discovered during testing.
