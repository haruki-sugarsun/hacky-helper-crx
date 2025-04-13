# NEXT_TODO

## Instruction (KEEP THIS SECTION AS-IS)

This is a note to track work plan and status.
We will first "Plan" and then "Execute." For the details, see `taskdocs/strategy_for_strategy.md`.
And always refer `.clinerules` as well.
Example Instructions:

- Think PLAN!: Check the Next Steps in NEXT_TODO.md and detail up reading related files as much as possible.
- Go EXECUTE!: Implement the TODOs and manage the tasks status accordinly.

## Strategy and Next Steps

- Use vitest-chrome instead of jest-chrome as jest-chrome is truely obsolete.
  - **Plan:**
    1.  **Install Dependencies:** Remove `jest`, `ts-jest`, `jest-chrome`. Add `vitest`, `@vitest/ui`, `vitest-chrome`. Run `npm install`.
    2.  **Update `package.json` Scripts:** Change `scripts.test` to use `vitest`. Add `test:watch` and `test:ui` if desired.
    3.  **Create Vitest Config:** Create `vitest.config.ts`. Configure for TypeScript and integrate `vitest-chrome`. Reference a test setup file.
    4.  **Migrate Test Setup:** Update `src/setupTests.ts` (or rename/refactor) to use Vitest mocking (`vi.fn()`, `vi.mock()`) instead of Jest's, especially for the `chrome` API mocks.
    5.  **Update Test Files:** Adjust imports (e.g., remove `import { chrome } from "jest-chrome";`) and any Jest-specific syntax in `*.test.ts` files.
    6.  **Remove Old Config:** Delete `jest.config.js`.
    7.  **Verify:** Run `npm test` and ensure all tests pass.
  - **Execute:**
    - [x] Install Dependencies
    - [x] Update `package.json` Scripts
    - [x] Create Vitest Config
    - [x] Migrate Test Setup
    - [x] Update Test Files
    - [x] Remove Old Config
    - [ ] Verify
