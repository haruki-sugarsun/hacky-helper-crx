# NEXT_TODO

## Instruction (KEEP THIS SECTION AS-IS)

This is a note to track work plan and status.
We will first "Plan" and then "Execute." For the details, see `taskdocs/strategy_for_strategy.md`.
And always refer `.clinerules` as well.
Example Instructions:

- Think PLAN!: Check the Next Steps in NEXT_TODO.md and detail up reading related files as much as possible.
- Go EXECUTE!: Implement the TODOs and manage the tasks status accordinly.

## Strategy and Next Steps

- Session restoration should open the tabs owned by the current instance:
  - Investigate how session data is stored and retrieved in `src/session-management.ts`. **[DONE]**
  - Review `src/session-management-helpers.ts` for utility functions related to session handling. **[DONE]**
  - Check `src/service-worker-handler.ts` for any session-related communication logic. **[DONE]**
  - Ensure that tabs are restored only for the current instance by identifying ownership criteria. **[DONE]**
  - Implement logic to filter and restore tabs based on ownership in `src/session-management.ts`. **[DONE]**
  - Write unit tests in `src/session-management.test.ts` to validate the restoration logic.
  - Conduct integration tests to ensure proper session restoration behavior.
- Investigate Tabs UI structure:
  - Review `tabs.html` for DOM structure. **[DONE]**
  - Locate the "takeover button" and its related elements. **[DONE]**
  - Analyze `src/tabs.ts` for existing event handling logic. **[DONE]**
  - Check `src/tabs.css` for button styling conventions. **[DONE]**
  - Refer to `designdocs/tabs_ui.md` for design guidelines. **[DONE]**
- Design the "open" button:
  - Define its position beside the "takeover button." **[DONE]**
  - Specify its behavior (e.g., open a new tab or specific URL). **[DONE]**
  - Ensure its style aligns with the existing UI. **[DONE]**
- Implement the "open" button:
  - Add the button to the HTML structure in `tabs.html`. **[DONE]**
  - Apply appropriate CSS for styling in `src/tabs.css`. **[DONE]**
  - Write JavaScript/TypeScript logic for its behavior in `src/tabs.ts`. **[DONE]**
- Test the new button:
  - Write unit tests to validate its functionality.
  - Perform UI tests to ensure proper display and interaction.
  - Conduct regression tests to verify no impact on existing features.
- Update documentation:
  - Add details about the "open" button to `designdocs/tabs_ui.md`. **[DONE]**
- Review and refactor:
  - Conduct code reviews and improve the implementation. **[PENDING]**
- Prepare for deployment:
  - Format code using `npx prettier . --write`. **[PENDING]**
  - Commit changes with a clear message. **[PENDING]**
  - Create a pull request for review. **[PENDING]**
