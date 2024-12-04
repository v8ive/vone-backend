const { supabase } = require('../modules/supabase');
const { logger } = require('../modules/logger');

class Miner {
    constructor(ws, wss, id, blockchain) {
        this.ws = ws;
        this.wss = wss;
        this.blockchain = blockchain;
        this.id = id;

        this.user_id = null;
        this.hash_rate = null;
        this.isActive = false;
        this.isMining = false;
        this.status = 'unknown';
        this.currency_code = null;

        // this.initialize().then(() => {
        //     logger.info(`Initialized miner ${this.id}`);
        // }).catch((error) => {
        //     logger.error(`Failed to initialize miner ${this.id}: ${error}`);
        // });
        
    }

    async initialize() {
        try {
            const { data, error } = await supabase
                .from('miners')
                .select('*')
                .eq('id', this.id)
                .single();

            if (error) {
                logger.error(`Failed to fetch miner data: ${error.message}`);
                return;
            }

            this.user_id = data.user_id;
            this.hash_rate = data.hash_rate;
            this.isActive = data.isActive;
            this.isMining = data.mining; // Assuming "mining" property exists
            this.status = data.status;
            this.currency_code = data.currency_code;
        } catch (error) {
            logger.error(`Unexpected error fetching miner data: ${error}`);
        }
    }

    broadcastStatus = (message) => {
        logger.info(`Broadcasting status update: ${message}`);
        this.ws.send(JSON.stringify({
            action: 'miner_status_update',
            data: {
                miner: this,
                message
            }
        }));
    }

    async powerOn() {
        await this.initialize();
        await supabase
            .from('miners')
            .update({ isActive: true, status: 'online' })
            .eq('id', this.id)
            .then((data) => {
                this.isActive = true;
                this.status = 'online';
                this.broadcastStatus('Powered On');
                return;
            }).catch((error) => {
                logger.error('Failed to power on miner');
                return;
            });
    }
    
    async powerOff() {
        await this.initialize();
        await supabase
            .from('miners')
            .update({ isActive: false, status: 'offline' })
            .eq('id', this.id)
            .then((data) => {
                this.isActive = false;
                this.status = 'offline';
                this.broadcastStatus('Powered Off');
                return;
            }).catch((error) => {
                logger.error('Failed to power off miner');
                return;
            });
    }

    async mine() {
        await this.initialize();
        await supabase
            .from('miners')
            .update({ status: 'mining' })
            .eq('id', this.id)
            .then((data) => {
                this.status = 'mining';
                this.broadcastStatus('Started Mining');
                return;
            }).catch((error) => {
                logger.error('Failed to start mining');
                return;
            });
        await this.blockchain.mineBlock(this);
    }

    
}

module.exports = Miner;