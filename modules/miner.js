const { supabase } = require('../modules/supabase');
const { logger } = require('../modules/logger');
const WebSocket = require('ws');
const { log } = require('console');

class Miner {
    constructor(ws, wss, id, blockchain) {
        this.ws = ws;
        this.wss = wss;
        this.blockchain = blockchain;
        this.id = id;

        this.user_id = null;
        this.hash_rate = null;
        this.active = false;
        this.mining = false;
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
            this.active = data.active;
            this.mining = data.mining; // Assuming "mining" property exists
            this.status = data.status;
            this.currency_code = data.currency_code;
        } catch (error) {
            logger.error(`Unexpected error fetching miner data: ${error}`);
        }
    }

    broadcastStatus = (message) => {
        logger.info(`Miner ${this.id} - Broadcasting status update: ${message}`);
        this.wss.clients.forEach((client) => {
            logger.info(`Checking client: ${client}`);
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    action: 'miner_status_update',
                    data: {
                        miner: this,
                        message
                    }
                }));
            }
        });
    }

    async powerOn() {
        await this.initialize();
        const { data, error } = await supabase
            .from('miners')
            .update({ active: true, status: 'online' })
            .eq('id', this.id);

        if (error) {
            logger.error('Failed to power on miner', error);
            return false;
        }

        this.active = true;
        this.status = 'online';
        this.broadcastStatus('Powered On');
        return true;
    }
    
    async powerOff() {
        await this.initialize();
        const { data, error } = await supabase
            .from('miners')
            .update({ active: false, status: 'offline' })
            .eq('id', this.id);

        if (error) {
            logger.error('Failed to power off miner', error);
            return false;
        }

        this.active = false;
        this.status = 'offline';
        this.broadcastStatus('Powered Off');
        return true
    }

    async start() {
        await this.initialize();
        const { data, error } = await supabase
            .from('miners')
            .update({ status: 'mining' })
            .eq('id', this.id);

        if (error) {
            logger.error('Failed to start Mining', error);
            return false;
        }

        this.status = 'mining';
        this.broadcastStatus('Started Mining');
        await this.blockchain.mineBlock(this);
        return true
    }

    async stop() {
        await this.initialize();
        const { data, error } = await supabase
            .from('miners')
            .update({ status: 'online' })
            .eq('id', this.id);

        if (error) {
            logger.error('Failed to stop Mining', error);
            return false;
        }

        this.status = 'online';
        this.broadcastStatus('Stopped Mining');
        return true
    }

    
}

module.exports = Miner;