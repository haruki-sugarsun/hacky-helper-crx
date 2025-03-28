# Design Doc: Tabs UI

Tabs UI is an extention component

# Related Files

- tabs.html
- src/tabs.ts
- src/tabs.css
- src/ui/tabs_components.ts

# UI Layout

```
 Header
───────────┬────────────────────────────────
(Sessions) │ (Tabs)
...........│ [Session Name]
[Named  ]  │ [Open Tabs  ] [Saved Bookmarks]
[Unnamed]  │ [Synced Tabs]
[Closed ]  │
```

# Detailed UI Functions

## Header Area (`Header`)

- We have global functions accsible from the header area.
- A user can search among the sessions using a search bar.
  - The search bar can be activated by '/' in Tabs UI or 'Alt+S' globally in thr browser.

## Sessions Area (`(Sessions)`)

- This is a Scroallable Area
- Sessions are sorted alphabetically in each categories.

### Named Sessions (`[Named]`)

### Unnamed Sessions (`[Unnamed]`)

### Closed Sessions (`[Closed]`)

## Tabs Area (`(Tabs)`)

- This is a Scroallable Area

### Session Name (`[Session Name]`)

### Open Tabs (`[Open Tabs]`)

- When viewing other session,
- Each
- Calculated LLM-based summary and keywords are shown in the table.
- When viewing the other session (!= session in the current window), we may have a button to "Bring (Migrate to the Current Session)".
  - We can consider some other wording too.

### Saved Bookmarkd (`[]`)

### Synced Tabs (`[Synced Tabs]`)
