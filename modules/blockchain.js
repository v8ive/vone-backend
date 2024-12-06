const WebSocket = require('ws');
const { throttle } = require('lodash');

const { supabase } = require('./supabase');
const { logger } = require('./logger');
const Block = require('./block');
const Miner = require('./miner');

class Blockchain {
    constructor(wss, stateService) {
        this.wss = wss;
        this.stateService = stateService;
        this.chain = {};
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
            .order('height', { ascending: true });
        if (blockError) {
            logger.error(`Failed to fetch blockchain data: ${blockError.message}`);
            return null;
        }
        let previousBlock;
        blockData.forEach(block => {
            this.chain[block.height] = new Block(
                this,
                {
                    timestamp: block.timestamp,
                    hash: block.hash,
                    previous_hash: block.previous_hash,
                    previous_block: previousBlock,
                    nonce: block.nonce,
                    transactions: block.transactions,
                    height: block.height,
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
            this.stateService.addState('miner', miner.id, {
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
        const blockKeys = Object.keys(this.chain);
        return this.chain[blockKeys[blockKeys.length - 1]];
    }

    getMiner(miner_id) {
        const minerState = this.stateService.getState('miner', miner_id);
        if (!minerState) {
            return null;
        }
        return new Miner(miner_id, this, minerState);
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

        this.stateService.addState('miner', miner.id, {
            user_id: miner.user_id,
            hash_rate: miner.hash_rate,
            active: miner.active,
            mining: miner.mining,
            status: miner.status,
            currency_code: miner.currency_code,
            balance: miner.balance
        });
        
    }

    async addBlock(newBlock) {
        const { data: transactions, error: fetchError } = await supabase
            .from('transactions')
            .select('*')
            .eq('block_height', newBlock.height)
            .eq('status', 'pending');

        if (fetchError) {
            logger.error('Error fetching transactions:' + fetchError.message);
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
                height: newBlock.height,
                miner_id: newBlock.miner_id,
                reward: newBlock.reward
            }])
            .single();
        if (error) {
            logger.error('Error adding Block to database:' + error.message);
            return false;
        }

        this.chain[newBlock.height] = newBlock;
        logger.info(`Block ${newBlock.height} added`);

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
        if (newBlock.height !== previousBlock.height + 1) {
            logger.error(`Invalid block height : New Block Height - ${newBlock.height} || Previous Block Height - ${previousBlock.index}`);
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
            logger.error('Error fetching block:' + error.message);
            return false;
        }
        if (data.length > 0) {
            logger.error('Block already exists');
            return false; // Block hash already exists
        }

        return true;
    }

    async mine(miner) {
        let mining = true
        let nonce = 0;

        do {
            mining = this.stateService.getState('miner', miner.id).mining;

            let newBlock;
            if (!this.getLastBlock()) {
                newBlock = new Block(
                    this,
                    {
                        timestamp: new Date().getTime(),
                        transactions: [],
                        previous_hash: '0',
                        nonce: nonce,
                        height: 0,
                        miner_id: miner.id
                    }
                );
            } else {
                const previousBlock = this.getLastBlock();
                newBlock = new Block(
                    this,
                    {
                        timestamp: new Date().getTime(),
                        transactions: [],
                        previous_hash: previousBlock.hash,
                        nonce: nonce,
                        previous_block: previousBlock,
                        height: previousBlock.height + 1,
                        miner_id: miner.id
                    }
                );
            }
            const targetDifficulty = this.calculateTargetHash(this.difficulty);
            const hashValue = parseInt(newBlock.hash, 16);
            if (hashValue < targetDifficulty) {
                logger.info(`Block mined by miner ${miner.id}`);
                if (await this.isValidBlock(newBlock)) {
                    await this.addBlock(newBlock);
                    await miner.reward(newBlock);
                    break;
                }
            } else {
                logger.info(`Block mining failed by miner ${miner.id}`);
                const failThrottle = throttle(miner.broadcastMineUpdate, 1000);
                await failThrottle(`fail`, null);
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
                        height: block.height,
                        miner_id: block.miner_id,
                        reward: block.reward
                    }
                }));
            }
        });
    }
}

module.exports = Blockchain;