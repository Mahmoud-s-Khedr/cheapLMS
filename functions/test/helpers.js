/**
 * Shared Firestore mock state.
 * All test files require this and share the same mock data stores.
 * jest.mock() calls must be at each test file's top level.
 */

const _docs = {};
const _queries = {};
const _writes = [];

const stubDoc = (path, data) => {
    _docs[path] = data;
};

const stubQuery = (collectionPath, results) => {
    _queries[collectionPath] = results;
};

const resetAll = () => {
    Object.keys(_docs).forEach(k => delete _docs[k]);
    Object.keys(_queries).forEach(k => delete _queries[k]);
    _writes.length = 0;
};

const makeDocRef = (collection, id) => {
    const path = `${collection}/${id}`;
    return {
        id: id || '__auto__',
        get: jest.fn(async () => {
            const data = _docs[path];
            return {
                exists: data !== undefined && data !== null,
                data: () => data || null,
            };
        }),
        set: jest.fn(async (...args) => {
            _writes.push({ op: 'set', path, args });
        }),
        update: jest.fn(async (...args) => {
            _writes.push({ op: 'update', path, args });
        }),
        delete: jest.fn(async () => {
            _writes.push({ op: 'delete', path });
        }),
    };
};

const mockDb = {
    collection: jest.fn((name) => ({
        doc: jest.fn((id) => makeDocRef(name, id || '__auto__')),
        where: jest.fn(() => ({
            limit: jest.fn(() => ({
                get: jest.fn(async () => {
                    const results = _queries[name] || [];
                    return {
                        empty: results.length === 0,
                        docs: results.map(r => ({
                            id: r.id,
                            data: () => r.data,
                        })),
                    };
                }),
            })),
        })),
    })),
};

const mockAdmin = {
    initializeApp: jest.fn(),
    firestore: jest.fn(() => mockDb),
};
mockAdmin.firestore.FieldValue = {
    serverTimestamp: () => 'SERVER_TIMESTAMP',
    increment: (n) => `INCREMENT_${n}`,
};

module.exports = {
    mockAdmin,
    mockDb,
    stubDoc,
    stubQuery,
    resetAll,
    writes: _writes,
};
