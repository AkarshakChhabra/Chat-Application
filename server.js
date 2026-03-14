require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- MIDDLEWARE ---
app.use(express.static(__dirname));
app.use(express.json()); 

// --- DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('Database connection error:', err));

// --- DATABASE MODELS ---
const User = require('./models/User'); 
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');

// ==========================================
//           API ROUTES
// ==========================================

// --- 1. USER AUTHENTICATION ---
app.post('/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).json({ error: 'Username is already taken.' });

        const newUser = new User({ username, password });
        await newUser.save();
        res.status(201).json({ message: 'Account created successfully!' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ error: 'Invalid username or password.' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid username or password.' });

        res.status(200).json({ message: 'Login successful!', username: user.username });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// --- 2. CONVERSATIONS & MESSAGES ---
app.get('/conversations/:username', async (req, res) => {
    try {
        const convos = await Conversation.find({ participants: req.params.username })
                                         .sort({ updatedAt: -1 }); 
        res.status(200).json(convos);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch conversations.' });
    }
});

app.post('/conversations', async (req, res) => {
    try {
        const { sender, receiver } = req.body;
        
        const receiverExists = await User.findOne({ username: receiver });
        if (!receiverExists) return res.status(404).json({ error: 'User does not exist.' });

        let convo = await Conversation.findOne({
            isGroupChat: false,
            participants: { $all: [sender, receiver] }
        });

        if (!convo) {
            convo = new Conversation({
                participants: [sender, receiver],
                isGroupChat: false
            });
            await convo.save();
        }
        res.status(200).json(convo);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create conversation.' });
    }
});

app.get('/messages/:conversationId', async (req, res) => {
    try {
        const messages = await Message.find({ conversationId: req.params.conversationId })
                                      .sort({ createdAt: 1 }); 
        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch messages.' });
    }
});

// Delete a conversation and all its messages
app.delete('/conversations/:conversationId', async (req, res) => {
    try {
        const convoId = req.params.conversationId;
        await Message.deleteMany({ conversationId: convoId });
        await Conversation.findByIdAndDelete(convoId);
        res.status(200).json({ message: 'Chat permanently deleted.' });
    } catch (error) {
        console.error("Delete error:", error);
        res.status(500).json({ error: 'Failed to delete chat.' });
    }
});


// ==========================================
//        REAL-TIME SOCKET HANDLING
// ==========================================

const connectedUsers = new Map(); 

io.on('connection', (socket) => {
    
    // 1. User connects and joins their personal notification room
    socket.on('user-connected', (username) => {
        socket.join(username); // Connect to a personal room named after them
        
        connectedUsers.set(socket.id, username);
        const onlineUsernames = [...new Set(connectedUsers.values())];
        io.emit('update-online-users', onlineUsernames);
    });

    // 2. User clicks a chat
    socket.on('join-room', (conversationId) => {
        const username = connectedUsers.get(socket.id);
        
        // Leave previous chat rooms, BUT protect their personal username room!
        Array.from(socket.rooms).forEach(room => {
            if (room !== socket.id && room !== username) {
                socket.leave(room);
            }
        });
        
        socket.join(conversationId);
    });

    // 3. User sends a message
    socket.on('chat-message', async (msgData) => {
        try {
            const newMessage = new Message({
                conversationId: msgData.conversationId,
                sender: msgData.username,
                text: msgData.text
            });
            await newMessage.save();

            const convo = await Conversation.findById(msgData.conversationId);

            const payload = {
                _id: newMessage._id,
                conversationId: msgData.conversationId,
                username: msgData.username, 
                text: msgData.text,
                createdAt: newMessage.createdAt
            };

            // Broadcast the message directly to every participant's personal room!
            if (convo && convo.participants) {
                convo.participants.forEach(participant => {
                    io.to(participant).emit('chat-message', payload);
                });
            }
            
            await Conversation.findByIdAndUpdate(msgData.conversationId, { updatedAt: Date.now() });
        } catch (err) {
            console.error("Failed to process message:", err);
        }
    });

    // 4. Typing indicators & Deletions
    socket.on('typing', (data) => socket.to(data.conversationId).emit('typing', data.username));
    socket.on('stop-typing', (conversationId) => socket.to(conversationId).emit('stop-typing'));
    
    socket.on('chat-deleted', (conversationId) => {
        io.to(conversationId).emit('chat-deleted', conversationId);
    });

    // 5. User disconnects
    socket.on('disconnect', () => {
        connectedUsers.delete(socket.id);
        const onlineUsernames = [...new Set(connectedUsers.values())];
        io.emit('update-online-users', onlineUsernames);
    });
});

// --- START SERVER ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});