import { GET_CACHED_SUMMARIES } from './lib/constants';
import { TabSummary } from './lib/types';
import './style.css'
import './tabs.css'

// References to the fixed elements and handler setup:
const tabs_tablist = document.querySelector<HTMLDivElement>('#tabs_tablist')!
console.log('tabs.ts', new Date())

// Page State
var windowIds: (number | undefined)[] = []; // IDs of all windows
var state_windows: chrome.windows.Window[]; // All windows
var state_tabs: chrome.tabs.Tab[]; // Tabs in the current window

// Page Initializer
function init() {
    console.log('init')

    const windowsGetAll = chrome.windows.getAll().then(results => {
        state_windows = results;
        windowIds = [];
        results.forEach(window => {
            windowIds.push(window.id);
            console.log(`ID: ${window.id}, Tabs: ${window.tabs}`);
        });
        console.log(`${windowIds}`);
        return results;
    });
    const tabsQuery = chrome.tabs.query({ currentWindow: true }).then(tabs => {
        state_tabs = tabs;
        console.log("Tabs in current window:");
        tabs.forEach(tab => {
            console.log(`Title: ${tab.title}, URL: ${tab.url}`);
        });
        return tabs;
    });
    Promise.allSettled([windowsGetAll, tabsQuery]).then(async results => {
        const resWindowsGetAll = results[0];
        const resTabsQuery = results[1];
        console.log(resWindowsGetAll);
        const w = await windowsGetAll;
        console.log(w);

        console.log(resTabsQuery);

        updateUI(state_windows, state_tabs);
    }).catch(err => {
        console.error(err);
        // TODO: Show some error dialog in this case?
    });
}

// setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)
init();
// Add event listener for the "button to request the tab summaries."
const requestTabSummariesButton = document.querySelector<HTMLButtonElement>('#requestTabSummariesButton')!;
requestTabSummariesButton.addEventListener('click', async () => {
    console.log('Tab summaries requested');

    // Refresh the windows list
    chrome.windows.getAll().then(windows => {
        state_windows = windows;
        updateUI(state_windows, state_tabs);
    });

    // Get all tabs in the current window
    const tabs = await chrome.tabs.query({ currentWindow: true });
    if (tabs.length === 0) {
        console.error('No tabs found in current window');
        return;
    }

    // Collect all tab URLs
    const tabUrls: string[] = tabs.map(tab => (tab.url!)).filter(url => url);
    // Filter out any tabs with valid URLs

    console.log('Requesting summaries for tabs:', tabUrls);

    // Request cached summaries for all tabs in the window
    const cachedDigestResponse = await chrome.runtime.sendMessage({
        type: GET_CACHED_SUMMARIES,
        payload: {
            tabUrls: tabUrls
        }
    });

    if (cachedDigestResponse && cachedDigestResponse.type === 'CACHED_SUMMARIES_RESULT') {
        const allTabSummaries: TabSummary[] = cachedDigestResponse.payload.tabSummaries || [];

        // Update the table in #tabs_tablist
        const tabsTable = tabs_tablist.querySelector('table')!;

        // Update table headers
        const tableHead = tabsTable.querySelector('thead')!;
        tableHead.innerHTML = `
                <tr>
                    <th>Tab ID</th>
                    <th>URL</th>
                    <th>Summary</th>
                </tr>
            `;

        // Clear existing table rows
        const tableBody = tabsTable.querySelector('tbody')!;
        tableBody.innerHTML = '';

        if (allTabSummaries.length === 0) {
            // No summaries available - add a message row
            const noSummaryRow = document.createElement('tr');
            noSummaryRow.innerHTML = `
                    <td colspan="3">No summaries available for any tabs yet.</td>
                `;
            tableBody.appendChild(noSummaryRow);
        } else {
            // TODO: Iterate along with `tabs` instead of summaries.
            // Add rows for each tab
            state_tabs.forEach((tab: chrome.tabs.Tab) => {
                const row = document.createElement('tr');

                let summarySnippet = 'No summary available yet.';  // TODO: Use summry from allTabSummaries.
                // Find the summary for this tab
                const tabSummary = allTabSummaries.find(summary => summary.url === tab.url);
                if (tabSummary && tabSummary.summaries.length > 0) {
                    const digest = tabSummary.summaries[0];
                    const date = new Date(digest.timestamp);
                    const formattedDate = date.toLocaleString();
                    summarySnippet = `
                        <div class="summary-timestamp">Generated: ${formattedDate}</div>
                        <div class="summary-text">${digest.summary}</div>`;
                }
                // Create the row with tab ID, URL, and a placeholder for summary

                // Update the row with the summary
                row.innerHTML = `
                    <td class="tab-id-cell">${tab.id || 'N/A'}</td>
                    <td class="url-cell" title="${tab.url}">${tab.url || 'N/A'}</td>
                    <td>
                        ${summarySnippet}
                    </td>`;
                tableBody.appendChild(row);

                // Add click event listener to the tab ID cell
                const tabIdCell = row.querySelector('.tab-id-cell');
                if (tabIdCell && tab.id) {
                    tabIdCell.classList.add('clickable');
                    tabIdCell.addEventListener('click', async () => {
                        console.log(`Activating tab with ID: ${tab.id}`);
                        try {
                            const updatedTab = await chrome.tabs.update(tab.id!, { active: true });
                            console.log(`Successfully activated tab: ${updatedTab?.id}`);
                        } catch (error) {
                            console.error(`Error activating tab: ${error instanceof Error ? error.message : error}`);
                        }
                    });
                }
            });

            console.log('Cached summaries displayed in table.');
        }
    }
});
function updateUI(windows: chrome.windows.Window[], tabs: chrome.tabs.Tab[]) {
    // Log window and tab information for debugging
    windows.forEach(w => {
        console.log(`ID: ${w.id}, Tabs: ${w.tabs?.length || 0}`);
    });
    tabs.forEach(t => {
        console.log(`Title: ${t.title}, URL: ${t.url}`);
    });

    // Update the sessions list (windows)
    const tabsSessionsElement = document.querySelector<HTMLDivElement>('#tabs_sessions')!;
    const sessionsList = tabsSessionsElement.querySelector('ul')!;
    
    // Clear existing list items
    sessionsList.innerHTML = '';
    
    // Track the current window to auto-select it
    let currentWindowItem: HTMLLIElement | undefined = undefined;
    
    // Add a list item for each window
    for (let i = 0; i < windows.length; i++) {
        const window = windows[i];
        const listItem = document.createElement('li');
        // Count tabs with this window's ID from state_tabs
        const tabCount = state_tabs.filter(tab => tab.windowId === window.id).length;
        
        // Mark the current window
        const isCurrent = window.focused ? ' (Current)' : '';
        
        // Create the session name with window ID and tab count
        listItem.textContent = `Window ${window.id}${isCurrent} - ${tabCount} tab${tabCount !== 1 ? 's' : ''}`;
        
        // Add a class to highlight the current window
        if (window.focused) {
            listItem.classList.add('current-window');
            currentWindowItem = listItem;
        }
        
        // Add click event to show tabs for this window
        listItem.addEventListener('click', () => {
            // Update the selected window in the UI
            document.querySelectorAll('#tabs_sessions li').forEach(item => {
                item.classList.remove('selected');
            });
            listItem.classList.add('selected');
            
            console.log(`Selected window: ${window.id}`);
            
            // For now, just query and display tabs for the selected window
            if (window.id) {
                chrome.tabs.query({ windowId: window.id }).then(windowTabs => {
                    console.log(`Found ${windowTabs.length} tabs in window ${window.id}`);
                    // Update the table with these tabs
                    updateTabsTable(windowTabs);
                });
            }
        });
        
        sessionsList.appendChild(listItem);
    }
    
    // Auto-select the current window and show its tabs
    if (currentWindowItem) {
        // Simulate a click on the current window item
        currentWindowItem.classList.add('selected');
        
        // Find the current window
        const currentWindow = windows.find(w => w.focused);
        if (currentWindow && currentWindow.id) {
            // Load tabs for the current window
            chrome.tabs.query({ windowId: currentWindow.id }).then(windowTabs => {
                console.log(`Auto-loading ${windowTabs.length} tabs for current window ${currentWindow.id}`);
                updateTabsTable(windowTabs);
            });
        }
    }
}

// Helper function to update the tabs table with tabs from a specific window
async function updateTabsTable(tabs: chrome.tabs.Tab[]) {
    const tabsTable = tabs_tablist.querySelector('table')!;
    
    // Update table headers - now including the summary column
    const tableHead = tabsTable.querySelector('thead')!;
    tableHead.innerHTML = `
        <tr>
            <th>Tab ID</th>
            <th>Title</th>
            <th>URL</th>
            <th>Summary</th>
        </tr>
    `;
    
    // Clear existing table rows
    const tableBody = tabsTable.querySelector('tbody')!;
    tableBody.innerHTML = '';
    
    if (tabs.length === 0) {
        // No tabs available - add a message row
        const noTabsRow = document.createElement('tr');
        noTabsRow.innerHTML = `
            <td colspan="4">No tabs available in this window.</td>
        `;
        tableBody.appendChild(noTabsRow);
        return;
    }
    
    // Collect all tab URLs to request summaries
    const tabUrls: string[] = tabs.map(tab => tab.url!).filter(url => url);
    
    // Request cached summaries for all tabs
    let allTabSummaries: TabSummary[] = [];
    try {
        const cachedDigestResponse = await chrome.runtime.sendMessage({
            type: GET_CACHED_SUMMARIES,
            payload: {
                tabUrls: tabUrls
            }
        });
        
        if (cachedDigestResponse && cachedDigestResponse.type === 'CACHED_SUMMARIES_RESULT') {
            allTabSummaries = cachedDigestResponse.payload.tabSummaries || [];
        }
    } catch (error) {
        console.error('Error fetching tab summaries:', error);
    }
    
    // Add rows for each tab
    tabs.forEach(tab => {
        const row = document.createElement('tr');
        
        // Find the summary for this tab
        let summarySnippet = 'No summary available yet.';
        if (tab.url) {
            const tabSummary = allTabSummaries.find(summary => summary.url === tab.url);
            if (tabSummary && tabSummary.summaries.length > 0) {
                const digest = tabSummary.summaries[0]; // Get the most recent summary
                const date = new Date(digest.timestamp);
                const formattedDate = date.toLocaleString();
                summarySnippet = `
                    <div class="summary-timestamp">Generated: ${formattedDate}</div>
                    <div class="summary-text">${digest.summary}</div>`;
            }
        }
        
        row.innerHTML = `
            <td class="tab-id-cell">${tab.id || 'N/A'}</td>
            <td class="title-cell" title="${tab.title}">${tab.title || 'Untitled'}</td>
            <td class="url-cell" title="${tab.url}">${tab.url || 'N/A'}</td>
            <td class="summary-cell">${summarySnippet}</td>
        `;
        tableBody.appendChild(row);
        
        // Add click event listener to the tab ID cell
        const tabIdCell = row.querySelector('.tab-id-cell');
        if (tabIdCell && tab.id) {
            tabIdCell.classList.add('clickable');
            tabIdCell.addEventListener('click', async () => {
                console.log(`Activating tab with ID: ${tab.id}`);
                try {
                    // Activate the window first
                    if (tab.windowId) {
                        await chrome.windows.update(tab.windowId, { focused: true });
                    }
                    // Then activate the tab
                    const updatedTab = await chrome.tabs.update(tab.id!, { active: true });
                    console.log(`Successfully activated tab: ${updatedTab?.id}`);
                } catch (error) {
                    console.error(`Error activating tab: ${error instanceof Error ? error.message : error}`);
                }
            });
        }
    });
}
