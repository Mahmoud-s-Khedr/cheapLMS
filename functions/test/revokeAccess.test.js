const { mockAdmin, stubDoc, resetAll, writes } = require('./helpers');

jest.mock('firebase-admin', () => mockAdmin);
jest.mock('firebase-functions/v2/https', () => ({
    onCall: (_opts, handler) => ({ run: handler }),
    HttpsError: class HttpsError extends Error {
        constructor(code, message) { super(message); this.code = code; }
    },
}));

const { revokeAccess } = require('../api/revokeAccess');

beforeEach(() => resetAll());

describe('revokeAccess', () => {
    test('rejects unauthenticated requests', async () => {
        await expect(revokeAccess.run({ data: { userId: 'u1', playlistId: 'p1' }, auth: null }))
            .rejects.toThrow('User must be logged in');
    });

    test('rejects non-admin users', async () => {
        stubDoc('users/u1', { role: 'student' });
        await expect(revokeAccess.run({
            data: { userId: 'u2', playlistId: 'p1' },
            auth: { uid: 'u1' },
        })).rejects.toThrow('Only admins can revoke access');
    });

    test('rejects missing userId', async () => {
        stubDoc('users/admin1', { role: 'admin' });
        await expect(revokeAccess.run({
            data: { playlistId: 'p1' },
            auth: { uid: 'admin1' },
        })).rejects.toThrow('User ID and Playlist ID are required');
    });

    test('deletes access document on success', async () => {
        stubDoc('users/admin1', { role: 'admin' });
        const result = await revokeAccess.run({
            data: { userId: 'u1', playlistId: 'p1' },
            auth: { uid: 'admin1' },
        });
        expect(result.success).toBe(true);
        expect(writes).toContainEqual(
            expect.objectContaining({ op: 'delete', path: 'playlistAccess/p1_u1' })
        );
    });
});
