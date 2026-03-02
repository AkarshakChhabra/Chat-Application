const socket = io(); // Connects to the server we just built

const chatForm = document.getElementById('message-form');
const chatInput = document.getElementById('user-msg');
const chatWindow = document.getElementById('chat-window');

// 1. Listen for messages COMING from the server
socket.on('chat-message', function(msgData) {
    const type = msgData.id === socket.id ? 'sent' : 'received';
    appendMessage(msgData.text, type);
});

function appendMessage(text, type) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', type);
    msgDiv.textContent = text;
    chatWindow.appendChild(msgDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// 2. SEND message to the server when user clicks 'Send'
chatForm.addEventListener('submit', function(event) {
    event.preventDefault();
    const text = chatInput.value.trim();
    
    if (text !== "") {
        // Send an object with the text and our unique ID
        socket.emit('chat-message', { text: text, id: socket.id });
        chatInput.value = "";
    }
});