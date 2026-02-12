const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

exports.revokeAccess = onCall({ region: 'europe-west1' }, async (request) => {
    const { data, auth } = request;

    // 1. Validate Admin Role
    if (!auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const db = admin.firestore();
    const userRef = db.collection('users').doc(auth.uid);
    const userSnap = await userRef.get();

    if (userSnap.data()?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Only admins can revoke access.');
    }

    // 2. Validate Inputs
    const { userId, playlistId } = data;

    if (!userId || !playlistId) {
        throw new HttpsError('invalid-argument', 'User ID and Playlist ID are required.');
    }

    // 3. Delete Access Document
    try {
        const accessId = `${playlistId}_${userId}`;
        await db.collection('playlistAccess').doc(accessId).delete();

        return { success: true };

    } catch (error) {
        console.error('Error revoking access:', error);
        throw new HttpsError('internal', 'Unable to revoke access.');
    }
});
