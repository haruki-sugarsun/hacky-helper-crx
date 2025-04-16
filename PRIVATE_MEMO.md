# Private Memo

## Tips

```
$ npm run dev
$ find *.html src/ *.md designdocs/ | entr sh -c 'clear; npx tsc --noEmit && npx prettier . --write; echo ===DONE==='
```

## Config

- `curl 'http://ollama_node_host:11434'`
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
