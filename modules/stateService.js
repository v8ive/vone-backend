const WebSocket = require('ws');

class StateService {
    constructor(wss) {
        this.wss = wss;
        this.connections = {};
        this.userStates = {};
        this.minerStates = {};
    }

    addConnection(user, socket) {
        const user_id = user.data.user_id;
        this.connections[user_id] = socket;
        this.userStates[user_id] = {
            user_id: user.data.user_id,
            status: user.data.status,
            lastUpdated: new Date().getTime()
        };
        this.broadcastConnection(user);
    }

    removeConnection(user) {
        const user_id = user.data.user_id;
        delete this.connections[user_id];
        this.userStates[user_id] = {
            ...this.userStates[user_id],
            status: 'offline',
            lastUpdated: new Date().getTime()
        };
        this.broadcastDisconnection(user);
    }

    getConnection(user_id) {
        return this.connections[user_id];
    }

    getConnections() {
        return this.connections;
    }

    getState(stateType, user_id) {
        if (stateType === 'miner') {
            return this.minerStates[user_id];
        }
        if (stateType === 'user') {
            return this.userStates[user_id];
        }
    }

    getStates(stateType) {
        if (stateType === 'miner') {
            return this.minerStates;
        }
        if (stateType === 'user') {
            return this.userStates
        }
        return null;
    }

    updateState(stateType, state_id, state) {
        if (stateType === 'miner') {
            this.minerStates[state_id] = {
                ...this.minerStates[state_id],
                ...state,
                lastUpdated: new Date().getTime()
            };
        }
        if (stateType === 'user') {
            this.userStates[user_id] = {
                ...this.userStates[state_id],
                ...state,
                lastUpdated: new Date().getTime()
            };
        }
        this.broadcastStateUpdate(stateType, user_id);
    }

    broadcastConnection(user) {
        const socket = this.getConnection(user.data.user_id);
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN && client !== socket) {
                client.send(JSON.stringify({
                    action: 'user_connected',
                    data: {
                        user_id: user.data.user_id,
                    }
                }));
            }
        });
    }
    
    broadcastDisconnection(user) {
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    action: 'user_disconnected',
                    data: {
                        user_id: user.data.user_id,
                    }
                }));
            }
        });
    }

    broadcastStateUpdate(stateType, user) {
        if (stateType === 'miner') {
            this.wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        action: 'miner_state_update',
                        data: this.minerStates[user.data.user_id]
                    }));
                }
            });
        }
        if (stateType === 'user') {
            this.wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        action: 'user_state_update',
                        data: this.userStates[user.data.user_id]
                    }));
                }
            });
        }
    }

}

module.exports = StateService;