const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');

exports.generateToken = onCall({ region: 'europe-west1' }, async (request) => {
    const { data, auth } = request;

    // 1. Validate Authentication
    if (!auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { videoId } = data;
    if (!videoId) {
        throw new HttpsError('invalid-argument', 'Video ID is required.');
    }

    const db = admin.firestore();
    const userId = auth.uid;

    try {
        // 2. Initial Fetch: Get Video Metadata
        const videoRef = db.collection('videos').doc(videoId);
        const videoSnap = await videoRef.get();

        if (!videoSnap.exists) {
            throw new HttpsError('not-found', 'Video not found.');
        }

        const videoData = videoSnap.data();
        const playlistId = videoData.playlistId;

        // 3. Authorization Check: Does user have access to this playlist?
        // Skip check if user is admin
        const userSnap = await db.collection('users').doc(userId).get();
        const isAdmin = userSnap.data()?.role === 'admin';

        if (!isAdmin) {
            const accessId = `${playlistId}_${userId}`;
            const accessSnap = await db.collection('playlistAccess').doc(accessId).get();

            if (!accessSnap.exists) {
                throw new HttpsError('permission-denied', 'You do not have access to this content.');
            }
        }

        // 4. Generate JWT
        // This secret MUST match the one in your Cloudflare Worker's wrangler.toml
        const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key-change-me';

        // Payload matches what the Worker expects
        const payload = {
            sub: userId,
            videoPath: videoData.r2Path, // Scope token to specific video path
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour expiry
        };

        const token = jwt.sign(payload, jwtSecret);

        return { token };

    } catch (error) {
        console.error('Error generating token:', error);
        // Rethrow known errors, wrap unknown ones
        if (error.code) throw error;
        throw new HttpsError('internal', 'Unable to generate token.');
    }
});
