const { createServerClient } = require('@supabase/supabase-js');

const supabase = createServerClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

module.exports = {
    supabase,
};