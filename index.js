const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const { createServer: createHttpsServer } = require('https');
const { createServer: createHttpServer } = require('http');
const url = require('url');
const { readFileSync } = require('fs');
const { logger } = require('./modules/logger');
const healthCheckRoute = require('./routes/healthCheck');
const multer = require('multer');  // For handling file uploads
const Blockchain = require('./modules/blockchain');
const Miner = require('./modules/miner');
const { supabase } = require('./modules/supabase');
const StateService = require('./modules/stateService');
const User = require('./modules/user');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const DEV = true;

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

let server;
if (DEV) {
    server = createHttpServer();
} else {
    server = createHttpsServer({
        key: readFileSync(process.env.SSL_KEY),
        cert: readFileSync(process.env.SSL_CERT),
    });
}
const wss = new WebSocket.Server({ server });
const blockchain = new Blockchain(wss);
const stateService = new StateService(wss);

wss.on('connection', async (socket, req) => {
    const { user_id } = url.parse(req.url, true).query;
    if (!user_id) {
        logger.error('User ID is required');
        socket.close();
        return;
    }
    logger.info('Client connected');

    await blockchain.initialize();
    
    const user = await (new User(user_id)).initialize();

    stateService.addConnection(user, socket);

    socket.onmessage = async (message) => {
        const data = JSON.parse(message.data);

        // Miner Message Handling
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
            const miner = blockchain.getMiner(data.miner_id);
            await minerAction(miner);
        }
    };

    socket.onclose = async () => {
        logger.info('Client disconnected');

        stateService.updateState(user_id, { status: 'offline' });
        stateService.removeConnection(user);
    };

});


server.listen(port, () => {
    logger.info(`Server listening on port ${port}`);
});