const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const WebSocket = require('ws');
const { createServer } = require('http');

const { logger } = require('./modules/logger');

const healthCheckRoute = require('./routes/healthCheck');

const multer = require('multer');  // For handling file uploads
const { initializeMiners, Blockchain } = require('./modules/blockchain');

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

wss.on('connection', (ws) => {
    logger.info('Client connected');

    const blockchain = new Blockchain(wss);

    ws.onmessage = async (message) => {
        messageJson = JSON.parse(message.data);
        if (messageJson.action === 'add_miner') {
            logger.info('Adding miner');
            await blockchain.addMiner(messageJson.userId, messageJson.currencyCode);
        }
    };

    ws.onclose = () => {
        logger.info('Client disconnected');
    };

    // Send initial blockchain state to the client
    initializeMiners(blockchain);
    ws.send(JSON.stringify(blockchain));

});


server.listen(port, () => {
    logger.info(`Server listening on port ${port}`);
});