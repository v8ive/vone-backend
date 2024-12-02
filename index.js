const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const { logger } = require('./modules/logger');

const healthCheckRoute = require('./routes/healthCheck');

const multer = require('multer');  // For handling file uploads

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended:
        true
})); // Parse URL-encoded bodies
app.use(bodyParser.raw()); // Parse raw binary data
app.use(multer().single('file'));

// Mount routes
app.use('/auth', usersRoute);
app.use('/health', healthCheckRoute);

app.listen(port, () => {
    logger.info(`Server listening on port ${port}`);
});