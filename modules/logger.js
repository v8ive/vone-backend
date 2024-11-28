const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console(),
        // Optionally 1  add a file transport for persistent logs:
        // new winston.transports.File({ filename: 'your_app.log' })
    ]
});

module.exports = {
    logger,
};