const { hash: cryptoHash } = require("crypto");
const { supabase } = require("./supabase");
const { logger } = require("./logger");

class Block {
    constructor(block_height, timestamp, transactions, previous_hash, nonce, miner_id) {
        this.block_height = block_height;
        this.timestamp = timestamp;
        this.transactions = transactions;
        this.previous_hash = previous_hash;
        this.nonce = nonce;
        this.hash = this.calculateHash();
        this.miner_id = miner_id;
        this.reward = 0;
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
            const previousBlock = await supabase
                .from('blocks')
                .select('timestamp')
                .eq('hash', this.previous_hash)
                .single();

            logger.info(`Previous block timestamp: ${previousBlock.timestamp}`);

            const blockTime = this.timestamp - previousBlock.timestamp;
            logger.info(`Block time: ${blockTime}`);

            // Adjust these weights and constants based on your desired reward distribution
            const baseReward = 10; // Base reward for faster blocks
            const timePenaltyFactor = 0.1; // Penalty for slower blocks

            const reward = baseReward - (blockTime * timePenaltyFactor);

            // Ensure reward doesn't become negative
            this.reward = Math.max(reward, 0);
            logger.info(`Block reward calculated: ${this.reward}`);

            return this.reward;
        } else {
            return this.transactions.reduce((total, transaction, index, transactions) => total + transaction.fee, 0);
        }
    }
}

module.exports = Block;