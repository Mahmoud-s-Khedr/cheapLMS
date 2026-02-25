const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

// Listens for new items (videos) added to a playlist
exports.onVideoAddedToPlaylist = onDocumentCreated(
    {
        document: 'playlists/{playlistId}/items/{itemId}',
        region: 'europe-west1'
    },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) return;

        const itemData = snapshot.data();
        const db = admin.firestore();

        try {
            // Get playlist and video details for better notification context
            const [playlistSnap, videoSnap] = await Promise.all([
                db.collection('playlists').doc(event.params.playlistId).get(),
                db.collection('videos').doc(itemData.videoId).get()
            ]);

            const playlistTitle = playlistSnap.exists ? playlistSnap.data().title : 'a playlist';
            const videoTitle = videoSnap.exists ? videoSnap.data().title : 'A new video';

            // Create a broadcast notification
            await db.collection('notifications').add({
                title: 'New Content Available',
                message: `"${videoTitle}" has been added to "${playlistTitle}".`,
                type: 'course',
                targetId: 'all',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`Video added notification sent for video ${itemData.videoId} in playlist ${event.params.playlistId}`);
        } catch (error) {
            console.error('Error creating video added notification:', error);
        }
    }
);
