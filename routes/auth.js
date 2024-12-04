const express = require('express');
const router = express.Router();
const { supabase } = require('../modules/supabase');
const { logger } = require('../modules/logger');

router.get("/discord/callback", async function (req, res) {
    logger.info('Discord OAuth callback received:', req.url);

    const urlParams = new URLSearchParams(req.url.split('#')[1]);
    const accessToken = urlParams.get('access_token');

    if (accessToken) {
        try {
            // Exchange Discord access token for Supabase session
            const { user, session, error } = await supabase.auth.signInWithOAuth({
                provider: 'discord',
                options: {
                    providerToken: accessToken,
                },
            });

            if (error) {
                logger.error('Error exchanging access token:', error);
                res.status(500).send('Error logging in with Discord');
                return;  // Exit the function if there's an error
            }

            // Successful authentication, handle user session
            logger.info('User authenticated with Supabase:', user);
            // Here you can choose how to handle the session:
            // - Store the session token in a cookie or local storage
            // - Redirect to a protected route or dashboard

            res.redirect(303, 'http://localhost:5173/'); // Replace with your desired redirect URL

        } catch (error) {
            logger.error('Unexpected error during authentication:', error);
            res.status(500).send('Error logging in with Discord');
        }
    } else {
        logger.warn('No access token received');
        res.status(400).send('Missing access token');
    }
});

module.exports = router;