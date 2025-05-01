# Session ID URL Cleanup Task

**Status**: In Progress  
**Priority**: Medium  
**Type**: Enhancement  
**Assignee**: TBD  
**Created**: May 1, 2025

## Description

When a session is deleted in tabs.html, the URL should be updated to remove the associated `sessionId` parameter if and only if the deleted session's ID matches the sessionId in the URL. Currently, the `deleteSession` function doesn't update the URL, which can cause confusion and potentially undesired behavior if the page is refreshed or revisited.

## Background

The `tabs.html` page can be loaded with a URL parameter `sessionId` which is used to identify the session context. 
When a session is deleted, the URL should be updated to reflect the current state to ensure consistency.

## Requirements

1. Implement URL update functionality after a session is deleted
2. Remove the `sessionId` parameter from the URL after successful deletion, but only if:
   - The deleted session's ID matches the sessionId in the URL
   - The session is open (not a closed session)
   - The session is associated with a window
   - A Tabs UI exists for that window
3. Preserve any other URL parameters that may be present
4. Handle edge cases appropriately

## Implementation Details

This implementation focuses on direct tab URL updates from the service worker, with an alternative approach that avoids page reloads:

### 1. Helper Function (`tabs-helpers.ts`)

The `findTabsUiInWindow` function is already implemented in `tabs-helpers.ts`:

```typescript
/**
 * Finds all Tabs UI tabs in a specific window.
 * @param windowId The ID of the window to search for Tabs UI tabs
 * @returns An array of tabs matching the Tabs UI URL pattern
 */
export async function findTabsUiInWindow(windowId: number): Promise<chrome.tabs.Tab[]> {
  try {
    const tabsUiTabs = await chrome.tabs.query({
      windowId: windowId,
      url: chrome.runtime.getURL("tabs.html*"), // Wildcard to match any query parameters
    });
    
    return tabsUiTabs;
  } catch (error) {
    console.error(`Error finding Tabs UI in window ${windowId}:`, error);
    return [];
  }
}
```

### 2. Service Worker Updates (`service-worker.ts`) - Direct URL Update

The main logic should be added to the service worker's `DELETE_NAMED_SESSION` handler:

```typescript
case DELETE_NAMED_SESSION:
  {
    const { sessionId } = payload;
    
    // First check if session exists and is open before deletion
    // Note: Use getNamedSessions() and find instead of getActiveNamedSession
    const sessions = await SessionManagement.getNamedSessions();
    const session = sessions.find(s => s.id === sessionId);
    const isOpenSession = session && session.windowId !== undefined;
    const windowId = session?.windowId;
    
    // Delete the session
    await SessionManagement.deleteNamedSession(sessionId);
    
    // If this was an open session with a window, update any Tabs UI URLs directly
    if (isOpenSession && windowId) {
      // Find any tabs.html pages in this window using the helper function
      const tabsUiTabs = await TabsHelpers.findTabsUiInWindow(windowId);
      
      // Update each tab's URL to remove the sessionId parameter if it matches
      for (const tab of tabsUiTabs) {
        if (tab.url) {
          const url = new URL(tab.url);
          const urlSessionId = url.searchParams.get('sessionId');
          
          // Only update if the URL contains the matching sessionId
          if (urlSessionId === sessionId) {
            url.searchParams.delete('sessionId');
            
            // Update the tab URL
            await chrome.tabs.update(tab.id, {
              url: url.toString()
            });
            
            console.log(`Removed session ID ${sessionId} from tab ${tab.id} URL`);
          }
        }
      }
    }
    
    sendResponse({
      type: "DELETE_NAMED_SESSION_RESULT",
      payload: "success",
    });
  }
  break;
```

### 3. Alternative Implementation (Without Page Reload)

If we want to avoid page reloads when updating the URL, we can use Chrome's scripting API:

```typescript
// In the DELETE_NAMED_SESSION handler, replace the chrome.tabs.update with:
await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  func: (sessionId) => {
    const url = new URL(window.location.href);
    const urlSessionId = url.searchParams.get('sessionId');
    
    if (urlSessionId === sessionId) {
      url.searchParams.delete('sessionId');
      window.history.replaceState({}, '', url.toString());
      console.log(`Session ID ${sessionId} removed from URL`);
    }
  },
  args: [sessionId]
});
```

### 4. Import Updates

Make sure to import the necessary helper functions:

```typescript
import * as TabsHelpers from "./features/tabs-helpers";
```

## Testing

### Unit Tests

#### 1. Test for `findTabsUiInWindow` in `src/features/tabs-helpers.test.ts`

```typescript
describe('findTabsUiInWindow', () => {
  beforeEach(() => {
    // Mock chrome.tabs.query
    chrome.tabs.query = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test('returns tabs matching the Tabs UI pattern', async () => {
    // Setup mock response
    const mockTabs = [
      { id: 1, url: 'chrome-extension://abcdef/tabs.html', windowId: 100 },
      { id: 2, url: 'chrome-extension://abcdef/tabs.html?sessionId=test123', windowId: 100 }
    ];
    chrome.tabs.query.mockResolvedValue(mockTabs);
    
    // Mock chrome.runtime.getURL
    chrome.runtime.getURL = vi.fn().mockReturnValue('chrome-extension://abcdef/tabs.html');
    
    // Call the function
    const result = await TabsHelpers.findTabsUiInWindow(100);
    
    // Verify results
    expect(chrome.tabs.query).toHaveBeenCalledWith({
      windowId: 100,
      url: 'chrome-extension://abcdef/tabs.html*'
    });
    expect(result).toEqual(mockTabs);
  });

  test('returns empty array on error', async () => {
    // Simulate an error
    chrome.tabs.query.mockRejectedValue(new Error('Test error'));
    
    // Call the function
    const result = await TabsHelpers.findTabsUiInWindow(100);
    
    // Verify it returns an empty array on error
    expect(result).toEqual([]);
  });
});
```

#### 2. Test for `DELETE_NAMED_SESSION` handler in `src/service-worker.test.ts`

```typescript
describe('DELETE_NAMED_SESSION handler', () => {
  beforeEach(() => {
    // Mock SessionManagement methods
    SessionManagement.getNamedSessions = vi.fn();
    SessionManagement.deleteNamedSession = vi.fn();
    
    // Mock TabsHelpers.findTabsUiInWindow
    TabsHelpers.findTabsUiInWindow = vi.fn();
    
    // Mock chrome.tabs.update
    chrome.tabs.update = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test('deletes session and updates URL when conditions are met', async () => {
    // Setup mocks
    const sessionId = 'test123';
    const windowId = 100;
    
    // Mock session data
    SessionManagement.getNamedSessions.mockResolvedValue([{ 
      id: sessionId, 
      windowId: windowId,
      name: 'Test Session',
      tabs: []
    }]);
    
    // Mock tabs
    const mockTabs = [
      { 
        id: 1, 
        url: `chrome-extension://abcdef/tabs.html?sessionId=${sessionId}&otherParam=value`, 
        windowId: windowId 
      }
    ];
    TabsHelpers.findTabsUiInWindow.mockResolvedValue(mockTabs);
    
    // Mock chrome.tabs.update
    chrome.tabs.update.mockResolvedValue({});
    
    // Mock sendResponse
    const sendResponse = vi.fn();
    
    // Call the handler (simplified for testing)
    await handleDeleteNamedSession({ payload: { sessionId } }, sendResponse);
    
    // Verify session was deleted
    expect(SessionManagement.deleteNamedSession).toHaveBeenCalledWith(sessionId);
    
    // Verify tabs were searched
    expect(TabsHelpers.findTabsUiInWindow).toHaveBeenCalledWith(windowId);
    
    // Verify URL was updated properly
    expect(chrome.tabs.update).toHaveBeenCalledWith(1, {
      url: 'chrome-extension://abcdef/tabs.html?otherParam=value'
    });
    
    // Verify response was sent
    expect(sendResponse).toHaveBeenCalledWith({
      type: "DELETE_NAMED_SESSION_RESULT",
      payload: "success",
    });
  });

  test('does not update URL when session is not open', async () => {
    // Mock a closed session (no windowId)
    SessionManagement.getNamedSessions.mockResolvedValue([{ 
      id: 'test123', 
      windowId: undefined,
      name: 'Closed Session',
      tabs: []
    }]);
    
    const sendResponse = vi.fn();
    
    // Call the handler
    await handleDeleteNamedSession({ payload: { sessionId: 'test123' } }, sendResponse);
    
    // Verify session was deleted
    expect(SessionManagement.deleteNamedSession).toHaveBeenCalledWith('test123');
    
    // Verify tabs were NOT searched
    expect(TabsHelpers.findTabsUiInWindow).not.toHaveBeenCalled();
    
    // Verify URL was NOT updated
    expect(chrome.tabs.update).not.toHaveBeenCalled();
    
    // Verify response was sent
    expect(sendResponse).toHaveBeenCalledWith({
      type: "DELETE_NAMED_SESSION_RESULT",
      payload: "success",
    });
  });

  test('does not update URL when sessionId does not match', async () => {
    // Setup mocks
    const sessionId = 'test123';
    const windowId = 100;
    
    // Mock session data with window
    SessionManagement.getNamedSessions.mockResolvedValue([{ 
      id: sessionId, 
      windowId: windowId,
      name: 'Test Session',
      tabs: []
    }]);
    
    // Mock tabs with DIFFERENT sessionId
    const mockTabs = [
      { 
        id: 1, 
        url: 'chrome-extension://abcdef/tabs.html?sessionId=different123', 
        windowId: windowId 
      }
    ];
    TabsHelpers.findTabsUiInWindow.mockResolvedValue(mockTabs);
    
    const sendResponse = vi.fn();
    
    // Call the handler
    await handleDeleteNamedSession({ payload: { sessionId } }, sendResponse);
    
    // Verify session was deleted
    expect(SessionManagement.deleteNamedSession).toHaveBeenCalledWith(sessionId);
    
    // Verify tabs were searched
    expect(TabsHelpers.findTabsUiInWindow).toHaveBeenCalledWith(windowId);
    
    // Verify URL was NOT updated (because sessionId doesn't match)
    expect(chrome.tabs.update).not.toHaveBeenCalled();
    
    // Verify response was sent
    expect(sendResponse).toHaveBeenCalledWith({
      type: "DELETE_NAMED_SESSION_RESULT",
      payload: "success",
    });
  });
});

// Helper function to simulate the DELETE_NAMED_SESSION handler (for testing purposes)
async function handleDeleteNamedSession(request, sendResponse) {
  const sessionId = request.payload.sessionId;
  
  // Get session and check if open
  const sessions = await SessionManagement.getNamedSessions();
  const session = sessions.find(s => s.id === sessionId);
  const isOpenSession = session && session.windowId !== undefined;
  const windowId = session?.windowId;
  
  // Delete the session
  await SessionManagement.deleteNamedSession(sessionId);
  
  // If open session with window, update tabs
  if (isOpenSession && windowId) {
    const tabsUiTabs = await TabsHelpers.findTabsUiInWindow(windowId);
    
    for (const tab of tabsUiTabs) {
      if (tab.url) {
        const url = new URL(tab.url);
        const urlSessionId = url.searchParams.get('sessionId');
        
        if (urlSessionId === sessionId) {
          url.searchParams.delete('sessionId');
          await chrome.tabs.update(tab.id, { url: url.toString() });
        }
      }
    }
  }
  
  sendResponse({
    type: "DELETE_NAMED_SESSION_RESULT",
    payload: "success",
  });
}
```

### Manual Test Cases

1. **基本的な削除のテスト**:
   - URLに一致するセッションIDパラメータがある状態でセッションを削除する
   - 期待結果: URLからセッションIDパラメータが削除される

2. **ウィンドウ状態テスト**:
   - セッションが開いていない（クローズドセッション）状態で削除する
   - 期待結果: URLは変更されない

3. **Tabs UI存在チェック**:
   - セッションが関連するウィンドウにTabs UIが存在しない状態で削除する
   - 期待結果: URLは変更されない

4. **複数パラメータテスト**:
   - URLに複数のパラメータがある状態で削除する
   - 期待結果: セッションIDパラメータのみが削除され、他のパラメータは保持される

5. **IDミスマッチテスト**:
   - URLのセッションIDと異なるセッションを削除する
   - 期待結果: URLは変更されない

## エッジケースとリスク

1. **複数ウィンドウでの同一セッションID**:
   - 同じセッションIDで複数のTabs UIウィンドウが開いている場合、すべてのウィンドウでURLが更新される

2. **ブラウザヒストリーへの影響**:
   - `replaceState` を使用することで、ブラウザの履歴に新しいエントリを追加せずにURLを更新する

3. **スクリプト実行の失敗**:
   - `chrome.scripting.executeScript`が失敗した場合、URLが更新されない可能性がある
   - 緩和策: 適切なエラーハンドリングとログ記録

## 受け入れ基準

- セッションが削除されると、次の条件が満たされる場合にのみURLが更新される:
  - URLのセッションIDが削除されたセッションのIDと一致する
  - セッションが開いており、ウィンドウに関連付けられている
  - そのウィンドウにTabs UIが存在する
- 他のURLパラメータは変更されない
- URLが更新されてもページはリロードされない（`scripting` APIを使用する場合）
- すべてのエッジケースが適切に処理される
- ユニットテストが正常に通過すること

## 関連issue

- manifest.jsonに必要な権限（`"scripting"`）が追加されているか確認する必要があります。
- 大規模な拡張機能の場合は、セキュリティやパフォーマンスの観点から、必要最小限の権限に限定することを検討してください。