const express = require('express');
const cors = require('cors');
const schedule = require('node-schedule');
const bodyParser = require('body-parser');
const { supabase } = require('./modules/supabase');
require('dotenv').config();

const { logger } = require('./modules/logger');
const { updatePrices } = require('./modules/market');

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

// Schedule price updates every 1 minute
schedule.scheduleJob('*/1 * * * *', updatePrices);

// Mount routes
app.use('/users', require('./routes/users'));
app.use('/auth', require('./routes/auth'));

app.listen(port, () => {
    logger.info(`Server listening on port ${port}`);
});