# NEXT_TODO

## Instruction (KEEP THIS SECTION AS-IS)

This is a note to track work plan and status.
We will first "Plan" and then "Execute." For the details, see `taskdocs/strategy_for_strategy.md`.
And always refer `.clinerules` as well.
Example Instructions:

- Think PLAN!: Check the Next Steps in NEXT_TODO.md and detail up reading related files as much as possible.
- Go EXECUTE!: Implement the TODOs and manage the tasks status accordinly.

## Strategy and Next Steps

- **Plan**: Focus on detecting and updating the session title during initialization or when the session's title changes.

  - During initialization in `src/tabs.ts`, fetch the session associated with the current window and set the title.
  - Notify the Tabs UI of session name changes from `session-management.ts`.
  - Defer the implementation of the `chrome.runtime.onMessage` approach for session name updates to another PR.

- **Execute**:

  1. Add logic in `src/tabs.ts` to fetch and set the session title during initialization.
  2. Implement a notification mechanism in `session-management.ts` to inform the Tabs UI of session name changes.
  3. Defer the `chrome.runtime.onMessage` approach for session name updates to a future PR.
  4. Test the changes to confirm the session title updates correctly during initialization and on title changes.

- **Verify**: Ensure the session title updates dynamically and accurately in the Tabs UI during initialization and on title changes.
