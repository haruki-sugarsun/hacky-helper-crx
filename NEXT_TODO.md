# NEXT_TODO

## Instruction (KEEP THIS SECTION AS-IS)

This is a note to track work plan and status.
We will first "Plan" and then "Execute." For the details, see `taskdocs/strategy_for_strategy.md`.
And always refer `.clinerules` as well.
Example Instructions:

- Think PLAN!: Check the Next Steps in NEXT_TODO.md and detail up reading related files as much as possible.
- Go EXECUTE!: Implement the TODOs and manage the tasks status accordinly.

## Strategy and Next Steps

- Each task has a dedicated file in `taskdocs` directory.
- The dedicated file in `taskdocs` should have the detailed changes to make as much as possible.
- The tasks should be keep updated with current status.
- Complete LLM merge integration in `src/voice-log.ts` (update condensed_log area)
- Style the condensed log UI (voice_log.css)
- Add unit tests for `updateCondensedLog` (mock LLM service)
- Wire up loading and error states in condensed log
- Review and approve design doc `designdocs/voice-log-ui.md`
- Once styled and tested, evaluate need for e2e tests
