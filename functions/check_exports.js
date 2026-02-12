
try {
    console.log('Checking v2/identity...');
    const identity = require('firebase-functions/v2/identity');
    console.log('identity keys:', Object.keys(identity));
    console.log('onUserCreated type:', typeof identity.onUserCreated);
} catch (e) { console.log('v2/identity error:', e.message); }

try {
    console.log('Checking v1...');
    const v1 = require('firebase-functions/v1');
    console.log('v1 keys:', Object.keys(v1));
    if (v1.auth) console.log('v1.auth keys:', Object.keys(v1.auth));
} catch (e) { console.log('v1 error:', e.message); }
