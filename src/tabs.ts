import './style.css'
import './tabs.css'
import { GET_CACHED_SUMMARIES } from './lib/constants'
import { SummaryEntry, TabInfo, TabSummary } from './lib/types'

console.log('tabs.ts')

// References to the fixed elements and handler setup:
const tabs_tablist = document.querySelector<HTMLDivElement>('#tabs_tablist')!

// Page State
var windowIds: (number | undefined)[] = [];
var state_windows;
var state_tabs;

// Page Initializer
async function init() {
    console.log('init')

    // TODO: register the listener before constructing the data model?

    const windowsGetAll = chrome.windows.getAll();
    const tabsQuery = chrome.tabs.query({ currentWindow: true });
    const allResults = await Promise.allSettled([windowsGetAll, tabsQuery]).catch(err => {
        console.error(err);
        // TODO: Show some error dialog in this case?
        return [{ status: 'rejected', results: err }];
    });
    const rejectedResults = allResults.filter(result => result.status === 'rejected');
    if (rejectedResults.length > 0) {
        console.log(allResults)
        window.alert(allResults)
        return;
    }
    const windows = await windowsGetAll;
    const tabs = await tabsQuery;
    console.log(windows);
    console.log(tabs);

    updateUI(windows, tabs);
    state_windows = windows;
    state_tabs = tabs;
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

