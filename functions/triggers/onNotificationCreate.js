const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

// Listens for ANY new notification and sends an FCM push
exports.onNotificationCreate = onDocumentCreated(
    {
        document: 'notifications/{notificationId}',
        region: 'europe-west1'
    },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) return;

        const notifData = snapshot.data();
        const db = admin.firestore();

        try {
            let tokens = [];

            if (notifData.targetId === 'all') {
                // Broadcast to all students
                const usersSnap = await db.collection('users').get();
                usersSnap.forEach(doc => {
                    const userData = doc.data();
                    if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
                        tokens.push(...userData.fcmTokens);
                    }
                });
            } else if (notifData.targetId === 'admin') {
                // Send to all admins
                const adminsSnap = await db.collection('users').where('role', '==', 'admin').get();
                adminsSnap.forEach(doc => {
                    const adminData = doc.data();
                    if (adminData.fcmTokens && Array.isArray(adminData.fcmTokens)) {
                        tokens.push(...adminData.fcmTokens);
                    }
                });
            } else {
                // Target a specific user
                const userSnap = await db.collection('users').doc(notifData.targetId).get();
                if (userSnap.exists) {
                    const userData = userSnap.data();
                    if (userData.fcmTokens && Array.isArray(userData.fcmTokens)) {
                        tokens.push(...userData.fcmTokens);
                    }
                }
            }

            // Remove duplicates
            tokens = [...new Set(tokens)];

            if (tokens.length > 0) {
                const message = {
                    notification: {
                        title: notifData.title,
                        body: notifData.message,
                    },
                    tokens: tokens,
                };

                const response = await admin.messaging().sendEachForMulticast(message);
                console.log(`Successfully sent ${response.successCount} messages; ${response.failureCount} failed.`);

                // Optional: Clean up failed tokens if needed in the future
            } else {
                console.log('No FCM tokens found for target:', notifData.targetId);
            }
        } catch (error) {
            console.error('Error sending FCM push notification:', error);
        }
    }
);
