console.log('Starting minimal check');
try {
    const helpers = require('./test/helpers');
    console.log('Helpers loaded:', Object.keys(helpers));

    const admin = require('firebase-admin');
    console.log('Admin mocked:', !!admin.initializeApp);

    const func = require('firebase-functions/v2/https');
    console.log('Functions mocked:', !!func.onCall);

} catch (error) {
    console.error('Error loading modules:', error);
}
console.log('Finished minimal check');
