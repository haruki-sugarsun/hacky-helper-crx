# Task Documentation Process: From Idea to Dedicated Task File

- When an idea or feature request is found in files like `parking_lot.md`, the agent should:
  1. Summarize the idea and clarify its intent and scope.
  2. Break down the idea into actionable subtasks (UI, implementation, feedback, testing, etc.).
  3. Create a dedicated task file in `taskdocs/` (e.g., `pull_all_windows_task.md`) with:
     - Background and origin reference
     - Goal and expected behavior
     - Subtasks and implementation steps
     - Notes on reuse, edge cases, and documentation
     - Status and assignee fields
  4. Reference the origin (source file and line) for traceability.
  5. Avoid duplicating the same task in `NEXT_TODO.md` unless specifically requested.
- This process ensures ideas are not lost and are actionable for future development.
- Update this documentation whenever the workflow changes or new conventions are adopted.

---
