const { supabase } = require('../modules/supabase');

export class Miner {
    constructor(ws, id, blockchain) {
        this.ws = ws;
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
                logger.error(error);
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
                broadcastStatus('Powered On');
                return True;
            }).catch((error) => {
                logger.error(error);
                return False;
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
                broadcastStatus('Powered Off');
                return True;
            }).catch((error) => {
                logger.error(error);
                return False;
            });
    }

    async mine() {
        await supabase
            .from('miners')
            .update({ status: 'mining' })
            .eq('id', this.id)
            .then((data) => {
                this.status = 'mining';
                broadcastStatus('Started Mining');
                return True;
            }).catch((error) => {
                logger.error(error);
            });
        await this.blockchain.mineBlock(this);
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
}