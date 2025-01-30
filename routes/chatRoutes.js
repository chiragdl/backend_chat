const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const minioClient = require('../config/minio');
const File = require('../models/fileModel');
const Message = require('../models/messageModel');
const authMiddleware = require('./authMiddleware'); // Import auth middleware
const { getUploadedContent } = require('../controllers/chatController'); // Import the new function

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
    if (err) {
      console.error('Error uploading files:', err);
      return res.status(500).json({ message: 'Error processing images' });
    }

    try {
      const files = req.files || [];
      const { caption, senderId, recipientId } = req.body;

      if (!senderId || !recipientId) {
        return res.status(400).json({ message: 'Sender and recipient IDs are required.' });
      }

      const uploadedFiles = [];
      for (const file of files) {
        const filePath = file.path;
        const fileName = file.filename;

        await minioClient.fPutObject(process.env.MINIO_BUCKET_NAME, fileName, filePath, {
          'Content-Type': file.mimetype
        });

        const signedUrl = await minioClient.presignedUrl('GET', process.env.MINIO_BUCKET_NAME, fileName, 24 * 60 * 60);

        uploadedFiles.push({
          fileName,
          minioUrl: signedUrl
        });
      }

      const messageData = {
        sender: senderId,
        recipient: recipientId,
        message: caption || '',
        timestamp: new Date(),
        files: uploadedFiles.map(file => file.fileName)
      };

      const message = new Message(messageData);
      await message.save();

      res.status(200).json({
        message: 'Message sent successfully',
        data: { caption, files: uploadedFiles }
      });
    } catch (error) {
      console.error('Error processing message:', error.message);
      res.status(500).json({ message: 'Error processing message' });
    }
  });
});

// Route to get uploaded content (chat history between sender and recipient)
router.get('/uploaded-content', authMiddleware, async (req, res) => {
  try {
    const { recipientId } = req.query;
    const senderId = req.userId;

    if (!recipientId) {
      return res.status(400).json({ message: 'Recipient ID is required.' });
    }

    const messages = await Message.find({
      $or: [
        { sender: senderId, recipient: recipientId },
        { sender: recipientId, recipient: senderId }
      ]
    }).sort({ timestamp: 1 });

    const detailedMessages = await Promise.all(
      messages.map(async message => {
        const fileDetails = await Promise.all(
          (message.files || []).map(async fileName => {
            const signedUrl = await minioClient.presignedUrl('GET', process.env.MINIO_BUCKET_NAME, fileName, 24 * 60 * 60);
            return { fileName, signedUrl };
          })
        );

        return {
          messageId: message._id,
          sender: message.sender,
          message: message.message,
          timestamp: message.timestamp,
          files: fileDetails
        };
      })
    );

    res.status(200).json({
      message: 'Uploaded content fetched successfully',
      data: detailedMessages
    });
  } catch (error) {
    console.error('Error fetching uploaded content:', error.message);
    res.status(500).json({ message: 'Error fetching uploaded content' });
  }
});
router.get('/history', authMiddleware, async (req, res) => {
  const { senderId, recipientId } = req.query;

  if (!senderId || !recipientId) {
    return res.status(400).json({ message: 'Sender and recipient IDs are required.' });
  }

  try {
    const messages = await Message.find({
      $or: [
        { sender: senderId, recipient: recipientId },
        { sender: recipientId, recipient: senderId },
      ],
    }).sort({ timestamp: 1 });

    // Map through messages and generate signed URLs for files
    const detailedMessages = await Promise.all(
      messages.map(async (message) => {
        const fileDetails = await Promise.all(
          (message.files || []).map(async (fileName) => {
            try {
              const signedUrl = await minioClient.presignedUrl(
                'GET',
                process.env.MINIO_BUCKET_NAME,
                fileName,
                24 * 60 * 60 // URL valid for 24 hours
              );
              return { fileName, signedUrl };
            } catch (err) {
              console.error('Error generating signed URL:', err.message);
              return { fileName, signedUrl: null };
            }
          })
        );

        return {
          _id: message._id,
          sender: message.sender,
          recipient: message.recipient,
          message: message.message,
          timestamp: message.timestamp,
          files: fileDetails,
        };
      })
    );

    res.status(200).json({
      message: 'Chat history fetched successfully',
      data: detailedMessages,
    });
  } catch (error) {
    console.error('Error fetching chat history:', error.message);
    res.status(500).json({ message: 'Error fetching chat history' });
  }
});

module.exports = router;
