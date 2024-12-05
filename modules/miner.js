const { throttle } = require('lodash');
const { supabase } = require('./supabase');
const { logger } = require('./logger');
const connectionsService = require('./connections');

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
        this.balance = 0;
        
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
            this.balance = data.balance;
        } catch (error) {
            logger.error(`Unexpected error fetching miner data: ${error}`);
        }
    }

    async powerOn() {
        await this.initialize();
        const { data, error } = await supabase
            .from('miners')
            .update({ active: true, status: 'online' })
            .eq('id', this.id);

        if (error) {
            logger.error('Failed to power on miner', error);
            this.broadcastStatus('Failed to Power On');
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
            .update({ active: false, mining: false, status: 'offline' })
            .eq('id', this.id);

        if (error) {
            logger.error('Failed to power off miner', error);
            this.broadcastStatus('Failed to Power Off');
            return false;
        }

        this.active = false;
        this.mining = false
        this.status = 'offline';
        this.broadcastStatus('Powered Off');
        return true
    }

    async start() {
        await this.initialize();
        const { data, error } = await supabase
            .from('miners')
            .update({ mining: true, status: 'mining' })
            .eq('id', this.id);

        if (error) {
            logger.error('Failed to start Mining', error);
            this.broadcastStatus('Failed to Start Mining');
            return false;
        }

        this.status = 'mining';
        this.mining = true;
        this.broadcastStatus('Started Mining');
        const newBlock = await this.blockchain.mineBlock(this);
        if (!newBlock) {
            this.stop();
            this.broadcastStatus('Mined Block');
        }
        return true
    }

    async stop() {
        await this.initialize();
        const { data, error } = await supabase
            .from('miners')
            .update({ mining: false, status: 'online' })
            .eq('id', this.id);

        if (error) {
            logger.error('Failed to stop Mining', error);
            this.broadcastStatus('Failed to Stop Mining');
            return false;
        }

        this.status = 'online';
        this.mining = false;
        this.broadcastStatus('Stopped Mining');
        return true
    }

    async reward(newBlock) {
        await this.initialize();
        const { data, error } = await supabase
            .from('miners')
            .update({ balance: this.balance + newBlock.reward })
            .eq('id', this.id);

        if (error) {
            logger.error('Failed to reward miner', error);
            this.broadcastMineFail('Failed to Reward Miner');
            return false;
        }

        this.balance += newBlock.reward;
        this.broadcastMineSuccess(newBlock);
        return true
    }

    broadcastStatus = async (message) => {
        await this.initialize();
        logger.info(`Miner ${this.id} - Broadcasting status update: ${message}`);
        connectionsService.getConnection(this.user_id).send(JSON.stringify({
            action: 'miner_status_update',
            data: {
                miner: this,
                message
            }
        }));
    }

    broadcastMineSuccess = async (newBlock) => {
        await this.initialize();
        const broadcastThrottle = throttle(() => {
            connectionsService.getConnection(this.user_id).send(JSON.stringify({
                action: 'miner_mine_success',
                data: {
                    miner: this,
                    newBlock
                }
            }));
        }, 5000);
        broadcastThrottle();
    }

    broadcastMineFail = async (message) => {
        await this.initialize();
        const broadcastThrottle = throttle(() => {
            connectionsService.getConnection(this.user_id).send(JSON.stringify({
                action: 'miner_mine_fail',
                data: {
                    miner: this,
                    message
                }
            }));
        }, 5000);
        broadcastThrottle();
    }

    
}

module.exports = Miner;