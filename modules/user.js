const WebSocket = require('ws');

const supabase = require('./supabase');
const { logger } = require('./logger');

class User {
    constructor(id, server, socket) {
        this.id = id;
        this.server = server;
        this.socket = socket;

        this.state = {
            // username: 'user123'
            // status: 'offline'
            // last_online: new Date().getTime()
        }
    }

    async initialize() {
        // Fetch user data from database
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('user_id', this.id)
            .single();
        if (error) {
            logger.error(`Failed to fetch user data: ${error.message}`);
            return null;
        }

        // Initialize user state
        this.state = {
            username: data.username,
            status: data.status,
            last_online: data.last_online
        };

        return this;
    }

    async updateStatus(status) {
        let statusState;

        // If user is/was online, update last_online timestamp
        if (status === 'online') {
            statusState = {
                status,
                last_online: new Date().getTime()
            };
        } else if ((status === 'offline' || status === 'away') && this.state.status === 'online') {
            statusState = {
                status,
                last_online: new Date().getTime()
            };
        // If user is offline or away, update status
        } else {
            statusState = { status };
        }

        // Update user status in database
        const { error } = await supabase
            .from('users')
            .update(statusState)
            .eq('user_id', this.id);
        if (error) {
            logger.error('Failed to update user status', error);
            return false;
        }

        // Update user status in state
        this.state.status = status;
        return true;
    }

    onConnect() {
        // Update user status to online
        this.updateStatus('online');

        // Broadcast user connection to all clients
        this.server.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN && client !== this.socket) {
                client.send(JSON.stringify({
                    action: 'user_connected',
                    user_id: this.id,
                    user_state: this.state
                }));
            }
        });
    }

    onDisconnect() {
        // Update user status to offline
        this.updateStatus('offline');

        // Broadcast user disconnection to all clients
        this.server.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN && client !== this.socket) {
                client.send(JSON.stringify({
                    action: 'user_disconnected',
                    user_id: this.id,
                    user_state: this.state
                }));
            }
        });
    }

}

module.exports = User;