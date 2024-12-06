const WebSocket = require('ws');

const { supabase } = require('./supabase');
const { logger } = require('./logger');
const Block = require('./block');
const Miner = require('./miner');

class Blockchain {
    constructor(wss, stateService) {
        this.wss = wss;
        this.stateService = stateService
        this.chain = {};
        this.miners = {};
        this.initialized = false;
        this.difficulty = 2;
    }

    async initialize() {
        if (this.initialized) {
            return this;
        }

        // Initialize Blocks
        const { data: blockData, error: blockError } = await supabase
            .from('blocks')
            .select('*')
            .order('block_height', { ascending: true });
        if (blockError) {
            logger.error(`Failed to fetch blockchain data: ${error.message}`);
            return null;
        }
        let previousBlock;
        blockData.forEach(block => {
            this.chain[block.id] = new Block(
                block.id,
                this,
                {
                    timestamp: block.timestamp,
                    hash: block.hash,
                    previous_hash: block.previous_hash,
                    previous_block: previousBlock,
                    nonce: block.nonce,
                    transactions: block.transactions,
                    block_height: block.block_height,
                    miner_id: block.miner_id,
                    reward: block.reward
                }
            );
        });

        // Initialize Miners
        const { data: minerData, error: minerError } = await supabase
            .from('miners')
            .select('*');
        if (minerError) {
            logger.error(`Failed to fetch miner data: ${minerError.message}`);
            return null;
        }
        minerData.forEach(miner => {
            this.miners[miner.id] = new Miner(
                miner.id,
                this,
                {
                    user_id: miner.user_id,
                    hash_rate: miner.hash_rate,
                    active: miner.active,
                    mining: miner.mining,
                    status: miner.status,
                    currency_code: miner.currency_code,
                    balance: miner.balance
                });
        });

        this.initialized = true;
        return this;
    }

    getLastBlock() {
        if (!this.chain || this.chain.length === 0) {
            return null; // Return null if there's no previous block
        }
        return this.chain[this.chain.length - 1];
    }

    getMiner(miner_id) {
        return this.miners[miner_id];
    }

    async addMiner(user_id) {
        const { data: miner, error } = await supabase
            .from('miners')
            .insert([{
                user_id: user_id,
                hash_rate: 0,
                active: false,
                mining: false,
                status: 'offline',
                currency_code: 'Lux',
                balance: 0
            }])
            .single();
        if (error) {
            logger.error('Error adding Miner to database:' + error.message);
            return null;
        }

        this.miners[miner.id] = new Miner(
            miner.id,
            this,
            {
                user_id: miner.user_id,
                hash_rate: miner.hash_rate,
                active: miner.active,
                mining: miner.mining,
                status: miner.status,
                currency_code: miner.currency_code,
                balance: miner.balance
            });

        return this.miners[miner.id];
    }

    async addBlock(newBlock) {
        const { data: transactions, error: fetchError } = await supabase
            .from('transactions')
            .select('*')
            .eq('block_height', newBlock.block_height)
            .eq('status', 'pending');

        if (fetchError) {
            logger.error('Error fetching transactions:', fetchError.message);
            return false;
        }

        const reward = await newBlock.calculateReward();

        const { error } = await supabase
            .from('blocks')
            .insert([{
                timestamp: newBlock.timestamp,
                hash: newBlock.hash,
                previous_hash: newBlock.previous_hash,
                nonce: newBlock.nonce,
                transactions: transactions,
                difficulty: this.difficulty,
                block_height: newBlock.block_height,
                miner_id: newBlock.miner_id,
                reward: newBlock.reward
            }])
            .single();
        if (error) {
            logger.error('Error adding Block to database:' + error.message);
            return false;
        }

        this.chain.push(newBlock);
        logger.info(`Block ${newBlock.block_height} added`);

        // Broadcast the new block
        this.broadcastNewBlock(newBlock);
        return true;
    }

    calculateTargetHash(difficulty) {
        const INCREMENT_FACTOR = 10;
        // Adjust this formula based on your desired difficulty level
        const highestHashValue = Math.pow(2, 256) - 1; // Maximum possible hash value
        return highestHashValue / (difficulty ** INCREMENT_FACTOR + 1);
    }

    async isValidBlock(newBlock) {
        const previousBlock = this.getLastBlock();
        if (!previousBlock) {
            return true; // Genesis block
        }
        if (newBlock.block_height !== previousBlock.block_height + 1) {
            logger.error(`Invalid block height : New Block Height - ${newBlock.block_height} || Previous Block Height - ${previousBlock.index}`);
            return false; // Incorrect Block Height
        }

        if (newBlock.previous_hash !== previousBlock.hash) {
            logger.error(`Invalid previous hash : New Previous Hash - ${newBlock.previous_hash} || Previous Hash - ${previousBlock.hash}`);
            return false; // Incorrect previous hash
        }

        const { data, error } = await supabase
            .from('blocks')
            .select('*')
            .eq('hash', newBlock.hash);
        if (error) {
            logger.error('Error fetching block:', error.message);
            return false;
        }
        if (data.length > 0) {
            logger.error('Block already exists');
            return false; // Block hash already exists
        }

        return true;
    }

    async mineBlock(miner) {
        let mining = true;
        let nonce = 0;

        do {
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

            let newBlock;
            if (!this.getLastBlock()) {
                newBlock = new Block(
                    0,
                    new Date().getTime(),
                    [],
                    '0',
                    nonce,
                    miner.id
                );
            } else {
                const previousBlock = this.getLastBlock();
                newBlock = new Block(
                    previousBlock,
                    new Date().getTime(),
                    [],
                    nonce,
                    miner.id,
                );
            }
            const targetDifficulty = this.calculateTargetHash(this.difficulty);
            const hashValue = parseInt(newBlock.hash, 16);
            if (hashValue < targetDifficulty) {
                logger.info(`Block mined by miner ${miner.id}:`, newBlock);
                if (await this.isValidBlock(newBlock)) {
                    await this.addBlock(newBlock);
                    await miner.reward(newBlock);
                    break;
                }
            } else {
                await miner.broadcastMineFail(`Block did not meet target difficulty: ${hashValue} >= ${targetDifficulty}`);
            }

            nonce++;
        } while (mining);
    }

    // Broadcast functionality
    broadcastNewBlock(block) {
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    action: 'new_block',
                    data: {
                        block_height: block.block_height,
                        miner_id: block.miner_id,
                        reward: block.reward
                    }
                }));
            }
        });
    }
}

module.exports = Blockchain;