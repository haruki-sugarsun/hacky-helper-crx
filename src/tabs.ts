import './style.css'
import './tabs.css'

// References to the fixed elements and handler setup:
const tabs_tablist = document.querySelector<HTMLDivElement>('#tabs_tablist')!
console.log(tabs_tablist)

// Page State
var windowIds: (number | undefined)[] = [];


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



    
}

// setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)
init();
