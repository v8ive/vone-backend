const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const WebSocket = require('ws');
const { createServer: createHttpsServer } = require('https');
const { createServer: createHttpServer } = require('http');
const url = require('url');
const { readFileSync } = require('fs');
const { logger } = require('./modules/logger');
const healthCheckRoute = require('./routes/healthCheck');
const multer = require('multer');  // For handling file uploads
const { Blockchain } = require('./modules/blockchain');
const Miner = require('./modules/miner');

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
    // Start the WebSocket server
    server = createHttpServer();
} else {
    server = createHttpsServer({
        key: readFileSync(process.env.SSL_KEY),
        cert: readFileSync(process.env.SSL_CERT),
    });
}
const wss = new WebSocket.Server({ server });


const connections = [];
const users = [];

wss.on('connection', (ws, req) => {

    logger.info('Client connected');
    const { user_id } = url.parse(req.url, true).query;

    const blockchain = new Blockchain(wss);

    ws.onopen = async () => {
        await blockchain.initialize();
        const { data, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('user_id', user_id)
        
        if (fetchError) {
            logger.error(`Failed to fetch user data: ${error.message}`);
            return;
        }
        
        const { error: updateError } = await supabase
            .from('users')
            .update({ status: 'online' })
            .eq('user_id', user_id);
        
        if (updateError) {
            logger.error(`Failed to update user status: ${error.message}`);
            return;
        }

        connections[user_id] = ws;
        users[user_id] = {
            username: data.username,
            state: {
                status: 'online',
            }
        }
        const message = {
            action: 'user_status_update',
            data: {
                user_id,
                user: users[user_id],
                message: 'connected'
            }
        }
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN && client !== ws) {
                client.send(JSON.stringify(message));
            }
        });
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

    ws.onclose = async () => {
        logger.info('Client disconnected');

        const user = users[user_id];
        delete connections[user_id];
        delete users[user_id];

        const { error } = await supabase
            .from('users')
            .update({ status: 'offline' })
            .eq('user_id', user_id);
        
        if (error) {
            logger.error(`Failed to update user status: ${error.message}`);
            return;
        }
        const message = {
            action: 'user_status_update',
            data: {
                user_id,
                user: users[user.user_id],
                message: 'disconnected'
            }
        }
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN && client !== ws) {
                client.send(JSON.stringify(message));
            }
        });
    };

});


server.listen(port, () => {
    logger.info(`Server listening on port ${port}`);
});