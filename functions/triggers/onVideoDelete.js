const { onDocumentDeleted } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

exports.onVideoDelete = onDocumentDeleted({
    document: 'videos/{videoId}',
    region: 'europe-west1'
}, async (event) => {
    const snap = event.data;
    if (!snap) {
        console.log("No data associated with the event");
        return;
    }
    const videoData = snap.data();
    const videoId = event.params.videoId;
    const playlistIds = videoData.playlistIds || [];

    console.log(`Video ${videoId} deleted. Cleaning up references in ${playlistIds.length} playlists.`);

    const db = admin.firestore();

    // 1. Remove from all playlists listed in videoData
    const updates = playlistIds.map(async (playlistId) => {
        try {
            // Remove from 'items' subcollection
            await db.collection('playlists').doc(playlistId).collection('items').doc(videoId).delete();

            // Decrement videoCount on playlist
            await db.collection('playlists').doc(playlistId).update({
                videoCount: admin.firestore.FieldValue.increment(-1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`Removed video ${videoId} from playlist ${playlistId}`);
        } catch (error) {
            console.error(`Failed to cleanup playlist ${playlistId} for video ${videoId}:`, error);
        }
    });

    await Promise.all(updates);
    console.log(`Cleanup complete for video ${videoId}`);
});
