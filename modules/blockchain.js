const cryptoJS = require("crypto-js");
const { supabase } = require('../modules/supabase');
const { logger } = require('../modules/logger');
const { hash: cryptoHash } = require("crypto");
const WebSocket = require('ws');
const { Miner } = require('./miner');

class Block {
    constructor(block_height, timestamp, transactions, previousHash, nonce, minerId) {
        this.block_height = block_height;
        this.timestamp = timestamp;
        this.transactions = transactions;
        this.previousHash = previousHash;
        this.nonce = nonce;
        this.hash = this.calculateHash();
        this.minerId = minerId;
        this.reward = this.transactions.length > 0 ? this.calculateReward() : 0;
    }

    calculateHash() {
        const data = JSON.stringify({
            block_height: this.block_height,
            timestamp: this.timestamp,
            transactions: this.transactions,
            previousHash: this.previousHash,
            nonce: this.nonce
        });

        const hash = cryptoHash('sha256', data, 'hex');
        return hash;
    }

    calculateReward() {
        this.reward = this.transactions.forEach((transaction) => {
            return reward + transaction.fee;
        });
    }
}

class Blockchain {
    constructor(wss) {
        this.wss = wss; // WebSocket server
        this.chain = [];
        this.difficulty = 2; // Adjust difficulty as needed

    }

    async initialize() {
        try {
            const { data, error } = await supabase
                .from('blocks')
                .select('*')
                .order('block_height', { ascending: true });

            if (error) {
                logger.error(`Failed to fetch blockchain data: ${error.message}`);
                return;
            }

            this.chain = data;
        } catch (error) {
            logger.error(`Unexpected error fetching blockchain data: ${error}`);
        }
    }

    getLastBlock() {
        if (!this.chain || this.chain.length === 0) {
            return null; // Return null if there's no previous block
        }
        return this.chain[this.chain.length - 1];
    }

    async addBlock(newBlock) {

        // Validate the new block
        if (!this.isValidBlock(newBlock, this.getLastBlock())) {
            logger.error('Invalid block');
            return false;
        }

        // Insert the new block into the database
        try {
            const { error } = await supabase
                .from('blocks')
                .insert([{
                    timestamp: newBlock.timestamp,
                    previousHash: newBlock.previousHash,
                    nonce: newBlock.nonce,
                    transactions: JSON.stringify(newBlock.transactions),
                    difficulty: this.difficulty,
                    block_height: newBlock.index,
                    miner_id: newBlock.minerId,
                }])
                .single();
            if (error) {
                logger.error('Error adding block to database:' + error.message);
                return false;
            }
            this.chain.push(newBlock);
            logger.info('New block added to database:', newBlock);
        } catch (error) {
            logger.error('Error adding block to database, block failed to be added:', error);
            return false;
        }

        // Broadcast the new block
        this.broadcastNewBlock(newBlock);
        return true;
    }

    calculateTargetHash(difficulty) {
        // Adjust this formula based on your desired difficulty level
        const highestHashValue = Math.pow(2, 256) - 1; // Maximum possible hash value
        return highestHashValue / (difficulty + 1);
    }

    isValidBlock(newBlock, previousBlock) {
        if (newBlock.index !== previousBlock.index + 1) {
            return false; // Incorrect index
        }

        if (newBlock.previousHash !== previousBlock.hash) {
            return false; // Incorrect previous hash
        }

        // You can add further checks like:
        // - Valid block data format
        // - Valid timestamp (within acceptable range)

        return true;
    }

    async mineBlock(miner) {
        await this.initialize();
        let mining = true;
        let nonce = 0;
        const targetDifficulty = this.calculateTargetHash(this.difficulty);

        do {
            logger.info(`Miner ${miner.id} mining block with difficulty ${targetDifficulty.toString()}...` + nonce.toString());
            const miningStatus = await supabase
                .from('miners')
                .select('mining')
                .eq('id', miner.id)
                .single();
            if (miningStatus.data.mining === false) {
                logger.info(`Miner ${miner.id} stopped mining`);
                mining = false;
                break;
            }
            const fetchPendingTransactions = async () => {
                const { data, error } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('status', 'pending')
                    .eq('block_id', this.getLastBlock().id)
                    .order('timestamp', { ascending: true });

                if (error) {
                    logger.error('Error fetching pending transactions:' + error.message);
                    return [];
                }

                return data;
            };
            const transactions = await fetchPendingTransactions();
            const newBlock = new Block(
                this.getLastBlock().block_height + 1,
                new Date().getTime(),
                transactions,
                this.getLastBlock().hash,
                nonce,
                miner.id
            );
            const targetDifficulty = this.calculateTargetHash(this.difficulty);
            const hashValue = parseInt(newBlock.hash, 16); // Convert hash to integer for comparison
            logger.info(`Target difficulty: ${targetDifficulty}`);
            logger.info(`Hash value: ${hashValue}`);
            if (hashValue < targetDifficulty) {
                logger.info(`Block mined by miner ${miner.id}:`, newBlock);
                if (await this.addBlock(newBlock)) {
                    await miner.reward(newBlock);
                    break;
                };
            } else {
                logger.info(`Block not mined by miner ${miner.id}:`, newBlock);
            }

            nonce++;
        } while (mining);
    }

    // Broadcast functionality
    broadcastNewBlock(block) {
        logger.info('Broadcasting new Block:', block);
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    action: 'new_block',
                    data: block
                }));
            }
        });
    }
}

module.exports = {
    Block,
    Blockchain,
};