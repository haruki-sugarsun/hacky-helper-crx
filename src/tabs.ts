import './style.css'
import './tabs.css'

// References to the fixed elements and handler setup:
const tabs_tablist = document.querySelector<HTMLDivElement>('#tabs_tablist')!
console.log(tabs_tablist)

// Page State
// TODO: Implement.
var windowIds: (number | undefined)[] = []; // Actually this should be the current windowId??
var state_windows;
var state_tabs;

// Page Initializer
function init() {
    console.log('init')

    const windowsGetAll = chrome.windows.getAll().then(results => {
        windowIds = [];
        results.forEach(window => {
            windowIds.push(window.id);
            console.log(`ID: ${window.id}, Tabs: ${window.tabs}`);
        });
        console.log(`${windowIds}`);
        return results;
    });
    const tabsQuery = chrome.tabs.query({ currentWindow: true }).then(tabs => {
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

    }).catch(err => {
        console.error(err);
        // TODO: Show some error dialog in this case?
    });

    state_windows = windows;
    state_tabs = tabs;
    updateUI(state_windows, state_tabs);
}

// setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)
init();
// Add event listener for the "button to request the tab summaries."
const requestTabSummariesButton = document.querySelector<HTMLButtonElement>('#requestTabSummariesButton')!;
requestTabSummariesButton.addEventListener('click', () => {
    console.log('Tab summaries requested');
    
    // Get all tabs in the current window
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
            console.error('No tabs found in current window');
            return;
        }
        
        // Collect all tab URLs
        const tabUrls: TabInfo[] = tabs.map(tab => ({
            tabId: tab.id!,
            url: tab.url!
        })).filter(tab => tab.tabId && tab.url); // Filter out any tabs without IDs or URLs
        
        console.log('Requesting summaries for tabs:', tabUrls);
        
        // Request cached summaries for all tabs in the window
        chrome.runtime.sendMessage({ 
            type: GET_CACHED_SUMMARIES, 
            payload: { 
                tabs: tabUrls
            } 
        }, (response) => {
            if (response && response.type === 'CACHED_SUMMARIES_RESULT') {
                const allTabSummaries: TabSummary[] = response.payload.tabSummaries || [];
                
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
                    // Add rows for each tab's summaries
                    allTabSummaries.forEach((tabSummary: TabSummary) => {
                        const { tabId, url, summaries } = tabSummary;
                        
                        if (summaries.length === 0) {
                            // No summaries for this tab
                            const noSummaryRow = document.createElement('tr');
                            noSummaryRow.innerHTML = `
                                <td class="tab-id-cell">${tabId || 'N/A'}</td>
                                <td class="url-cell" title="${url}">${url || 'N/A'}</td>
                                <td>No summary available for this tab yet.</td>
                            `;
                            tableBody.appendChild(noSummaryRow);
                            
                            // Add click event listener to the tab ID cell
                            const tabIdCell = noSummaryRow.querySelector('.tab-id-cell');
                            if (tabIdCell && tabId) {
                                tabIdCell.classList.add('clickable');
                                tabIdCell.addEventListener('click', () => {
                                    console.log(`Activating tab with ID: ${tabId}`);
                                    chrome.tabs.update(tabId, { active: true }, (tab) => {
                                        if (chrome.runtime.lastError) {
                                            console.error(`Error activating tab: ${chrome.runtime.lastError.message}`);
                                        } else {
                                            console.log(`Successfully activated tab: ${tab?.id}`);
                                        }
                                    });
                                });
                            }
                        } else {
                            // Add rows for each summary of this tab
                            summaries.forEach((summary: SummaryEntry) => {
                                const row = document.createElement('tr');
                                
                                // Format the date
                                const date = new Date(summary.timestamp);
                                const formattedDate = date.toLocaleString();
                                
                                // Create the row with tab ID, URL, and summary
                                row.innerHTML = `
                                    <td class="tab-id-cell">${tabId || 'N/A'}</td>
                                    <td class="url-cell" title="${url}">${url || 'N/A'}</td>
                                    <td>
                                        <div class="summary-timestamp">Generated: ${formattedDate}</div>
                                        <div class="summary-text">${summary.text}</div>
                                    </td>
                                `;
                                
                                tableBody.appendChild(row);
                                
                                // Add click event listener to the tab ID cell
                                const tabIdCell = row.querySelector('.tab-id-cell');
                                if (tabIdCell && tabId) {
                                    tabIdCell.classList.add('clickable');
                                    tabIdCell.addEventListener('click', () => {
                                        console.log(`Activating tab with ID: ${tabId}`);
                                        chrome.tabs.update(tabId, { active: true }, (tab) => {
                                            if (chrome.runtime.lastError) {
                                                console.error(`Error activating tab: ${chrome.runtime.lastError.message}`);
                                            } else {
                                                console.log(`Successfully activated tab: ${tab?.id}`);
                                            }
                                        });
                                    });
                                }
                            });
                        }
                    });
                }
                
                console.log('Cached summaries displayed in table.');
            } else {
                console.error('Failed to get cached summaries:', response);
            }
        });
    });
});
function updateUI(windows: chrome.windows.Window[], tabs: chrome.tabs.Tab[]) {
    windows.forEach(w => {
        console.log(`ID: ${w.id}, Tabs: ${w.tabs}`);
    });
    tabs.forEach(t => {
        console.log(`Title: ${t.title}, URL: ${t.url}`);
    });

    throw new Error('Function not implemented.');
}

