const { logger } = require("./logger");


class StateService {
    constructor(server, connectionsService) {
        this.server = server;
        this.connectionsService = connectionsService;

        this.userStates = {};
    }

    addUserState(user_id, state) {
        this.userStates[user_id] = state;
    }

    removeUserState(user_id) {
        delete this.userStates[user_id];
    }

    getUserState(user_id) {
        return this.userStates[user_id];
    }

    getUserStates() {
        return this.userStates;
    }

    updateUserState(user_id, state) {
        this.userStates[user_id] = state;
        this.broadcastUserState(user_id);
    }

    // Send user states to a specific client/user
    sendUserStates(user_id) {
        const socket = this.connectionsService.getConnection(user_id);
        const userStates = this.getUserStates();

        logger.info(`${userStates.forEach(user => logger.info(user))}`);

        socket.send(JSON.stringify({
            action: 'user_states',
            data: userStates
        }));
    }

    // Broadcast user state to all clients/users
    broadcastUserState(user_id) {
        const userState = this.getUserState(user_id);
        const userConnection = this.connectionsService.getConnection(user_id);

        this.connectionsService.getConnections().forEach(socket => {
            if (socket.readyState === WebSocket.OPEN && socket !== userConnection) {
                socket.send(JSON.stringify({
                    action: 'user_state_update',
                    data: {
                        user_id,
                        user_state: userState
                    }
                }));
            }
        });
        
    }

}

module.exports = StateService;

