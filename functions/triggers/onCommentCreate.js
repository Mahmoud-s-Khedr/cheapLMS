const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

// Listens for new comments under videos
exports.onCommentCreate = onDocumentCreated(
    {
        document: 'videos/{videoId}/comments/{commentId}',
        region: 'europe-west1'
    },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) return;

        const commentData = snapshot.data();
        const videoId = event.params.videoId;
        const db = admin.firestore();

        try {
            // Get video details for a better notification title
            const videoSnap = await db.collection('videos').doc(videoId).get();
            const videoTitle = videoSnap.exists ? videoSnap.data().title : 'a video';
            const userName = commentData.userName || 'A student';

            // Create notification targeting admins
            await db.collection('notifications').add({
                title: 'New Comment',
                message: `${userName} left a comment on "${videoTitle}".`,
                type: 'system',
                targetId: 'admin',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`Notification created for new comment on video ${videoId}`);
        } catch (error) {
            console.error('Error creating comment notification:', error);
        }
    }
);
