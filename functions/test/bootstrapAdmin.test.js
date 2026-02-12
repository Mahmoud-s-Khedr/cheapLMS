const { mockAdmin, resetAll, writes } = require('./helpers');

jest.mock('firebase-admin', () => mockAdmin);
jest.mock('firebase-functions/v2/https', () => ({
    onCall: (_opts, handler) => ({ run: handler }),
    HttpsError: class HttpsError extends Error {
        constructor(code, message) { super(message); this.code = code; }
    },
}));

const { bootstrapAdmin } = require('../api/bootstrapAdmin');

beforeEach(() => resetAll());
afterEach(() => { delete process.env.BOOTSTRAP_ADMIN_UID; });

describe('bootstrapAdmin', () => {
    test('rejects unauthenticated requests', async () => {
        await expect(bootstrapAdmin.run({ data: {}, auth: null }))
            .rejects.toThrow('User must be logged in');
    });

    test('rejects when BOOTSTRAP_ADMIN_UID not set', async () => {
        delete process.env.BOOTSTRAP_ADMIN_UID;
        await expect(bootstrapAdmin.run({ data: {}, auth: { uid: 'u1' } }))
            .rejects.toThrow('BOOTSTRAP_ADMIN_UID is not configured');
    });

    test('rejects wrong UID', async () => {
        process.env.BOOTSTRAP_ADMIN_UID = 'correct-uid';
        await expect(bootstrapAdmin.run({ data: {}, auth: { uid: 'wrong-uid' } }))
            .rejects.toThrow('Not allowed to bootstrap admin');
    });

    test('promotes correct UID to admin', async () => {
        process.env.BOOTSTRAP_ADMIN_UID = 'correct-uid';
        const result = await bootstrapAdmin.run({ data: {}, auth: { uid: 'correct-uid' } });
        expect(result.ok).toBe(true);
        expect(result.uid).toBe('correct-uid');
        expect(writes).toContainEqual(
            expect.objectContaining({ op: 'set', path: 'users/correct-uid' })
        );
    });
});
