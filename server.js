require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static assets from the current directory
app.use(express.static(__dirname));
// This lets Express read the JSON data sent from our signup form
app.use(express.json());

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

// --- USER AUTHENTICATION ROUTES ---

app.post('/signup', async (req, res) => {
    try {
        const { username, password } = req.body;

        // 1. Check if the user already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'Username is already taken.' });
        }

        // 2. Create the new user (bcrypt will automatically hash the password here!)
        const newUser = new User({ username, password });
        await newUser.save();

        // 3. Send a success message back to the frontend
        res.status(201).json({ message: 'Account created successfully!' });

    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // 1. Check if the user actually exists in the database
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ error: 'Invalid username or password.' });
        }

        // 2. Use the helper function we wrote in User.js to check the password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid username or password.' });
        }

        // 3. If everything matches, send a success message!
        res.status(200).json({ message: 'Login successful!', username: user.username });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

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