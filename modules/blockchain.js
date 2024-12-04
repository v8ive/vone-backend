const cryptoJS = require("crypto-js");
const { supabase } = require('../modules/supabase');
const { logger } = require('../modules/logger');
const { hash: cryptoHash } = require("crypto");
const WebSocket = require('ws');

class Miner {
    constructor(id, miningPower) {
        this.id = id;
        this.miningPower = miningPower;
    }
}

class Block {
    constructor(index, timestamp, data, previousHash, nonce, minerId) {
        this.index = index;
        this.timestamp = timestamp;
        this.data = data;
        this.previousHash = previousHash;
        this.nonce = nonce;
        this.hash = this.calculateHash();
        this.minerId = minerId;
    }

    calculateHash() {
        const data = JSON.stringify({
            index: this.index,
            timestamp: this.timestamp,
            data: this.data,
            previousHash: this.previousHash,
            nonce: this.nonce
        });

        const hash = cryptoHash('sha256', data, 'hex');
        return hash;
    }
}

class Blockchain {
    constructor(ws) {
        this.ws = ws; // WebSocket server
        this.chain = supabase
            .from('blocks')
            .select('*')
            .order('block_height', { ascending: true })
            .then((data) => {
                return data.data;
            }).catch((error) => {
                logger.error(error);
            });
        this.difficulty = 2; // Adjust difficulty as needed

    }

    getLastBlock() {
        if (!this.chain || this.chain.length === 0) {
            return null; // Return null if there's no previous block
        }
        return this.chain[this.chain.length - 1];
    }

    async addBlock(newBlock) {
        if (!this.getLastBlock()) {
            newBlock.previousHash = "0"; // Or any other suitable default value
        } else {
            newBlock.previousHash = this.getLastBlock().hash;
        }

        newBlock.hash = newBlock.calculateHash();

        // Validate the new block
        if (!this.isValidBlock(newBlock, this.getLastBlock())) {
            logger.error('Invalid block:', newBlock);
            return;
        }

        // Insert the new block into the database
        try {
            const { error } = await supabase
                .from('blocks')
                .insert([{
                    timestamp: newBlock.timestamp,
                    previousHash: newBlock.previousHash,
                    nonce: newBlock.nonce,
                    transactions: JSON.stringify(newBlock.data.transactions),
                    difficulty: this.difficulty,
                    block_height: newBlock.index,
                    miner_id: newBlock.minerId,
                }])
                .single();
            if (error) {
                logger.error('Error adding block to database:' + error.message);
                return;
            }
            this.chain.push(newBlock);
            logger.info('New block added to database:', newBlock);
        } catch (error) {
            logger.error('Error adding block to database, block failed to be added:', error);
        }

        // Broadcast the new block
        this.broadcastNewBlock(newBlock);
    }

    async addMiner(userId, currencyCode) {
        const { data: miner, error } = await supabase
            .from('miners')
            .insert([{
                user_id: userId,
                hash_rate: 1, // Default hash rate
                currency_code: currencyCode,
            }])
            .single();

        if (error) {
            logger.error('Error adding miner:', error);
            return;
        }

        this.broadcastNewMiner(miner);
    }

    isValidBlock(newBlock, previousBlock) {
        if (newBlock.index !== previousBlock.index + 1) {
            return false; // Incorrect index
        }

        if (newBlock.previousHash !== previousBlock.hash) {
            return false; // Incorrect previous hash
        }

        if (!newBlock.hash.startsWith('0'.repeat(this.difficulty))) {
            return false; // Does not meet proof-of-work difficulty
        }

        // You can add further checks like:
        // - Valid block data format
        // - Valid timestamp (within acceptable range)

        return true;
    }

    async mineBlock(miner) {
        logger.info(`Mining block for miner ${miner.id}`);
        let nonce = 0;
        const targetDifficulty = this.difficulty * miner.miningPower;

        do {
            const transactions = await fetchPendingTransactions();
            const newBlock = new Block(
                this.getLastBlock().index + 1,
                new Date().getTime(),
                {
                    transactions
                },
                this.getLastBlock().hash,
                nonce,
                miner.id
            );

            if (newBlock.hash.startsWith('0'.repeat(targetDifficulty))) {
                logger.info(`Block mined by miner ${miner.id}:`, newBlock);
                this.addBlock(newBlock);
                return newBlock;
            } else {
                logger.debug(`Block not mined by miner ${miner.id}:`, newBlock);
            }

            nonce++;
        } while (true);
    }

    // Broadcast functionality
    broadcastNewBlock(block) {
        logger.info('Broadcasting new Block:', block);
        this.ws.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    action: 'new_block',
                    data: block
                }));
            }
        });
    }

    broadcastNewMiner(miner) {
        logger.info('Broadcasting new Miner:', miner);
        this.ws.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    action: 'new_miner',
                    data: miner
                }));
            }
        });
    }
}

module.exports = {
    Miner,
    Block,
    Blockchain,
};