const { hash: cryptoHash } = require("crypto");
const { supabase } = require("./supabase");

class Block {
    constructor(block_height, timestamp, transactions, previous_hash, nonce, miner_id) {
        this.block_height = block_height;
        this.timestamp = timestamp;
        this.transactions = transactions;
        this.previous_hash = previous_hash;
        this.nonce = nonce;
        this.hash = this.calculateHash();
        this.miner_id = miner_id;
        this.reward = this.calculateReward();
    }

    calculateHash() {
        const data = JSON.stringify({
            block_height: this.block_height,
            timestamp: this.timestamp,
            transactions: this.transactions,
            previous_hash: this.previous_hash,
            nonce: this.nonce
        });

        const hash = cryptoHash('sha256', data, 'hex');
        return hash;
    }

    async calculateReward() {
        if (this.transactions.length === 0) {
            const previous_block = await supabase   
                .from('blocks')
                .select('timestamp')
                .eq('hash', this.previous_hash)
                .single();
            const blockTime = this.timestamp - previous_block.timestamp;

            // Adjust these weights based on your desired reward distribution
            const timeWeight = 0.5;
            const difficultyWeight = 0.5;

            const reward = (10 / blockTime) * timeWeight + (10 / this.nonce) * difficultyWeight;

            return reward;
        } else {
            return this.transactions.reduce((total, transaction, index, transactions) => total + transaction.fee, 0);
        }
    }
}

module.exports = Block;