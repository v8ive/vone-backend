const express = require('express');
const router = express.Router();

// ... your route definitions ...

router.get('/', (req, res) => {
    console.log('Available Routes:', router.stack);
    res.send('Healthy');
});

module.exports = router;