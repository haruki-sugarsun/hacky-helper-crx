
const LOCAL_STORAGE_PREFIX = 'hacky_helper_';

export class ConfigStore {

    private config: Record<string, any> = {};
    static SORT_ON_TAB_SWITCH: any;

    set(key: string, value: any) {
        this.config[key] = value;
        localStorage.setItem(LOCAL_STORAGE_PREFIX + key, JSON.stringify(value));
    }

    get(key: string) {
        const storedValue = localStorage.getItem(LOCAL_STORAGE_PREFIX + key);
        if (storedValue !== null) {
            this.config[key] = JSON.parse(storedValue);
        }
        return this.config[key];
    }

    SORT_ON_TAB_SWITCH = new BoolConfig('SORT_ON_TAB_SWITCH');
}

class BoolConfig {
    key: string;

    constructor(key: string) {
        this.key = key;
    }
}
