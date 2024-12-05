const WebSocket = require('ws');

const { supabase } = require('./supabase');
const { logger } = require('./logger');
const Block = require('./block');

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
        if (!this.isValidBlock(newBlock)) {
            logger.error('Invalid block');
            return false;
        }

        // Insert the new block into the database
        try {
            const { data: transactions, error: fetchError } = await supabase
                .from('transactions')
                .select('*')
                .eq('block_height', newBlock.block_height)
                .eq('status', 'pending');
            
            if (fetchError) {
                logger.error('Error fetching transactions:', fetchError.message);
                return false;
            }

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
            .select('hash')
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
        await this.initialize();
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
                newBlock = new Block(
                    this.getLastBlock().block_height + 1,
                    new Date().getTime(),
                    [],
                    this.getLastBlock().hash,
                    nonce,
                    miner.id
                );
            }
            const targetDifficulty = this.calculateTargetHash(this.difficulty);
            const hashValue = parseInt(newBlock.hash, 16); // Convert hash to integer for comparison
            if (hashValue < targetDifficulty) {
                logger.info(`Block mined by miner ${miner.id}:`, newBlock);
                if (await this.addBlock(newBlock)) {
                    await miner.reward(newBlock);
                    break;
                };
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
                    data: block
                }));
            }
        });
    }
}

module.exports =  Blockchain;