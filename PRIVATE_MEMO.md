# Private Memo

## Tips

```
$ npm run dev
$ find *.html src/ *.md designdocs/ | entr sh -c 'clear; npx prettier . --write; npx tsc --noEmit; echo ===DONE==='
```

## Config

- `curl 'http://victus16-h.taila4d41b.ts.net:11434'`
- Summary/Keywords models
  - gemma2:2b
  - granite3.1-moe:3b
  - granite3.1-dense:8b
- bge-m3

## Prompt Notes

```
Read the file .clinerules to follow the rules first.
```

# Manual Interaction Note

(TODO: brush-up this as well.)

- Prepare a rough idea with related filenames.
- If we have a new dependency task, e.g. require refactoring, Add to the NEXT_TODO.md and do that as a new task.

# Just Idea Parking Lot

We have unstructured, just-idea notes here:

- Use some webfont for emojis?
- Make sure to generate keywords only for the generateKeywords function maybe by specifiying JSON output? -　Show the current LLMTasks status in the popup? e.g. number of the pending tasks, currently-running task etc.
- Open the sidepanel from popup.
- Hot key to trigger the sidepanel feature?
- Keeping pinned tabs feature following the active window. Refer the old Hacky-Tab-Enhancer impl.
- Support migrate to a closed Named Session. We may update the existing UI in Tabs UI or Popup with a search for named sessions.
- Improve session restoration on browser start. We can refer the sessionId in URL, but it is not working well yet.
