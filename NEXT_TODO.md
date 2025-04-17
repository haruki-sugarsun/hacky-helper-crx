# NEXT_TODO

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

1. DONE: (package.json) Add "twemoji" npm package dependency and "@types/twemoji" for TypeScript type definitions.
2. DONE: (src/lib/emoji-helper.ts) Create a new helper module for emoji rendering:
   - Implement a `renderEmoji` function to parse text and replace emoji characters with Twemoji SVGs/PNGs
   - Implement a `createEmojiElement` function to create an emoji element for a specific character
   - Add configuration options for size (SVG or PNG), CSS classes, etc.
3. DONE: (src/ui/session-label.ts) No changes needed for the "⋮" emoji in the menu button.
4. DONE: (src/tabs.ts) Update emoji usage in status indicators:
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

- Think PLAN!: Check the Next Steps in NEXT_TODO.md and detail up reading related files as much as possible.
- Go EXECUTE!: Implement the TODOs and manage the tasks status accordinly.

## Strategy and Next Steps

- Possible tasks are listed in `parking_lot.md`.
- Each task has a dedicated file in `taskdocs` directory.
- The dedicated file in `taskdocs` should have the detailed changes to make as much as possible.
- The tasks should be keep updated with current status.
