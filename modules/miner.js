const { supabase } = require('../modules/supabase');
const { logger } = require('../modules/logger');

class Miner {
    constructor(wss, id, blockchain) {
        this.wss = wss;
        this.blockchain = blockchain;
        this.id = id;
        
        this.user_id, 
        this.hash_rate,
        this.isActive,
        this.isMining,
        this.status,
        this.currency_code = supabase
            .from('miners')
            .select('user_id, hash_rate, isActive, mining, status, currency_code')
            .eq('id', id)
            .then((data) => {
                return data.data[0].user_id, 
                    data.data[0].hash_rate,
                    data.data[0].isActive,
                    data.data[0].mining,
                    data.data[0].status,
                    data.data[0].currency_code;
            }).catch((error) => {
                logger.error('Failed to fetch miner data');
                return;
            });
        
    }

    broadcastStatus = (message) => {
        this.ws.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN && client.userId === this.user_id) {
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