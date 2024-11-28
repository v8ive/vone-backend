const express = require('express');
const router = express.Router();
const { db } = require('../modules/database');
const { logger } = require('../modules/logger');

app.post('/', async (req, res) => {
    try {
        const { firebaseUid, username } = req.body;

        // Log user creation attempt
        logger.info('User creation request received:', { firebaseUid, username });

        // Verify Firebase UID (replace with your verification logic)
        // const verified = await verifyFirebaseUid(firebaseUid);
        // if (!verified) {
        //   return res.status(401).json({ error: 'Invalid Firebase UID' });
        // }

        const userRef = db.ref('users/' + firebaseUid);
        await userRef.set({
            username,
            username_color: '#fff',
            createdAt: new Date().toISOString(),
        });
        const bankRef = db.ref('banks/' + firebaseUid);
        await bankRef.set({
            lux: 0,
            nox: 0
        });
        const levellingRef = db.ref('levelling/' + firebaseUid);
        await levellingRef.set({
            xp: 0,
        });

        logger.info(`User created successfully: ${firebaseUid}`); // Log successful creation with UID
        res.json({ message: 'User created successfully' });
    } catch (err) {
        logger.error('Error creating user:', err);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

module.exports = router;