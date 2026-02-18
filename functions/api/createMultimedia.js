const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

exports.createMultimedia = onCall({ region: 'europe-west1' }, async (request) => {
    const { data, auth } = request;

    // 1. Validate Admin Role
    if (!auth) {
        throw new HttpsError('unauthenticated', 'User must be logged in.');
    }

    const db = admin.firestore();
    const userRef = db.collection('users').doc(auth.uid);
    const userSnap = await userRef.get();

    if (userSnap.data()?.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Only admins can upload multimedia.');
    }

    // 2. Validate Inputs
    const { title, type, fileUrl, fileName, fileSize, mimeType, videoId } = data;

    if (!title || !type || !fileUrl || !fileName) {
        throw new HttpsError('invalid-argument', 'Missing required fields: title, type, fileUrl, fileName.');
    }

    const validTypes = ['voicenote', 'image', 'pdf'];
    if (!validTypes.includes(type)) {
        throw new HttpsError('invalid-argument', `Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    // 3. Create Multimedia Document
    try {
        const multimediaRef = db.collection('multimedia').doc();
        await multimediaRef.set({
            title,
            type,
            fileUrl,
            fileName,
            fileSize: fileSize || 0,
            mimeType: mimeType || 'application/octet-stream',
            videoId: videoId || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { multimediaId: multimediaRef.id };

    } catch (error) {
        console.error('Error creating multimedia:', error);
        throw new HttpsError('internal', 'Unable to create multimedia.');
    }
});
