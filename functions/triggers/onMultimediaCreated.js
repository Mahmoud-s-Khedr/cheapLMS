const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

// Listens for new multimedia (documents, voice notes) created
exports.onMultimediaCreated = onDocumentCreated(
    {
        document: 'multimedia/{mediaId}',
        region: 'europe-west1'
    },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) return;

        const mediaData = snapshot.data();
        const db = admin.firestore();

        try {
            // Get video details for context
            const videoSnap = await db.collection('videos').doc(mediaData.videoId).get();
            const videoTitle = videoSnap.exists ? videoSnap.data().title : 'a video';

            const mediaTypeStr = mediaData.type === 'pdf' ? 'document' :
                mediaData.type === 'voicenote' ? 'voice note' : 'multimedia file';

            // Create a broadcast notification
            await db.collection('notifications').add({
                title: 'New Learning Material',
                message: `A new ${mediaTypeStr} ("${mediaData.title}") has been added to "${videoTitle}".`,
                type: 'course',
                targetId: 'all',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`Multimedia notification sent for media ${event.params.mediaId}`);
        } catch (error) {
            console.error('Error creating multimedia notification:', error);
        }
    }
);
