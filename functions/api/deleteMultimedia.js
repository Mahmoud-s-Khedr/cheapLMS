const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

exports.deleteMultimedia = onCall({ region: 'europe-west1' }, async (request) => {
    const { data, auth } = request;

    // 1. Validate Admin Role
    if (!auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const db = admin.firestore();
    const userRef = db.collection('users').doc(auth.uid);
    const userSnap = await userRef.get();

    if (userSnap.data()?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Only admins can delete multimedia.');
    }

    // 2. Validate Inputs
    const { multimediaId } = data;

    if (!multimediaId) {
        throw new HttpsError('invalid-argument', 'Multimedia ID is required.');
    }

    // 3. Delete Multimedia Document
    try {
        const multimediaRef = db.collection('multimedia').doc(multimediaId);
        const multimediaSnap = await multimediaRef.get();

        if (!multimediaSnap.exists) {
            throw new HttpsError('not-found', 'Multimedia not found.');
        }

        await multimediaRef.delete();

        return { success: true, deletedId: multimediaId };

    } catch (error) {
        if (error.code) throw error; // Rethrow HttpsError
        console.error('Error deleting multimedia:', error);
        throw new HttpsError('internal', 'Unable to delete multimedia.');
    }
});
