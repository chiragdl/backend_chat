const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const minioClient = require('../config/minio');
const File = require('../models/fileModel');
const Message = require('../models/messageModel');
const authMiddleware = require('../routes/authMiddleware'); // Import auth middleware

const router = express.Router();

// Use multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './uploads'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const extension = path.extname(file.originalname);
    cb(null, uniqueSuffix + extension);
  },
});

const upload = multer({ storage }).array('images', 15); // Limit to 15 images

// Protected routes
router.use(authMiddleware); // Protect the routes

// Upload image with caption or send only text
router.post('/upload-message', (req, res) => {
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ message: 'Cannot send more than 15 images at once' });
    } else if (err) {
      console.error('Multer error:', err);
      return res.status(500).json({ message: 'Error processing images', error: err.message });
    }

    try {
      const files = req.files || [];
      const { caption, senderId, recipientId } = req.body;

      // Ensure senderId and recipientId are provided
      if (!senderId || !recipientId) {
        return res.status(400).json({ message: 'Sender and recipient IDs are required.' });
      }

      const uploadedFiles = [];

      // Handle file uploads
      for (const file of files) {
        const filePath = file.path;
        const fileName = file.filename;

        try {
          // Save file metadata to MongoDB
          const fileMetadata = new File({
            originalName: file.originalname,
            fileName,
            fileType: file.mimetype,
            size: file.size,
            uploadDate: new Date(),
          });

          await fileMetadata.save();

          // Upload file to MinIO
          await minioClient.fPutObject(
            process.env.MINIO_BUCKET_NAME,
            fileName,
            filePath,
            { 'Content-Type': file.mimetype }
          );

          // Generate signed URL
          const signedUrl = await minioClient.presignedUrl(
            'GET',
            process.env.MINIO_BUCKET_NAME,
            fileName,
            24 * 60 * 60
          );

          uploadedFiles.push({
            fileName,
            minioUrl: signedUrl,
          });
        } catch (uploadError) {
          console.error('File upload error:', uploadError.message);
          return res.status(500).json({ message: 'Error uploading files', error: uploadError.message });
        }
      }

      // Save the message to MongoDB
      const messageData = {
        sender: senderId,
        recipient: recipientId,
        message: caption || '',
        timestamp: new Date(),
      };

      if (uploadedFiles.length > 0) {
        messageData.files = uploadedFiles.map((file) => file.fileName);
      }

      const message = new Message(messageData);
      await message.save();

      return res.status(200).json({
        message: 'Message sent successfully',
        data: {
          caption: caption || '',
          files: uploadedFiles,
        },
      });
    } catch (error) {
      console.error('Error processing message:', error.message);
      return res.status(500).json({ message: 'Error processing message', error: error.message });
    }
  });
});


const getUploadedContent = async (req, res) => {
  try {
    const messages = await Message.find().sort({ timestamp: -1 }); // Fetch messages in descending order

    const detailedMessages = await Promise.all(
      messages.map(async (message) => {
        const fileDetails = await Promise.all(
          (message.files || []).map(async (fileName) => {
            const signedUrl = await minioClient.presignedUrl(
              'GET',
              process.env.MINIO_BUCKET_NAME,
              fileName,
              24 * 60 * 60
            );
            return { fileName, signedUrl };
          })
        );

        return {
          messageId: message._id,
          sender: message.sender,
          message: message.message,
          timestamp: message.timestamp,
          files: fileDetails,
        };
      })
    );

    res.status(200).json({
      message: 'Uploaded content fetched successfully',
      data: detailedMessages,
    });
  } catch (error) {
    console.error('Error fetching uploaded content:', error.message);
    res.status(500).json({ message: 'Error fetching uploaded content' });
  }
};

// Export the function
module.exports = {
  getUploadedContent,
};
//module.exports = router;