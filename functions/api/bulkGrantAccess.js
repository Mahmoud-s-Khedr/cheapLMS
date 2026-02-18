const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

exports.bulkGrantAccess = onCall({ region: 'europe-west1' }, async (request) => {
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
    const { playlistId, emails } = data;

    if (!playlistId || !Array.isArray(emails) || emails.length === 0) {
        throw new HttpsError('invalid-argument', 'Playlist ID and a non-empty emails array are required.');
    }

    if (emails.length > 100) {
        throw new HttpsError('invalid-argument', 'Maximum 100 emails per request.');
    }

    // 3. Look up users by email and grant access in a batch
    try {
        const granted = [];
        const notFound = [];
        const batch = db.batch();

        for (const email of emails) {
            const trimmed = email.trim().toLowerCase();
            if (!trimmed) continue;

            const userQuery = await db.collection('users').where('email', '==', trimmed).limit(1).get();

            if (userQuery.empty) {
                notFound.push(trimmed);
                continue;
            }

            const targetUser = userQuery.docs[0];
            const userId = targetUser.id;
            const accessId = `${playlistId}_${userId}`;

            batch.set(db.collection('playlistAccess').doc(accessId), {
                userId,
                playlistId,
                grantedAt: admin.firestore.FieldValue.serverTimestamp(),
                grantedBy: auth.uid,
            });

            granted.push({ email: trimmed, userId });
        }

        await batch.commit();

        return { success: true, granted, notFound };

    } catch (error) {
        if (error.code) throw error;
        console.error('Error in bulkGrantAccess:', error);
        throw new HttpsError('internal', 'Unable to grant access.');
    }
});
