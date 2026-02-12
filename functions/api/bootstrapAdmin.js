const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

// One-off helper: promotes a single UID (the caller) to admin.
// Guarded by BOOTSTRAP_ADMIN_UID so random users cannot promote themselves.
exports.bootstrapAdmin = onCall({ region: 'europe-west1' }, async (request) => {
  const { auth } = request;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be logged in.');
  }

  const allowedUid = process.env.BOOTSTRAP_ADMIN_UID;
  if (!allowedUid) {
    throw new HttpsError('failed-precondition', 'BOOTSTRAP_ADMIN_UID is not configured.');
  }

  if (auth.uid !== allowedUid) {
    throw new HttpsError('permission-denied', 'Not allowed to bootstrap admin.');
  }

  const db = admin.firestore();
  const userRef = db.collection('users').doc(auth.uid);

  await userRef.set(
    {
      role: 'admin',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { ok: true, uid: auth.uid };
});
