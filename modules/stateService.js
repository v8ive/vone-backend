const WebSocket = require('ws');

class StateService {
    constructor(wss) {
        this.wss = wss;
        this.connections = {};
        this.states = {};
    }

    addConnection(user, socket) {
        const user_id = user.data.user_id;
        this.connections[user_id] = socket;
        this.states[user_id] = {
            user_id: user.data.user_id,
            status: user.data.status,
            lastUpdated: new Date().getTime()
        };
        this.broadcastConnection(user);
    }

    removeConnection(user) {
        const user_id = user.data.user_id;
        delete this.connections[user_id];
        this.states[user_id] = {
            ...this.states[user_id],
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

    getState(user_id) {
        return this.states[user_id];
    }

    getStates() {
        return this.states;
    }

    updateState(user_id, state) {
        const currentState = this.states[user_id];
        this.states[user_id] = {
            ...currentState,
            ...state,
            lastUpdated: new Date().getTime()
        };
        this.broadcastStateUpdate(user);
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

    broadcastStateUpdate(user) {
        const socket = this.getConnection(user.data.user_id);
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN && client !== socket) {
                client.send(JSON.stringify({
                    action: 'user_state_update',
                    data: {
                        user_id: user.data.user_id,
                        state: this.getState(user.data.user_id),
                    }
                }));
            }
        });
    }

}

module.exports = StateService;