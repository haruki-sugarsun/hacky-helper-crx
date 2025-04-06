This is a work stack. Take the top one and process it.

- Update bookmark_storage.ts according to bookmark_storage_encodings.md.
  - Read from bookmark folder title
  - Write to bookmark folder title.
- Update our types to follow the plan.
- Update the session-management to properly store all the related metadata to the backend(bookmark storage).
- Implement triggerAutoSessionSync() in session-management.ts.
- Find a TODO which requires the smallest changes and work on the implementation.
  - You may use `find *.html src/ *.md designdocs/ -type f | xargs grep TODO | shuf | head -n100`

---

Refer .clinerules as well.
