import { h, init, propsModule, eventListenersModule } from 'snabbdom';

import './config_store'
import { ConfigStore, Config, BoolConfig } from './config_store';
import { OLLAMA_API_URL_DEFAULT, OLLAMA_MODEL_DEFAULT } from './lib/constants';

import './style.css'
// import './settings.css'

// TODO: Check if snabbdom is still necessary in package.json or not.
// Initialize snabbdom patch function
const patch = init([propsModule, eventListenersModule]);


// Register change listener for elements in html:
// const settings = document.querySelector<HTMLDivElement>('#settings')!
const settingsTabOrderingUl = document.querySelector<HTMLUListElement>('#settings-tab-ordering')!;
const settingsLlmUl = document.querySelector<HTMLUListElement>('#settings-llm')!;

// Initialize the form asynchronously
async function initializeForm() {
    console.log('Initializing form...');
    console.log('SORT_ON_TAB_SWITCH is BoolConfig:', ConfigStore.SORT_ON_TAB_SWITCH instanceof BoolConfig);
    console.log('USE_OLLAMA is BoolConfig:', ConfigStore.USE_OLLAMA instanceof BoolConfig);
    
    // Fill the form:
    await appendFormFrom(settingsTabOrderingUl, ConfigStore.SORT_ON_TAB_SWITCH);

    // Add LLM settings
    await appendFormFrom(settingsLlmUl, ConfigStore.OPENAI_API_KEY);
    
    // Explicitly use appendBoolFormFrom for USE_OLLAMA
    if (ConfigStore.USE_OLLAMA instanceof BoolConfig) {
        console.log('Using appendBoolFormFrom for USE_OLLAMA');
        await appendBoolFormFrom(settingsLlmUl, ConfigStore.USE_OLLAMA);
    } else {
        console.error('USE_OLLAMA is not a BoolConfig instance!');
        // Fallback to regular form
        await appendFormFrom(settingsLlmUl, ConfigStore.USE_OLLAMA);
    }
    
    await appendFormFrom(settingsLlmUl, ConfigStore.OLLAMA_API_URL, OLLAMA_API_URL_DEFAULT);
    await appendFormFrom(settingsLlmUl, ConfigStore.OLLAMA_MODEL, OLLAMA_MODEL_DEFAULT);
}

// Start initialization
initializeForm().catch(error => {
    console.error('Failed to initialize form:', error);
});

async function appendBoolFormFrom(parentUl: HTMLUListElement, config: BoolConfig) {
    // Get the current value asynchronously
    const isChecked = await config.get();
    
    console.log(`Creating checkbox for ${config.key} with initial value:`, isChecked);
    
    // Create a real DOM element for the checkbox
    const li = document.createElement('li');
    
    const label = document.createElement('label');
    label.setAttribute('for', config.key);
    label.textContent = config.description;
    
    const checkbox = document.createElement('input');
    checkbox.setAttribute('type', 'checkbox');
    checkbox.setAttribute('id', config.key);
    checkbox.checked = !!isChecked; // Ensure boolean value
    
    checkbox.addEventListener('change', (event) => {
        console.log('Checkbox changed:', event);
        const target = event.target as HTMLInputElement;
        config.set(target.checked);
    });
    
    const description = document.createElement('p');
    description.className = 'description';
    description.textContent = config.longDescription;
    
    // Append elements to the list item
    li.appendChild(label);
    li.appendChild(checkbox);
    li.appendChild(description);
    
    // Append the list item to the parent
    parentUl.appendChild(li);
}

async function appendFormFrom(parentUl: HTMLUListElement, config: Config, placeholder: string = '') {
    // Get the current value asynchronously
    const value = await config.get();
    const stringValue = (value !== undefined && value !== null) ? String(value) : '';
    
    // Create virtual DOM node
    const vnode = h('li', [
        h('label', { attrs: { for: config.key } }, config.description),
        h('input', {
            attrs: { 
                type: 'text', 
                id: config.key,
                placeholder: placeholder
            },
            props: {
                value: stringValue
            },
            on: {
                input: (event: Event) => {
                    console.log(event);
                    const target = event.target as HTMLInputElement;
                    config.set(target.value);
                }
            }
        }),
        h('p', { attrs: { class: 'description' } }, config.longDescription)
    ]);

    // Patch the real DOM with the virtual DOM
    const newNode = document.createElement('li');
    parentUl.appendChild(newNode);
    patch(newNode, vnode);
}
