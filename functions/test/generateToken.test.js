const { mockAdmin, stubDoc, resetAll, writes } = require('./helpers');

// Must be at top level for Jest hoisting
jest.mock('firebase-admin', () => mockAdmin);
jest.mock('firebase-functions/v2/https', () => ({
    onCall: (_opts, handler) => ({ run: handler }),
    HttpsError: class HttpsError extends Error {
        constructor(code, message) { super(message); this.code = code; }
    },
}));
jest.mock('jsonwebtoken', () => ({
    sign: jest.fn(() => 'mock-jwt-token'),
}));

const { generateToken } = require('../api/generateToken');

beforeEach(() => resetAll());

describe('generateToken', () => {
    test('rejects unauthenticated requests', async () => {
        await expect(generateToken.run({ data: { videoId: 'v1' }, auth: null }))
            .rejects.toThrow('User must be logged in');
    });

    test('rejects missing videoId', async () => {
        await expect(generateToken.run({ data: {}, auth: { uid: 'u1' } }))
            .rejects.toThrow('Video ID is required');
    });

    test('returns not-found for missing video', async () => {
        await expect(generateToken.run({ data: { videoId: 'missing' }, auth: { uid: 'u1' } }))
            .rejects.toThrow('Video not found');
    });

    test('rejects user without playlist access', async () => {
        stubDoc('videos/v1', { playlistId: 'p1', r2Path: 'videos/v1' });
        stubDoc('users/u1', { role: 'student' });

        await expect(generateToken.run({ data: { videoId: 'v1' }, auth: { uid: 'u1' } }))
            .rejects.toThrow('You do not have access');
    });

    test('admin bypasses access check and gets token', async () => {
        stubDoc('videos/v1', { playlistId: 'p1', r2Path: 'videos/v1' });
        stubDoc('users/admin1', { role: 'admin' });

        const result = await generateToken.run({ data: { videoId: 'v1' }, auth: { uid: 'admin1' } });
        expect(result).toHaveProperty('token', 'mock-jwt-token');
    });
});
