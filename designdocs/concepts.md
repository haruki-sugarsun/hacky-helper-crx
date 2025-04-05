# Design Doc: Terminology, Concepts, and Relations

## Session

- A manageable unit of user tasks, tightly connected with a browser window and the tabs in it.
- A session can be either "named" or "unnamed".
- A session can have some metadata, e.g. ordering, createdAt, updatedAt.

### Named Sessions

- A session named by the user for long-term, cross-device, and persistent usage.
- A named session is managed by the combination of in local (sessino-management.ts) and in-backend (BookmarkStorage.ts) management.
- A named session consists of "open tabs" and "saved bookmarks".
- A Named Session can be either "Open" or "Closed".

#### Open Tabs

- Represents the tabs currently active on any of the devices.
- unsynced tabs of a named session. These are dynamically updated and maintained via an auto-save mechanism.

##### Synced Open Tabs

-

#### Saved Tabs/Bookmarks

- Consists of sessions stored in Chrome's Bookmarks. This backup enables session restoration even when the associated window is closed.

### Open Named Sessions

- A session
- Hence, associated with a window in the current browser.

- Open Named Sessions are managed locally using Chrome's storage API under the key "hacky_helper_named_sessions". They represent active sessions associated with current browser windows and are updated in real-time.

### Closed Named Sessions

- A Named Session which only exists

- Closed Named Sessions are archived using the Chrome Bookmarks API and can be restored when needed.

### Unamed Sessions

### Summary of Sessions/Tabs

- "in Local": manageed by in-local management `session-management.ts`.
- "in Backend": manageed by in-backend management `BookmarkStorage.ts`.

<table>
  <thead>
    <tr>
      <th>L1 Concept</th>
      <th>L2 Modifier</th>
      <th>L3 Modifier</th>
      <th>has sessionId</th>
      <th>has windowId</th>
      <th>in Local</th>
      <th>in Backend</th>
    </tr>
  </thead>
  <tr>
    <td rowspan="3">Session</td>
    <td rowspan="2">Named</td>
    <td>Open</td>
    <td>✅</td>
    <td>✅</td>
    <td>✅</td>
    <td>✅</td>
  </tr>
  <tr>
    <!-- <td>.</td> -->
    <td>Closed</td>
    <td>✅</td>
    <td>-</td>
    <td>-</td>
    <td>✅</td>
  </tr>
  <tr>
    <!-- <td>.</td> -->
    <td>Unnamed</td>
    <td>(<i>open</i>)</td>
    <td>-</td>
    <td>✅</td>
    <td>✅</td>
    <td>-</td>
  </tr>
  <tr>
    <td rowspan="2">Open Tabs</td>
    <td rowspan="2"><i>n/a</i></td>
    <td>Synced</td>
    <td>✅</td>
    <td></i>depends</i></td>
    <td><i>n/a</i></td>
    <td>✅</td>
  </tr>
  <tr>
    <td>Unsynced</td>
    <td>-</td>
    <td>✅</td>
    <td><i>n/a</i></td>
    <td>-</td>
  </tr>
  <tr>
    <td colspan="2">Saved Bookmarks</td>
    <td><i>(synced)</i></td>
    <td>✅</td>
    <td><i>n/a</i></td>
    <td><i>n/a</i></td>
    <td>✅</td>
  </tr>
</table>

## UI

## Data Storage/Synchronization

### In-memory/Local Storage

(Technically, it might or might not be in-memory, but we call this layer sometimes in-memory or just local)

-

### Backend Storage

- Effectively this is Chrome Browser's Bookmark folders for now.
