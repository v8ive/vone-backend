const router = express.Router();
const { logger } = require('../modules/logger');
const { createServerClient } = require('@supabase/supabase-js')
const { parseCookieHeader, serializeCookieHeader } = require('../modules/cookies')

router.get("/discord/callback", async function (req, res) {
    logger.info('Discord OAuth callback received:', req.query)
    const code = req.query.code
    const next = req.query.next ?? "/"

    if (code) {
        logger.info('Exchanging code for session...')
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
        })
        logger.info('Supabase client created:', supabase)
        await supabase.auth.exchangeCodeForSession(code)
    }
    logger.info('Redirecting to:', next)

    res.redirect(303, `/${next.slice(1)}`)
})