const { mockAdmin, stubDoc, resetAll, writes } = require('./helpers');

jest.mock('firebase-admin', () => mockAdmin);
jest.mock('firebase-functions/v2/https', () => ({
    onCall: (_opts, handler) => ({ run: handler }),
    HttpsError: class HttpsError extends Error {
        constructor(code, message) { super(message); this.code = code; }
    },
}));

const { createVideo } = require('../api/createVideo');

beforeEach(() => resetAll());

describe('createVideo', () => {
    test('rejects unauthenticated requests', async () => {
        await expect(createVideo.run({
            data: { title: 'v', playlistId: 'p', r2Path: 'r' },
            auth: null,
        })).rejects.toThrow('User must be logged in');
    });

    test('rejects non-admin users', async () => {
        stubDoc('users/u1', { role: 'student' });
        await expect(createVideo.run({
            data: { title: 'v', playlistId: 'p', r2Path: 'r' },
            auth: { uid: 'u1' },
        })).rejects.toThrow('Only admins can create videos');
    });

    test('rejects missing required fields', async () => {
        stubDoc('users/admin1', { role: 'admin' });
        await expect(createVideo.run({
            data: { title: 'v' },
            auth: { uid: 'admin1' },
        })).rejects.toThrow('Missing required fields');
    });

    test('creates video and increments playlist count', async () => {
        stubDoc('users/admin1', { role: 'admin' });
        const result = await createVideo.run({
            data: {
                title: 'Lecture 1',
                playlistId: 'p1',
                r2Path: 'videos/p1/lecture1',
                durationSeconds: 300,
                position: 1,
            },
            auth: { uid: 'admin1' },
        });
        expect(result).toHaveProperty('videoId');
        expect(writes).toContainEqual(
            expect.objectContaining({ op: 'set', path: 'videos/__auto__' })
        );
        expect(writes).toContainEqual(
            expect.objectContaining({ op: 'update', path: 'playlists/p1' })
        );
    });
});
