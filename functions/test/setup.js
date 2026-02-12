/**
 * Jest setup file — runs before each test file.
 * Mocks firebase-functions/v2/https globally so onCall
 * captures the handler and returns it with a .run method.
 */

jest.mock('firebase-functions/v2/https', () => {
    class HttpsError extends Error {
        constructor(code, message) {
            super(message);
            this.code = code;
        }
    }

    return {
        onCall: (_opts, handler) => {
            // Return an object whose .run is the raw handler
            return { run: handler };
        },
        HttpsError,
    };
});
