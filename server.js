require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const User = require('./models/User'); 
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));
app.use(express.json()); 

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('Database connection error:', err));

// Auth Routes
app.post('/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (await User.findOne({ username })) {
            return res.status(400).json({ error: 'Username is already taken.' });
        }
        await new User({ username, password }).save();
        res.status(201).json({ message: 'Account created successfully!' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        
        if (!user || !(await user.comparePassword(password))) {
            return res.status(400).json({ error: 'Invalid username or password.' });
        }
        res.status(200).json({ message: 'Login successful!', username: user.username });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Chat Data Routes
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
        
        if (!(await User.findOne({ username: receiver }))) {
            return res.status(404).json({ error: 'User does not exist.' });
        }

        let convo = await Conversation.findOne({
            isGroupChat: false,
            participants: { $all: [sender, receiver] }
        });

        if (!convo) {
            convo = new Conversation({ participants: [sender, receiver], isGroupChat: false });
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

app.delete('/conversations/:conversationId', async (req, res) => {
    try {
        const convoId = req.params.conversationId;
        await Message.deleteMany({ conversationId: convoId });
        await Conversation.findByIdAndDelete(convoId);
        res.status(200).json({ message: 'Chat permanently deleted.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete chat.' });
    }
});

// Real-Time Socket Logic
const connectedUsers = new Map(); 

io.on('connection', (socket) => {
    
    socket.on('user-connected', (username) => {
        socket.join(username); // Join personal pub/sub room
        connectedUsers.set(socket.id, username);
        io.emit('update-online-users', [...new Set(connectedUsers.values())]);
    });

    socket.on('join-room', (conversationId) => {
        const username = connectedUsers.get(socket.id);
        Array.from(socket.rooms).forEach(room => {
            if (room !== socket.id && room !== username) socket.leave(room);
        });
        socket.join(conversationId);
    });

    socket.on('chat-message', async (msgData) => {
        try {
            const newMessage = await new Message({
                conversationId: msgData.conversationId,
                sender: msgData.username,
                text: msgData.text
            }).save();

            const convo = await Conversation.findById(msgData.conversationId);
            const payload = {
                _id: newMessage._id,
                conversationId: msgData.conversationId,
                username: msgData.username, 
                text: msgData.text,
                createdAt: newMessage.createdAt
            };

            // Route to specific users
            if (convo?.participants) {
                convo.participants.forEach(user => io.to(user).emit('chat-message', payload));
            }
            
            await Conversation.findByIdAndUpdate(msgData.conversationId, { updatedAt: Date.now() });
        } catch (err) {
            console.error("Message processing error:", err);
        }
    });

    socket.on('typing', (data) => socket.to(data.conversationId).emit('typing', data.username));
    socket.on('stop-typing', (conversationId) => socket.to(conversationId).emit('stop-typing'));
    socket.on('chat-deleted', (conversationId) => io.to(conversationId).emit('chat-deleted', conversationId));

    socket.on('disconnect', () => {
        connectedUsers.delete(socket.id);
        io.emit('update-online-users', [...new Set(connectedUsers.values())]);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));