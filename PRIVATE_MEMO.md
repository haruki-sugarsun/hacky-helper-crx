# Private Memo

## Tips

```
$ npm run dev
$ find *.html src/ | entr -r sh -c 'clear; npx prettier . --write; npx tsc --noEmit; echo ===DONE==='
```

## Config

- `curl 'http://victus16-h.taila4d41b.ts.net:11434'`
- Summary/Keywords models
  - gemma2:2b
  - granite3.1-moe:3b
  - granite3.1-dense:8b
- bge-m3

# Just Idea Parking Lot

We have unstructured, just-idea notes here:

- Use some webfont for emojis?
- Make sure to generate keywords only for the generateKeywords function maybe by specifiying JSON output? -　Show the current LLMTasks status in the popup? e.g. number of the pending tasks, currently-running task etc.
