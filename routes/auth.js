const express = require('express');
const router = express.Router();
const { createServerClient } = require('@supabase/supabase-js');
const { logger } = require('../modules/logger');

router.get("/discord/callback", async function (req, res) {
    logger.info('Discord OAuth callback received:', req.query);
    const code = req.query.code;
    const next = req.query.next ?? "/";

    if (code) {
        logger.info('Exchanging code for session...');
        try {
            const supabase = createServerClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_ANON_KEY, {
                cookies: {
                    getAll() {
                        return parseCookieHeader(context.req.headers.cookie ?? '')
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            context.res.appendHeader('Set-Cookie', serializeCookieHeader(name, value, options))
                        )
                    },
                },
            });
            await supabase.auth.exchangeCodeForSession(code);
            logger.info('User logged in:', user);
            logger.info('Session:', session);

            // Persist the session (e.g., set cookies, store in database)
            // ... (your logic for session handling)

            // Optionally, redirect to the desired page after login
            logger.info('Redirecting to:', next);
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
});

module.exports = router;