
const LOCAL_STORAGE_PREFIX = 'hacky_helper_';

// class representing confugurable values.
export class Config {
    get() {
        throw new Error('Method implemented in subclasses.');
    }
    set(value: string) {
        throw new Error('Method implemented in subclasses.');
    }
    key: string;
    description: string;
    longDescription: string;

    constructor(key: string, description: string, longDescription: string) {
        this.description = description;
        this.longDescription = longDescription;
        this.key = key;
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

        throw new Error('Method not implemented.');
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
        'Reorder Tabs on the end-to-start circulr tab switch.',
        'When enabled, switching from the right-most tab to the left-most tab (circular tab switching) will automatically reorder the tabs');
    ;

    set(key: string, value: any) {
        this.config[key] = value;
        chrome.storage.local.set({ [LOCAL_STORAGE_PREFIX + key]: value }, () => {
            if (chrome.runtime.lastError) {
                console.error('Failed to set value:', chrome.runtime.lastError);
            }
        });
    }

    async get(key: string) {
        let res = await chrome.storage.local.get(LOCAL_STORAGE_PREFIX + key)
        console.log(res)
        if (Object.keys(res).length > 0) {
            this.config[key] = JSON.parse(res[LOCAL_STORAGE_PREFIX + key]);
        }
        return this.config[key];
    }

}

const CONFIG_STORE = new ConfigStore()