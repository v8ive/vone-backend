const AWS = require('aws-sdk');

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

module.exports = {
    s3,
};