// modules/connections.js
class Connections {
    constructor() {
        this.connections = {};
        this.users = {};
    }

    addConnection(userId, ws, userData) {
        this.connections[userId] = ws;
        this.users[userId] = { 
            username: userData.username,
            state: {
                status: 'online'
            }
        };
    }

    removeConnection(userId) {
        delete this.connections[userId];
        delete this.users[userId];
    }

    // ... other methods for managing connections and users

    getConnection(userId) {
        return this.connections[userId];
    }

    getUser(userId) {
        return this.users[userId];
    }
}

const connectionsService = new Connections();

module.exports = connectionsService;