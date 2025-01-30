// sendImageRoute.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
// other dependencies and code

// Define the route
router.post('/send-image', uploadSingle, async (req, res) => {
  try {
    // Route: Send image (with or without caption)
    router.post('/send-image', uploadSingle, async (req, res) => {
    try {
      const { caption, senderId } = req.body;
      const file = req.file;
  
      if (!file) {
        console.error('No image file uploaded.');
        return res.status(400).json({ message: 'No image file uploaded.' });
      }
  
      const filePath = file.path;
      const fileName = file.filename;
  
      // Upload file to MinIO
      await minioClient.fPutObject(
        process.env.MINIO_BUCKET_NAME,
        fileName,
        filePath,
        { 'Content-Type': file.mimetype }
      );
  
      // Generate a signed URL to access the file
      const signedUrl = await minioClient.presignedUrl(
        'GET',
        process.env.MINIO_BUCKET_NAME,
        fileName,
        24 * 60 * 60 // URL expiration time
      );
  
      // Save file metadata to MongoDB
      const fileDetails = new File({
        originalName: file.originalname,
        fileName,
        fileType: file.mimetype,
        size: file.size,
        uploadDate: new Date(),
      });
  
      await fileDetails.save();
  
      // Create or update the Message collection with the image (with or without caption)
      const messageData = {
        imageUrl: signedUrl,
      };
  
      if (caption) {
        messageData.caption = caption;
      }
  
      const updateResult = await Message.updateOne(
        { sender: senderId },
        {
          $push: {
            message: messageData,
          },
        },
        { upsert: true } // Create a new document if none exists
      );
  
      console.log('Update Result:', updateResult);
  
      res.status(200).json({
        message: caption ? 'Image with caption sent successfully.' : 'Image sent successfully.',
        data: {
          caption: caption || '',
          imageUrl: signedUrl,
        },
      });
    } catch (error) {
      console.error('Error sending image:', error.message, error.stack);
      res.status(500).json({ message: 'Error sending image', error: error.message });
    }
  });
  
    res.status(200).json({ message: 'Image sent successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error sending image', error: error.message });
  }
});

module.exports = router;
