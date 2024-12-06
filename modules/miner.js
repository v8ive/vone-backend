const { supabase } = require('./supabase');
const { logger } = require('./logger');

class Miner {
    constructor(id, blockchain, data) {
        this.id = id;
        this.blockchain = blockchain;

        this.user_id = data.user_id;
        this.hash_rate = data.hash_rate;
        this.active = data.active;
        this.mining = data.mining;
        this.status = data.status;
        this.currency_code = data.currency_code;
        this.balance = data.balance;
        
    }

    async powerOn() {
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
        await this.blockchain.mineBlock(this);
        return true
    }

    async stop() {
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
        this.balance += newBlock.reward;
        const { data, error } = await supabase
            .from('miners')
            .update({ balance: this.balance })
            .eq('id', this.id);

        if (error) {
            logger.error('Failed to reward miner', error);
            this.broadcastMineFail('Failed to Reward Miner');
            return false;
        }

        this.balance += newBlock.reward;
        this.broadcastMineSuccess(newBlock);
        this.stop();
        return true
    }

    broadcastStatus = async (message) => {
        logger.info(`Miner ${this.id} - Broadcasting status update: ${message}`);
        this.blockchain.stateService.getConnection(this.user_id).send(JSON.stringify({
            action: 'miner_status_update',
            data: {
                miner: this,
                message
            }
        }));
    }

    broadcastMineSuccess = async (newBlock) => {
        this.blockchain.stateService.getConnection(this.user_id).send(JSON.stringify({
            action: 'miner_mine_update',
            data: {
                miner: this,
                status: 'success',
                newBlock
            }
        }));
    }

    broadcastMineFail = async (message) => {
        this.blockchain.stateService.getConnection(this.user_id).send(JSON.stringify({
            action: 'miner_mine_update',
            data: {
                miner: this,
                status: 'fail',
                message
            }
        }));
    }

    
}

module.exports = Miner;