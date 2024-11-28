// database.js
const admin = require('firebase-admin');

const serviceAccount = require('../firebase/serviceAccountKey.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://vone-d9e7d-default-rtdb.firebaseio.com"
});
const db = admin.database();

module.exports = {
    db,
};

// In other files:
// const databaseModule = require('./database');
// const db = databaseModule.db;