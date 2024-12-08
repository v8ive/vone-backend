const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const supabase = require('./supabase');
const { logger } = require('./logger');

class User {
    constructor(id, server, socket, stateService) {
        this.id = id !== undefined ? id : uuidv4();
        this.server = server;
        this.socket = socket;
        this.stateService = stateService;

        this.is_guest = id === undefined;
        this.is_mobile = false;
        this.state = {
            // username: 'user123'
            // status: 'offline'
            // last_online: new Date().getTime()
        }
    }

    async initialize() {
        let initialData;

        // If User is not a guest, Fetch user data from database
        if (!this.is_guest) {
            const { data, error } = await supabase
                .from('users')
                .select('username, status, last_online')
                .eq('user_id', this.id)
                .single();
            if (error) {
                logger.error('Failed to fetch user data', error);
                return false;
            }
            if (!data) {
                logger.error('User not found in database');
                return false;
            }
            initialData = data;
        } else {
            initialData = {
                username: 'guest-' + this.id.slice(0, 5),
                status: 'online',
                last_online: new Date().getTime()
            }
        }

        // Initialize user state
        this.state = {
            username: initialData.username,
            status: initialData.status,
            last_online: initialData.last_online,

            is_guest: this.is_guest,
            is_mobile: this.is_mobile
        };

        this.stateService.addUserState(this.id, this.state);

        return this;
    }

    async updateStatus(status) {
        if (status === 'offline' && this.is_guest) {
            return true;
        }

        let statusState;

        // If user is/was online, update status and last_online timestamp
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
        // If user is offline or away, update status only
        } else {
            statusState = { status };
        }

        // Update user status in state
        this.state.status = status;
        if (statusState.last_online) {
            this.state.last_online = statusState.last_online;
        }

        if (!this.is_guest) {
            // Update user status in database
            const { error } = await supabase
                .from('users')
                .update(statusState)
                .eq('user_id', this.id);
            if (error) {
                logger.error('Failed to update user status', error);
                return false;
            }
        } else if (status === 'offline') {
            // Remove guest user from state
        }

        this.broadcastState();
        
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
        // Remove guest user from state
        if (this.is_guest) {
            this.stateService.removeUserState(this.id);
        } else {
            // Update user status to offline
            this.updateStatus('offline');
        }

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

    broadcastState() {
        // Broadcast user state to all clients
        this.server.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    action: 'user_state_update',
                    data: {
                        user_id: this.id,
                        user_state: this.state
                    }
                }));
            }
        });
    }

}

module.exports = User;