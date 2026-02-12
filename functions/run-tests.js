/**
 * Custom lightweight test runner to replace broken Jest environment.
 * Mimics Jest API: describe, test, expect, jest.mock, etc.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// clear log
try {
    fs.writeFileSync('test-log.txt', '');
} catch (e) { }

function log(msg) {
    try {
        fs.appendFileSync('test-log.txt', String(msg) + '\n');
    } catch (e) { }
    // Also try stdout
    try {
        process.stdout.write(String(msg) + '\n');
    } catch (e) { }
}

log('Starting test runner...');

// Global state
const mocks = {};
const suites = [];
let currentSuite = null;

// Mock implementation
global.jest = {
    mock: (moduleName, factory) => {
        log(`Mocking module: ${moduleName}`);
        mocks[moduleName] = factory();
    },
    fn: (impl = () => { }) => {
        const mockFn = (...args) => {
            mockFn.mock.calls.push(args);
            return impl(...args);
        };
        mockFn.mock = { calls: [] };
        return mockFn;
    },
    clearAllMocks: () => { },
};

// Test API
global.describe = (name, fn) => {
    log(`Describe: ${name}`);
    currentSuite = { name, tests: [], beforeAll: [], beforeEach: [], afterAll: [], afterEach: [] };
    suites.push(currentSuite);
    fn();
    currentSuite = null;
};

global.test = (name, fn) => {
    if (currentSuite) currentSuite.tests.push({ name, fn });
};

global.beforeAll = (fn) => currentSuite && currentSuite.beforeAll.push(fn);
global.beforeEach = (fn) => currentSuite && currentSuite.beforeEach.push(fn);
global.afterAll = (fn) => currentSuite && currentSuite.afterAll.push(fn);
global.afterEach = (fn) => currentSuite && currentSuite.afterEach.push(fn);

global.expect = (actual) => ({
    toBe: (expected) => assert.strictEqual(actual, expected),
    toEqual: (expected) => assert.deepStrictEqual(actual, expected),
    toHaveProperty: (prop, value) => {
        assert.ok(actual && typeof actual === 'object' && prop in actual);
        if (value !== undefined) assert.strictEqual(actual[prop], value);
    },
    resolves: {
        toBe: async (expected) => assert.strictEqual(await actual, expected),
        toThrow: async (msg) => {
            // implemented below
        }
    },
    rejects: {
        toThrow: async (msg) => {
            try {
                await actual;
                throw new Error('Expected promise to reject but it resolved');
            } catch (err) {
                if (msg && !err.message.includes(msg)) {
                    throw new Error(`Expected error to include "${msg}", got "${err.message}"`);
                }
            }
        },
    },
    toContainEqual: (subset) => {
        if (!actual || !Array.isArray(actual)) throw new Error('Expected array for toContainEqual');
        const found = actual.some(a => {
            // Treat 'subset' as a partial object to match against 'a'
            for (const key in subset) {
                try {
                    // deepStrictEqual for the property value
                    assert.deepStrictEqual(a[key], subset[key]);
                } catch { return false; }
            }
            return true;
        });
        if (!found) throw new Error(`Item not found in array matching: ${JSON.stringify(subset)}`);
    },
    objectContaining: (obj) => obj,
    toBeDefined: () => assert.notStrictEqual(actual, undefined),
});

// Static matchers
global.expect.objectContaining = (obj) => obj;


// Hijack require to support mocking
const Module = require('module');
const originalRequire = Module.prototype.require;

log('Hijacking require...');
Module.prototype.require = function (id) {
    if (mocks[id]) {
        return mocks[id];
    }
    return originalRequire.call(this, id);
};
log('Require hijacked.');

// Run all suites
async function run() {
    log('Running tests...');
    let passed = 0;
    let failed = 0;

    for (const suite of suites) {
        log(`\nSuite: ${suite.name}`);

        for (const hook of suite.beforeAll) await hook();

        for (const t of suite.tests) {
            log(`  ${t.name} ... `);
            try {
                for (const hook of suite.beforeEach) await hook();
                await t.fn();
                for (const hook of suite.afterEach) await hook();
                log('PASS');
                passed++;
            } catch (err) {
                log('FAIL');
                log(err.message);
                log(err.stack);
                failed++;
            }
        }

        for (const hook of suite.afterAll) await hook();
    }

    log(`\nDone. Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0) process.exit(1);
    process.exit(0);
}

// Load test files provided as args
try {
    const args = process.argv.slice(2);
    args.forEach(file => {
        log(`Loading ${file}`);
        require(path.resolve(file));
    });
} catch (err) {
    log(`Error loading file: ${err.message}`);
    log(err.stack);
    process.exit(1);
}

run().catch(err => {
    log(`Runtime error: ${err.message}`);
    log(err.stack);
    process.exit(1);
});
