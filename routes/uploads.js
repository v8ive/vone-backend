

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