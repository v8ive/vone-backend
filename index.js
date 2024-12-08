const express = require('express');
require('dotenv').config();
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const url = require('url');
const cors = require('cors');
const multer = require('multer');
const { readFileSync } = require('fs');
const { createServer: createHttpsServer } = require('https');
const { createServer: createHttpServer } = require('http');

const { logger } = require('./modules/logger');
const healthCheckRoute = require('./routes/healthCheck');
const ConnectionsService = require('./modules/connectionsService');
const User = require('./modules/user');
const StateService = require('./modules/stateService');

const app = express();
const port = process.env.PORT || 3000;
const DEV = process.env.NODE_ENV === 'development';

// Use Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended:
        true
}));
app.use(bodyParser.raw());
app.use(multer().single('file'));

// Mount routes
app.use('/health', healthCheckRoute);

// Start server (HTTP for development or HTTPS for production)
let server;
if (DEV) {
    server = createHttpServer();
} else {
    server = createHttpsServer({
        key: readFileSync(process.env.SSL_KEY),
        cert: readFileSync(process.env.SSL_CERT),
    });
}

// Initialize WebSocket Server
const WebSocketServer = new WebSocket.Server({ server });

// Initialize Connections Service
const connectionsService = new ConnectionsService(WebSocketServer);

// Initialize State Service
const stateService = new StateService(WebSocketServer, connectionsService);

// Handle Client Connection
WebSocketServer.on('connection', async (socket, req) => {
    // Parse user_id from query string & initialize user
    const query = url.parse(req.url, true).query;
    let user_id = query.user_id;

    // Detect if user is connecting from a mobile device
    const userAgent = req.headers['user-agent'];
    const isMobile = /Mobile|Android|iPhone|iPad|iPod/.test(userAgent);

    const user = new User(user_id, WebSocketServer, socket, stateService);

    // Initialize user
    await user.initialize();
    user.is_mobile = isMobile;
    
    // Log connection
    logger.info(`Client ID : ${user.id}`)
    logger.info(`Client connected as ${user.state.username}`);

    // Add connection to connections service
    connectionsService.addConnection(user.id, socket);

    // Add user state to state service
    stateService.addUserState(user.id, user.state);

    // Update user status to online & broadcast connection
    user.onConnect();

    // Handle incoming messages
    socket.onmessage = async (message) => {
        // Update user status to online
        user.updateStatus('online');

        const data = JSON.parse(message.data);

        if (data.action === 'ping') {
            logger.info('ping received');
            // Respond to ping
            socket.send(JSON.stringify({
                action: 'pong'
            }));
        } else {
            logger.info(`Received message: ${data.action}`);
        }
    };

    // Handle client disconnect
    socket.onclose = async () => {
        // Update user status to offline & broadcast disconnection
        user.onDisconnect();
        
        // Remove connection from state service
        connectionsService.removeConnection(user.id);
    };

    socket.addEventListener("error", (event) => {
        logger.error(`WebSocket error: ${event.message}`);
    });

});

server.listen(port, () => {
    logger.info(`Server listening on port ${port}`);
});