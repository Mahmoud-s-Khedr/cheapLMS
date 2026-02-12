const { mockAdmin, resetAll, writes } = require('./helpers');

jest.mock('firebase-admin', () => mockAdmin);

// Capture the onCreate handler
let onCreateHandler;
jest.mock('firebase-functions/v1', () => ({
    region: () => ({
        auth: {
            user: () => ({
                onCreate: (handler) => {
                    onCreateHandler = handler;
                    return handler;
                },
            }),
        },
    }),
}));

require('../triggers/onUserCreate');

beforeEach(() => resetAll());

describe('onUserCreate', () => {
    test('creates user document with student role', async () => {
        const mockUser = {
            uid: 'new-user-1',
            email: 'student@example.com',
            displayName: 'Test Student',
            photoURL: 'https://photo.url/pic.jpg',
        };

        await onCreateHandler(mockUser);

        const writeCall = writes.find(w => w.path === 'users/new-user-1');
        expect(writeCall).toBeDefined();

        const writtenData = writeCall.args[0];
        expect(writtenData.role).toBe('student');
        expect(writtenData.email).toBe('student@example.com');
        expect(writtenData.displayName).toBe('Test Student');
    });

    test('handles missing optional fields', async () => {
        const mockUser = {
            uid: 'new-user-2',
            email: 'bare@example.com',
        };

        await onCreateHandler(mockUser);

        const writeCall = writes.find(w => w.path === 'users/new-user-2');
        expect(writeCall).toBeDefined();

        const writtenData = writeCall.args[0];
        expect(writtenData.displayName).toBe('');
        expect(writtenData.photoURL).toBe('');
    });
});
