const { mockAdmin, stubDoc, stubQuery, resetAll, writes } = require('./helpers');

jest.mock('firebase-admin', () => mockAdmin);
jest.mock('firebase-functions/v2/https', () => ({
    onCall: (_opts, handler) => ({ run: handler }),
    HttpsError: class HttpsError extends Error {
        constructor(code, message) { super(message); this.code = code; }
    },
}));

const { grantAccess } = require('../api/grantAccess');

beforeEach(() => resetAll());

describe('grantAccess', () => {
    test('rejects unauthenticated requests', async () => {
        await expect(grantAccess.run({ data: { email: 'a@b.com', playlistId: 'p1' }, auth: null }))
            .rejects.toThrow('User must be logged in');
    });

    test('rejects non-admin users', async () => {
        stubDoc('users/u1', { role: 'student' });
        await expect(grantAccess.run({
            data: { email: 'a@b.com', playlistId: 'p1' },
            auth: { uid: 'u1' },
        })).rejects.toThrow('Only admins can grant access');
    });

    test('rejects missing email', async () => {
        stubDoc('users/admin1', { role: 'admin' });
        await expect(grantAccess.run({
            data: { playlistId: 'p1' },
            auth: { uid: 'admin1' },
        })).rejects.toThrow('Email and playlist ID are required');
    });

    test('returns not-found for unknown email', async () => {
        stubDoc('users/admin1', { role: 'admin' });
        stubQuery('users', []);
        await expect(grantAccess.run({
            data: { email: 'nobody@test.com', playlistId: 'p1' },
            auth: { uid: 'admin1' },
        })).rejects.toThrow('User not found');
    });

    test('creates access document on success', async () => {
        stubDoc('users/admin1', { role: 'admin' });
        stubQuery('users', [{ id: 'target1', data: { email: 'student@test.com' } }]);

        const result = await grantAccess.run({
            data: { email: 'student@test.com', playlistId: 'p1' },
            auth: { uid: 'admin1' },
        });

        expect(result.success).toBe(true);
        expect(result.userId).toBe('target1');
        expect(writes).toContainEqual(
            expect.objectContaining({ op: 'set', path: 'playlistAccess/p1_target1' })
        );
    });
});
