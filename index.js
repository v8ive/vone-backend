const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const AWS = require('aws-sdk');
const winston = require('winston'); // Logging library
const multer = require('multer');  // For handling file uploads

require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configure AWS S3
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: 'us-east-2' // Replace with your region
});

const s3 = new AWS.S3();

s3.listBuckets((err, data) => {
    if (err) {
        console.error("Error:", err);
    } else {
        console.log("Buckets:", data.Buckets);
    }
});

// Configure Logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console(),
        // Optionally 1  add a file transport for persistent logs:
        // new winston.transports.File({ filename: 'your_app.log' })
    ]
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended:
        true
})); // Parse URL-encoded bodies
app.use(bodyParser.raw()); // Parse raw binary data
app.use(multer().single('file'));

// API Endpoint to Upload a File
app.post('/upload/profile-picture', async (req, res) => {
    try {

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        if (!req.body.filename) {
            return res.status(400).json({ error: 'No file name uploaded' });
        }

        const fileBuffer = req.file.buffer;
        const params = {
            Bucket: 'vone-bucket',
            Key: `profile_picture/${req.body.filename}`,
            // Key: `profile_picture/${Date.now()}-${req.file.originalname}`,
            Body: fileBuffer,
            ACL: 'public-read' // Make the file public
        };

        const data = await s3.upload(params).promise();
        logger.info('File uploaded successfully', { url: data.Location });
        res.json({ url: data.Location });
    } catch (err) {
        logger.error('Error uploading file:', err);
        res.status(500).json({ error: 'Error uploading file' });
    }
});

// ... other API endpoints for downloading, deleting, etc.

app.listen(port, () => {
    logger.info(`Server listening on port ${port}`);
});