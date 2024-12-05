const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const WebSocket = require('ws');
const { createServer } = require('https');
const url = require('url');

const { logger } = require('./modules/logger');

const healthCheckRoute = require('./routes/healthCheck');

const multer = require('multer');  // For handling file uploads
const { Blockchain } = require('./modules/blockchain');
const Miner = require('./modules/miner');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended:
        true
})); // Parse URL-encoded bodies
app.use(bodyParser.raw()); // Parse raw binary data
app.use(multer().single('file'));

// Mount routes
app.use('/auth', require('./routes/auth'));
app.use('/health', healthCheckRoute);

const options = {
    key: process.env.SSL_KEY,
    cert: process.env.SSL_CERT
};

// Start the WebSocket server
const server = createServer(app, options);
const wss = new WebSocket.Server({ server });

const connections = [];
const users = [];

wss.on('connection', (ws, req) => {

    logger.info('Client connected');
    const { user_id } = url.parse(req.url, true).query;

    const blockchain = new Blockchain(wss);

    ws.onopen = async () => {
        await blockchain.initialize();
    };

    ws.onmessage = async (message) => {
        data = JSON.parse(message.data);
        const minerActions = {
            'miner_power_on': async (miner) => {
                logger.info(`Powering on miner : ${data.miner_id}`);

                if (!miner) {
                    logger.error('Miner not found');
                    miner.broadcastStatus('Miner not found');
                    return false;
                }
                if (miner.active) {
                    logger.error('Miner is already powered on');
                    miner.broadcastStatus('Miner is already powered on');
                    return false;
                }
                return await miner.powerOn();
            },
            'miner_power_off': async (miner) => {
                logger.info(`Powering off miner : ${data.miner_id}`);
                await miner.initialize();
                if (!miner) {
                    logger.error('Miner not found');
                    miner.broadcastStatus('Miner not found');
                    return false;
                }
                if (!miner.active) {
                    logger.error('Miner is already powered off');
                    miner.broadcastStatus('Miner is already powered off');
                    return false;
                }
                return await miner.powerOff();
            },
            'miner_start': async (miner) => {
                logger.info(`Miner Starting : ${data.miner_id}`);
                if (!miner) {
                    logger.error('Miner not found');
                    miner.broadcastStatus('Miner not found');
                    return false;
                }
                if (!miner.active) {
                    logger.error('Miner is not powered on');
                    miner.broadcastStatus('Miner is not powered on');
                    return false;
                }
                if (miner.mining) {
                    logger.error('Miner is already mining');
                    miner.broadcastStatus('Miner is already mining')
                    return false;
                }
                return await miner.start();
            },
            'miner_stop': async (miner) => {
                logger.info(`Miner Stopping : ${data.miner_id}`);
                if (!miner) {
                    logger.error('Miner not found');
                    miner.broadcastStatus('Miner not found');
                    return false;
                }
                if (!miner.mining) {
                    logger.error('Miner is not mining');
                    miner.broadcastStatus('Miner is not mining');
                    return false;
                }
                return await miner.stop();
            },
        }
        const minerAction = minerActions[data.action];
        if (minerAction) {
            const miner = new Miner(ws, wss, data.miner_id, blockchain);
            await miner.initialize();
            await minerAction(miner);

        }
    };

    ws.onclose = () => {
        logger.info('Client disconnected');
    };

});


server.listen(port, () => {
    logger.info(`Server listening on port ${port}`);
});