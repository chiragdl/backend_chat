// server.js
const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const connectDB = require('./config/db');  // Path to db.js
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const userRoutes = require('./routes/userRoutes'); // Import user routes
const deleteUserRoute = require('./routes/userRoutes'); // Import delete user route
const socketIo = require('socket.io');
const cors = require('cors');  // To handle CORS for frontend communication

dotenv.config();  // Load environment variables from .env file

const app = express();

// Connect to the MongoDB database
connectDB();

// Middleware
app.use(bodyParser.json());  // Parse JSON request bodies
app.use(cors());  // Enable CORS for all routes (adjust this as needed)

// Routes
app.use('/api/auth', authRoutes);  // Authentication routes
app.use('/api/chat', chatRoutes);  // Chat routes
app.use('/uploads', express.static('uploads'));  // Serve the uploaded images
app.use('/api/users', userRoutes);  // User routes
app.use('/api/users', deleteUserRoute);

// Start the server
const server = app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on http://localhost:${process.env.PORT || 5000}`);
});

// Set up Socket.IO for real-time communication
const io = socketIo(server);

// Store connected users (for chat application purposes)
let users = [];

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Listen for new messages from clients
  socket.on('sendMessage', (messageData) => {
    console.log('New message:', messageData);
    // Emit the message to all connected clients
    io.emit('receiveMessage', messageData);
  });

  // Listen for user disconnect
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});
