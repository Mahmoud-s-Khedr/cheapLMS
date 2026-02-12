const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export triggers
exports.onUserCreate = require('./triggers/onUserCreate').onUserCreate;

// Export API functions
exports.generateToken = require('./api/generateToken').generateToken;
exports.createVideo = require('./api/createVideo').createVideo;
exports.bootstrapAdmin = require('./api/bootstrapAdmin').bootstrapAdmin;
exports.grantAccess = require('./api/grantAccess').grantAccess;
exports.revokeAccess = require('./api/revokeAccess').revokeAccess;

