const WebSocket = require('ws');

class ConnectionsService {
    constructor(wss) {
        this.wss = wss;
        this.connections = {};
    }

    addConnection(user_id, socket) {
        if (this.connections[user_id]) {
            this.connections[user_id].send(JSON.stringify({
                action: 'error',
                data: {
                    type: 'logged_in_elsewhere',
                    message: 'You have logged in elsewhere'
                }
            })
            )

            this.connections[user_id].close();
        }
        this.connections[user_id] = socket;
    }

    removeConnection(user_id) {
        delete this.connections[user_id];
    }

    getConnection(user_id) {
        return this.connections[user_id];
    }

    getConnections() {
        return this.connections;
    }

}

module.exports = ConnectionsService;