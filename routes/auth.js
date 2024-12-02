const router = express.Router();

router.get("/discord/callback", async function (req, res) {
    console.log('Discord OAuth callback received:', req.query);
    const code = req.query.code;
    const next = req.query.next ?? "/";

    if (code) {
        console.log('Exchanging code for session...');
        try {
            const { user, session } = await supabase.auth.exchangeCodeForSession(code);
            console.log('User logged in:', user);
            console.log('Session:', session);
            // ... (other logic, like setting cookies or redirecting)
        } catch (error) {
            console.log('Error exchanging code for session:', error);
            // Handle error, e.g., redirect to an error page or display an error message
            res.status(500).send('Error logging in with Discord');
        }
    } else {
        console.log('No authorization code received');
        // Handle the case where the code is missing
        res.status(400).send('Missing authorization code');
    }

    console.log('Redirecting to:', next);
    res.redirect(303, next);
});

module.exports = router;