const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const AWS = require('aws-sdk');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configure AWS S3
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: 'us-east-1' // Replace with your region
});

const s3 = new AWS.S3();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// API Endpoint to Upload a File
app.post('/upload/profile-picture', async (req, res) => {
    const fileBuffer = Buffer.from(req.body.file, 'base64'); // Assuming file is sent as base64 encoded string
    const params = {
        Bucket: 'vone-bucket',
        Key: `profile_picture/${Date.now()}-${req.body.filename}`,
        Body: fileBuffer
    };

    try {
        const data = await s3.upload(params).promise();
        res.json({ url: data.Location });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error uploading file' });
    }
});

// ... other API endpoints for downloading, deleting, etc.

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});