const socket = io(); 

// Element Selectors
const chatForm = document.getElementById('message-form');
const chatInput = document.getElementById('user-msg');
const chatWindow = document.getElementById('chat-window');

// New Login Elements
const loginScreen = document.getElementById('login-screen');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');

let currentUsername = ""; // Variable to store the username

// 1. Handle Login
joinBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    if (name !== "") {
        currentUsername = name;
        loginScreen.classList.add('hidden'); // Hide the login screen
    }
});

// 2. Listen for incoming messages
socket.on('chat-message', function(msgData) {
    const isMe = msgData.id === socket.id;
    const type = isMe ? 'sent' : 'received';
    const displayName = isMe ? 'You' : msgData.username;
    
    appendMessage(msgData.text, type, displayName);
});

// 3. Append messages to the DOM (Updated to show names)
function appendMessage(text, type, senderName) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', type);
    
    // Add a tiny span for the username above the message text
    msgDiv.innerHTML = `
        <div style="font-size: 11px; opacity: 0.7; margin-bottom: 4px; font-weight: bold;">
            ${senderName}
        </div>
        ${text}
    `;
    
    chatWindow.appendChild(msgDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// 4. Send message to the server
chatForm.addEventListener('submit', function(event) {
    event.preventDefault();
    const text = chatInput.value.trim();
    
    if (text !== "" && currentUsername !== "") {
        // Now we send the username along with the text
        socket.emit('chat-message', { 
            text: text, 
            id: socket.id, 
            username: currentUsername 
        });
        chatInput.value = "";
    }
});