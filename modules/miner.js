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

        this.blockchain.stateService.updateState('miner', this.id, {
            active: this.active,
            status: this.status
        });
        this.broadcastPower('on');
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

        this.blockchain.stateService.updateState('miner', this.id, {
            active: this.active,
            mining: this.mining,
            status: this.status
        });
        this.broadcastPower('off');
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

        this.blockchain.stateService.updateState('miner', this.id, {
            mining: this.mining,
            status: this.status
        });
        this.broadcastStatus('Mining Started');
        await this.blockchain.mine(this);
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

        this.blockchain.stateService.updateState('miner', this.id, {
            mining: this.mining,
            status: this.status
        });
        this.broadcastStatus('Mining Stopped');
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
        this.broadcastMineUpdate('block_mined', newBlock);
        this.stop();
        return true
    }

    broadcastPower = async (message) => {
        if ( message === 'on' ) {
            this.blockchain.stateService.getConnection(this.user_id).send(JSON.stringify({
                action: 'miner_power_on',
                data: {
                    miner_id: this.id
                }
            }));
        } else if ( message === 'off' ) {
            this.blockchain.stateService.getConnection(this.user_id).send(JSON.stringify({
                action: 'miner_power_off',
                data: {
                    miner_id: this.id
                }
            }));
        }
    }

    broadcastStatus = async (message) => {
        this.blockchain.stateService.getConnection(this.user_id).send(JSON.stringify({
            action: 'miner_state_update',
            data: {
                miner_id: this.id,
                state: {
                    active: this.active,
                    mining: this.mining,
                    status: this.status,
                    hash_rate: this.hash_rate,
                    currency_code: this.currency_code,
                    balance: this.balance
                },
                message
            }
        }));
    }

    broadcastMineUpdate = async (message, newBlock) => {
        this.blockchain.stateService.getConnection(this.user_id).send(JSON.stringify({
            action: 'miner_mine_update',
            data: {
                miner_id: this.id,
                state: {
                    active: this.active,
                    mining: this.mining,
                    status: this.status,
                    hash_rate: this.hash_rate,
                    currency_code: this.currency_code,
                    balance: this.balance
                },
                block_height: newBlock ? newBlock.height : 0,
                reward: newBlock ? newBlock.reward : 0,
                message
            }
        }));
    }

    
}

module.exports = Miner;