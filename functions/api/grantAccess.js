const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

exports.grantAccess = onCall({ region: 'europe-west1' }, async (request) => {
    const { data, auth } = request;

    // 1. Validate Admin Role
    if (!auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const db = admin.firestore();
    const userRef = db.collection('users').doc(auth.uid);
    const userSnap = await userRef.get();

    if (userSnap.data()?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Only admins can grant access.');
    }

    // 2. Validate Inputs
    const { email, playlistId } = data;

    if (!email || !playlistId) {
        throw new HttpsError('invalid-argument', 'Email and playlist ID are required.');
    }

    // 3. Find User by Email
    try {
        const userQuery = await db.collection('users').where('email', '==', email).limit(1).get();

        if (userQuery.empty) {
            throw new HttpsError('not-found', 'User not found.');
        }

        const targetUser = userQuery.docs[0];
        const userId = targetUser.id;

        // 4. Create Access Document
        const accessId = `${playlistId}_${userId}`;
        await db.collection('playlistAccess').doc(accessId).set({
            userId,
            playlistId,
            grantedAt: admin.firestore.FieldValue.serverTimestamp(),
            grantedBy: auth.uid,
        });

        return { success: true, userId };

    } catch (error) {
        if (error.code) throw error; // Rethrow HttpsError
        console.error('Error granting access:', error);
        throw new HttpsError('internal', 'Unable to grant access.');
    }
});
