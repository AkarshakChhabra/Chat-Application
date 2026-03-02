const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Tell the server to show the files in your current folder
app.use(express.static(__dirname));

// When a user connects to the server
io.on('connection', (socket) => {
    console.log('A user connected!');

    // Listen for a message from one user
    socket.on('chat-message', (msg) => {
        // Send that message to EVERYONE connected
        io.emit('chat-message', msg);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Start the server on port 3000
server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});