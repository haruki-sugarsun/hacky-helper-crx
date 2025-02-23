const LOCAL_STORAGE_PREFIX = 'hacky_helper_';

// Class representing configurable values.
export class Config {
    key: string;
    description: string;
    longDescription: string;

    constructor(key: string, description: string, longDescription: string) {
        this.key = key;
        this.description = description;
        this.longDescription = longDescription;
    }

    get() {
        throw new Error('Method implemented in subclasses.');
    }

    set(_value: any) {
        throw new Error('Method implemented in subclasses.');
    }
}

class BoolConfig extends Config {
    constructor(key: string, description: string, longDescription: string) {
        super(key, description, longDescription);
    }

    get() {
        const value = CONFIG_STORE.get(this.key);
        if (typeof value === 'boolean') {
            return value;
        } else {
            console.warn(`Expected boolean for key ${this.key}, but got ${typeof value}`);
            return false;
        }
    }

    set(value: boolean) {
        try {
            CONFIG_STORE.set(this.key, value);
            return true;
        } catch (error) {
            console.error('Failed to set value:', error);
            return false;
        }
    }
}

class StringConfig extends Config {
    constructor(key: string, description: string, longDescription: string) {
        super(key, description, longDescription);
    }

    async get() {
        const value = await CONFIG_STORE.get(this.key);
        if (typeof value === 'string') {
            return value;
        } else {
            console.warn(`Expected string for key ${this.key}, but got ${typeof value}`);
            return '';
        }
    }

    set(value: string) {
        try {
            CONFIG_STORE.set(this.key, value);
            return true;
        } catch (error) {
            console.error('Failed to set value:', error);
            return false;
        }
    }
}

export class ConfigStore {
    private config: Record<string, any> = {};

    static SORT_ON_TAB_SWITCH = new BoolConfig(
        'SORT_ON_TAB_SWITCH',
        'Reorder Tabs on the end-to-start circular tab switch.',
        'When enabled, switching from the right-most tab to the left-most tab (circular tab switching) will automatically reorder the tabs'
    );

    static OPENAI_API_KEY = new StringConfig(
        'OPENAI_API_KEY',
        'OpenAI API Key',
        'The API key used to authenticate requests to the OpenAI service for tab summarization.'
    );

    static BOOKMARK_PARENT_ID = new StringConfig(
        'bookmarkParentId',
        'Bookmark Parent ID',
        'The parent folder ID where bookmark groups are stored.'
    );

    constructor() {
        // Initialize configurations if needed
    }

    set(key: string, value: any) {
        this.config[key] = value;
        chrome.storage.local.set({ [LOCAL_STORAGE_PREFIX + key]: JSON.stringify(value) }, () => {
            if (chrome.runtime.lastError) {
                console.error('Failed to set value:', chrome.runtime.lastError);
            }
        });
    }

    async get(key: string) {
        let res = await chrome.storage.local.get(LOCAL_STORAGE_PREFIX + key);
        console.log(res);
        if (Object.keys(res).length > 0 && res[LOCAL_STORAGE_PREFIX + key] !== undefined) {
            this.config[key] = JSON.parse(res[LOCAL_STORAGE_PREFIX + key]);
        }
        return this.config[key];
    }
}

export const CONFIG_STORE = new ConfigStore();

/**
 * Retrieves all configuration settings.
 * @returns An object containing all configuration settings.
 */
export async function getConfig() {
    const bookmarkParentId = await CONFIG_STORE.get('bookmarkParentId');
    const openaiApiKey = await CONFIG_STORE.get('OPENAI_API_KEY');
    // Add other config values as needed
    return {
        bookmarkParentId,
        OPENAI_API_KEY: openaiApiKey,
    };
}
