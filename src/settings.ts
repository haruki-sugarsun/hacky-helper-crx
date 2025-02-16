import { h, init, propsModule, eventListenersModule } from 'snabbdom';

import './config_store.ts'
import { ConfigStore, Config } from './config_store.ts';

import './style.css'
// import './settings.css'

// Initialize snabbdom patch function
const patch = init([propsModule, eventListenersModule]);


// Register change listener for elements in html:
// const settings = document.querySelector<HTMLDivElement>('#settings')!
const settingsTabOrderingUl = document.querySelector<HTMLUListElement>('#settings-tab-ordering')!;

// Fill the form:
appendFormFrom(settingsTabOrderingUl, ConfigStore.SORT_ON_TAB_SWITCH)


function appendFormFrom(settingsTabOrderingUl: HTMLUListElement, config: Config) {

    // Create virtual DOM node
    const vnode = h('li', [
        h('label', { attrs: { for: 'general_setting_2' } }, config.description),
        h('input', {
            attrs: { type: 'text', id: 'general_setting_2' },
            on: {
                input: (event: Event) => {
                    console.log(event)
                    const target = event.target as HTMLInputElement;
                    config.set(target.value);
                }
            }
        })
    ]);

    // Patch the real DOM with the virtual DOM
    const newNode = document.createElement('li');
    settingsTabOrderingUl.appendChild(newNode);
    patch(newNode, vnode);
}

