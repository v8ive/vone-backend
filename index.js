const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const WebSocket = require('ws');

const { logger } = require('./modules/logger');

const healthCheckRoute = require('./routes/healthCheck');

const multer = require('multer');  // For handling file uploads
const { initializeMiners, Blockchain } = require('./modules/blockchain');

const app = express();
const port = process.env.PORT || 3000;


const wss = new WebSocket.Server({ server: app });

wss.on('connection', (ws) => {
    logger.info('Client connected');

    const blockchain = new Blockchain(ws);

    ws.on('message', async (message) => {
        if (message === 'add_miner') {
            await blockchain.addMiner();
        }
    });

    ws.onclose = () => {
        logger.info('Client disconnected');
    };

    // Send initial blockchain state to the client
    initializeMiners(blockchain);
    ws.send(JSON.stringify(blockchain));

});


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


app.listen(port, () => {
    logger.info(`Server listening on port ${port}`);
});