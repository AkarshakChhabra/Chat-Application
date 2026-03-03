require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static assets from the current directory
app.use(express.static(__dirname));

// Initialize MongoDB connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('Database connection error:', err));

// Define message schema and model
const messageSchema = new mongoose.Schema({
    id: String,
    username: String,
    text: String,
    timestamp: { type: Date, default: Date.now } 
});

const Message = mongoose.model('Message', messageSchema);

io.on('connection', async (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Fetch and emit recent message history to the newly connected client
    try {
        const pastMessages = await Message.find().sort({ timestamp: 1 }).limit(50);
        
        pastMessages.forEach((msg) => {
            socket.emit('chat-message', {
                id: msg.id,
                username: msg.username,
                text: msg.text
            });
        });
    } catch (err) {
        console.error("Failed to fetch message history:", err);
    }

    // Handle incoming chat messages
    socket.on('chat-message', async (msg) => {
        // Persist message to database
        try {
            const newMessage = new Message({
                id: msg.id,
                username: msg.username,
                text: msg.text
            });
            await newMessage.save();
        } catch (err) {
            console.error("Failed to persist message:", err);
        }

        // Broadcast to all connected clients
        io.emit('chat-message', msg);
    });

    // Handle typing indicators (broadcast to all except sender)
    socket.on('typing', (username) => {
        socket.broadcast.emit('typing', username);
    });

    socket.on('stop-typing', () => {
        socket.broadcast.emit('stop-typing');
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});