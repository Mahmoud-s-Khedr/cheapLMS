const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

exports.onUserCreate = functions.region('europe-west1').auth.user().onCreate(async (user) => {
    const db = admin.firestore();

    const userDoc = {
        email: user.email,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        role: 'student', // Default role
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    try {
        await db.collection('users').doc(user.uid).set(userDoc);
        console.log(`User profile created for ${user.uid}`);
    } catch (error) {
        console.error('Error creating user profile:', error);
    }
});
