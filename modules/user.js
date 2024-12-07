const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const supabase = require('./supabase');
const { logger } = require('./logger');

class User {
    constructor(id, server, socket) {
        this.is_guest = false;
        this.id = id !== undefined ? id : uuidv4();
        this.server = server;
        this.socket = socket;

        this.is_mobile = false;
        this.state = {
            // username: 'user123'
            // status: 'offline'
            // last_online: new Date().getTime()
        }
    }

    async initialize() {
        // If user is a guest, initialize guest state
        if (this.is_guest) {
            this.state = {
                username: 'Guest-' + this.id.slice(0, 4),
                status: 'online'
            };
            return this;
        }

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
        // If user is a guest, skip status update
        if (this.is_guest) {
            return true;
        }

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
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    action: 'user_connected',
                    data: {
                        user_id: this.id,
                        user_state: this.state,
                        is_guest: this.is_guest
                    }

                }));
            }
        });
    }

    onDisconnect() {
        // Update user status to offline
        this.updateStatus('offline');

        // Broadcast user disconnection to all clients
        this.server.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    action: 'user_disconnected',
                    data: {
                        user_id: this.id,
                        user_state: this.state,
                        is_guest: this.is_guest
                    }
                }));
            }
        });
    }

}

module.exports = User;