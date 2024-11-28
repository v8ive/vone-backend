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

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const filename
            = req.body.filename || file.originalname;
        const extension = path.extname(filename);
        const finalFilename = `${filename}${extension}`;
        cb(null, finalFilename);
    }
});

const upload = multer({ storage: storage });

app.post('/upload/profile-picture', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No file uploaded' });
    }

    const fileBuffer = req.file.buffer;

            const params = {
                Bucket: 'vone-bucket',
                Key: `profile_picture/${req.file.filename}`,
                Body: fileBuffer,
                ACL: 'public-read'
            };

            const data = await s3.upload(params).promise();
            res.json({ url: data.Location });
        } catch (err) {
            console.error('Error uploading file:', err);
            res.status(500).json({ error: 'Error uploading file' });
        }
    });

// ... other API endpoints for downloading, deleting, etc.

app.listen(port, () => {
    logger.info(`Server listening on port ${port}`);
});