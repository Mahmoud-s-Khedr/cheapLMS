const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

exports.createVideo = onCall({ region: 'europe-west1' }, async (request) => {
    const { data, auth } = request;

    // 1. Validate Admin Role
    if (!auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const db = admin.firestore();
    const userRef = db.collection('users').doc(auth.uid);
    const userSnap = await userRef.get();

    if (userSnap.data()?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Only admins can create videos.');
    }

    // 2. Validate Inputs
    const { title, description, playlistId, r2Path, durationSeconds, position } = data;

    if (!title || !playlistId || !r2Path) {
        throw new HttpsError('invalid-argument', 'Missing required fields.');
    }

    // 3. Create Video Document
    try {
        const videoRef = db.collection('videos').doc();
        await videoRef.set({
            title,
            description: description || '',
            playlistId,
            r2Path,
            durationSeconds: durationSeconds || 0,
            position: position || 0,
            status: 'ready',
            uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 4. Update Playlist Count
        await db.collection('playlists').doc(playlistId).update({
            videoCount: admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { videoId: videoRef.id };

    } catch (error) {
        console.error('Error creating video:', error);
        throw new HttpsError('internal', 'Unable to create video.');
    }
});
