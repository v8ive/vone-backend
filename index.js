const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const WebSocket = require('ws');
const { createServer } = require('http');

const { logger } = require('./modules/logger');

const healthCheckRoute = require('./routes/healthCheck');

const multer = require('multer');  // For handling file uploads
const { Blockchain } = require('./modules/blockchain');
const { Miner } = require('./modules/miner');

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

// Start the WebSocket server
const server = createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    if (!req.url.includes('userId')) {
        logger.error('User ID not found');
        ws.close();
        return;
    }
    const userId = req.url.split('?')[1].split('=')[1];
    ws.userId = userId;

    logger.info('Client connected');

    const blockchain = new Blockchain(wss);

    ws.onmessage = async (message) => {
        data = JSON.parse(message.data);

        if (data.action === 'miner_power_on') {
            logger.info(`Powering on miner : ${data.minerId}`);
            const miner = new Miner(ws, data.minerId, blockchain);
            if (!miner) {
                logger.error('Miner not found');
                return False;
            }
            if (miner.isActive) {
                logger.error('Miner is already powered on');
                return False;
            }
            return await miner.powerOn();
        }
        if (data.action === 'miner_power_off') {
            logger.info(`Powering off miner : ${data.minerId}`);
            const miner = new Miner(ws, data.minerId, blockchain);
            if (!miner) {
                logger.error('Miner not found');
                return False;
            }
            if (!miner.isActive) {
                logger.error('Miner is already powered off');
                return False;
            }
            return await miner.powerOff();
        }
        if (data.action === 'miner_start') {
            logger.info(`Miner Starting : ${data.minerId}`);
            const miner = new Miner(ws, data.minerId, blockchain);
            if (!miner) {
                logger.error('Miner not found');
                return False;
            }
            if (!miner.isActive) {
                logger.error('Miner is not powered on');
                return False;
            }
            if (miner.isMining) {
                logger.error('Miner is already mining');
                return False;
            }
            return await miner.mine();
        }
    };

    ws.onclose = () => {
        logger.info('Client disconnected');
    };

});


server.listen(port, () => {
    logger.info(`Server listening on port ${port}`);
});