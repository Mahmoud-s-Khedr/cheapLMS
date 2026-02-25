const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

// Listens for new access granted documents
exports.onAccessGranted = onDocumentCreated(
    {
        document: 'playlistAccess/{accessId}',
        region: 'europe-west1'
    },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) return;

        const accessData = snapshot.data();
        const db = admin.firestore();

        try {
            // Get playlist details for a better notification title
            const playlistSnap = await db.collection('playlists').doc(accessData.playlistId).get();
            const playlistTitle = playlistSnap.exists ? playlistSnap.data().title : 'a course';

            // Create notification targeting the specific user
            await db.collection('notifications').add({
                title: 'Access Granted',
                message: `You have been granted access to "${playlistTitle}". Start learning now!`,
                type: 'system',
                targetId: accessData.userId,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`Access granting notification sent to user ${accessData.userId} for playlist ${accessData.playlistId}`);
        } catch (error) {
            console.error('Error creating access notification:', error);
        }
    }
);
