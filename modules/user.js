const { supabase } = require('./supabase');
const { logger } = require('./logger');

class User {
    constructor(id, blockchain) {
        this.id = id;
        this.blockchain = blockchain;

        this.data = {}
    }

    async initialize() {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('user_id', this.id)
                .single();

            if (error) {
                logger.error(`Failed to fetch user data: ${error.message}`);
                return null;
            }

            this.data = data;

        } catch (error) {
            logger.error(`Unexpected error fetching user data: ${error}`);
            return null;
        }
        
        return this;
    }

    async updateStatus(status) {
        const { error } = await supabase
            .from('users')
            .update({ status })
            .eq('user_id', this.id);

        if (error) {
            logger.error('Failed to update user status', error);
            return false;
        }
        this.blockchain.stateService.updateState(this.id, { status });

        this.data.status = status;
        return true;
    }
}

module.exports = User;