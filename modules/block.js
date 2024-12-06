const { hash: cryptoHash } = require("crypto");
const { logger } = require("./logger");

class Block {
    constructor(blockchain, data) {
        this.blockchain = blockchain;
        
        this.previous_block = data.previous_block ? data.previous_block : null;
        this.height = data.previous_block ? data.previous_block.height + 1 : 0;
        this.timestamp = data.timestamp;
        this.transactions = data.transactions;
        this.previous_hash = data.previous_block ? data.previous_block.hash : '0';
        this.nonce = data.nonce;
        this.hash = this.calculateHash();
        this.miner_id = data.miner_id;
        this.reward = data.reward ? data.reward : 0;
    }

    calculateHash() {
        const data = JSON.stringify({
            height: this.height,
            timestamp: this.timestamp,
            transactions: this.transactions,
            previous_hash: this.previous_hash,
            nonce: this.nonce
        });

        const hash = cryptoHash('sha256', data, 'hex');
        return hash;
    }

    async mine(miner) {
        
    }

    calculateReward() {
        if (this.transactions.length === 0) {

            logger.info(`Previous block timestamp: ${this.previous_block.timestamp}`);

            const blockTime = this.timestamp - this.previous_block.timestamp;
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