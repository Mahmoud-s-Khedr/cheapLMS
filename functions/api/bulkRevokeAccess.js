const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

exports.bulkRevokeAccess = onCall({ region: 'europe-west1' }, async (request) => {
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
    const { playlistId, userIds } = data;

    if (!playlistId || !Array.isArray(userIds) || userIds.length === 0) {
        throw new HttpsError('invalid-argument', 'Playlist ID and a non-empty userIds array are required.');
    }

    if (userIds.length > 100) {
        throw new HttpsError('invalid-argument', 'Maximum 100 users per request.');
    }

    // 3. Batch delete access documents
    try {
        const batch = db.batch();

        for (const userId of userIds) {
            const accessId = `${playlistId}_${userId}`;
            batch.delete(db.collection('playlistAccess').doc(accessId));
        }

        await batch.commit();

        return { success: true, revokedCount: userIds.length };

    } catch (error) {
        console.error('Error in bulkRevokeAccess:', error);
        throw new HttpsError('internal', 'Unable to revoke access.');
    }
});
