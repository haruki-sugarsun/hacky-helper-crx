import { ConfigStore } from '../config_store.ts'

console.log('tab_organizer');

// 

// State management:
let lastSelectedTabId: number | null = null;

chrome.tabs.onActivated.addListener(async activeInfo => {
    console.log('Tab selected:', activeInfo.tabId);

    const tabs = await chrome.tabs.query({ currentWindow: true });
    const leftMostTab = tabs[0];
    const rightMostTab = tabs[tabs.length - 1];

    if (activeInfo.tabId === leftMostTab.id && lastSelectedTabId === rightMostTab.id) {
        console.log('Switched from the right-most to the left-most tab');
        // Call your function here
        if (await ConfigStore.SORT_ON_TAB_SWITCH.get()) {
            console.log('triggering tab reordering.')
        }
    } else if (activeInfo.tabId === leftMostTab.id) {
        console.log('Switched to the left-most tab');
        // Call your function here
    } else if (activeInfo.tabId === rightMostTab.id) {
        console.log('Switched to the right-most tab');
        // Call your function here
    }

    lastSelectedTabId = activeInfo.tabId;
});
