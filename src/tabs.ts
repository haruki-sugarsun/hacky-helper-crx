import { GET_CACHED_SUMMARIES } from './lib/constants';
import { TabSummary } from './lib/types';
import './style.css'
import './tabs.css'

// References to the fixed elements and handler setup:
const tabs_tablist = document.querySelector<HTMLDivElement>('#tabs_tablist')!
console.log('tabs.ts', new Date())

// Page State
// TODO: Implement.
var windowIds: (number | undefined)[] = []; // Actually this should be the current windowId??
var state_windows: chrome.windows.Window[];
var state_tabs: chrome.tabs.Tab[];

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
    windows.forEach(w => {
        console.log(`ID: ${w.id}, Tabs: ${w.tabs}`);
    });
    tabs.forEach(t => {
        console.log(`Title: ${t.title}, URL: ${t.url}`);
    });

    throw new Error('Function not implemented.');
}
