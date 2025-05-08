# METAPLAN Phase Documentation

## Task: Update Action Label for "Force Sync"

### Description

Update the action label for "Force Sync" in the session menu from "Force Sync to Bookmarks" to "Force Sync to Backend".

### Planned Steps

1.  Locate the relevant code in `src/tabs.ts` within the `createSessionListItem` function.
2.  Modify the `text` property of the menu item from `"Force Sync to Bookmarks"` to `"Force Sync to Backend"` using `replace_in_file`.
3.  Verify the changes after applying the modification.

### Status

- [x] Task completed successfully.

### Notes

- Code in `src/tabs.ts` updated.
- Label changed from "Force Sync to Bookmarks" to "Force Sync to Backend".
- Code formatted using Prettier.
