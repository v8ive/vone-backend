const express = require('express');
const router = express.Router();

// ... your route definitions ...

router.get('/', (req, res) => {
    console.log('Available Routes:', router.stack);
    res.status(200).json({
        status: 'OK',
        message: 'Server is healthy',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;