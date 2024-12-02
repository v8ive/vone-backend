const express = require('express');
const cors = require('cors');
const schedule = require('node-schedule');
const bodyParser = require('body-parser');
const { supabase } = require('./modules/supabase');
require('dotenv').config();

const { logger } = require('./modules/logger');
const { updatePrices } = require('./modules/market');

const multer = require('multer');  // For handling file uploads

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended:
        true
})); // Parse URL-encoded bodies
app.use(bodyParser.raw()); // Parse raw binary data
app.use(multer().single('file'));

// Schedule price updates every 1 minute
schedule.scheduleJob('*/1 * * * *', updatePrices);

// Mount routes
app.use('/users', require('./routes/users'));
// app.use('/auth', require('./routes/auth'));

app.get("/auth/discord/callback", async function (req, res) {
    logger.info('Discord OAuth callback received:', req.query);
    const code = req.query.code;
    const next = req.query.next ?? "/";

    if (code) {
        logger.info('Exchanging code for session...');
        try {
            const { user, session } = await supabase.auth.exchangeCodeForSession(code);
            logger.info('User logged in:', user);
            logger.info('Session:', session);

            // Persist the session (e.g., set cookies, store in database)
            // ... (your logic for session handling)

            // Optionally, redirect to the desired page after login
            res.redirect(303, next);
        } catch (error) {
            logger.error('Error exchanging code for session:', error);
            // Handle error, e.g., redirect to an error page or display an error message
            res.status(500).send('Error logging in with Discord');
        }
    } else {
        logger.warn('No authorization code received');
        // Handle the case where the code is missing
        res.status(400).send('Missing authorization code');
    }

    logger.info('Redirecting to:', next);
});

app.listen(port, () => {
    logger.info(`Server listening on port ${port}`);
});