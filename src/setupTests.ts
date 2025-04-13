global.localStorage = {
  getItem: jest.fn((key) => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

global.chrome = {
  bookmarks: {
    create: jest.fn(),
    get: jest.fn(),
    getTree: jest.fn(),
    search: jest.fn(),
    getRecent: jest.fn(),
    move: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
  runtime: {
    lastError: null,
  },
  storage: {
    local: {
      get: jest.fn((keys, callback) =>
        callback({ BOOKMARK_PARENT_ID: "default_parent_id" }),
      ),
      set: jest.fn((items, callback) => callback && callback()),
      remove: jest.fn((keys, callback) => callback && callback()),
      clear: jest.fn((callback) => callback && callback()),
    },
  },
};
