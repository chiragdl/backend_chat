const express = require('express');
const mongoose = require('mongoose'); // Add this line
const User = require('../models/userModel'); // Import the User model
const authMiddleware = require('./authMiddleware'); // Import authentication middleware
const minioClient = require('../config/minio'); // Import the MinIO client
const Message = require('../models/messageModel');
const router = express.Router();

// Get all registered users
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Fetch all users, excluding sensitive fields like passwords
    const users = await User.find({}, '-password');

    res.status(200).json({
      message: 'Users fetched successfully',
      data: users,
    });
  } catch (error) {
    console.error('Error fetching users:', error.message);
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
});

// Delete user endpoint
router.delete('/:userId', authMiddleware, async (req, res) => {
  try {
      const { userId } = req.params;

      // Validate userId format
      if (!mongoose.Types.ObjectId.isValid(userId)) {
          return res.status(400).json({
              success: false,
              message: 'Invalid user ID format'
          });
      }

      // Find user to delete
      const userToDelete = await User.findById(userId);

      // Check if user exists
      if (!userToDelete) {
          return res.status(404).json({
              success: false,
              message: 'User not found'
          });
      }

      // Delete user's messages
      await Message.deleteMany({
          $or: [
              { sender: userId },
              { recipient: userId }
          ]
      });

      // Delete the user
      await User.findByIdAndDelete(userId);

      return res.status(200).json({
          success: true,
          message: 'User and associated data deleted successfully'
      });

  } catch (error) {
      console.error('Error in delete user:', error);
      return res.status(500).json({
          success: false,
          message: 'Error deleting user',
          error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
  }
});


module.exports = router;
