const socket = io(); 

// --- ELEMENT SELECTORS ---
const chatForm = document.getElementById('message-form');
const chatInput = document.getElementById('user-msg');
const chatWindow = document.getElementById('chat-window');
const typingIndicator = document.getElementById('typing-indicator');

let typingTimer; 
let currentUsername = ""; 

// --- REAL AUTHENTICATION CHECK ---
const savedUsername = localStorage.getItem('chatUsername');

if (!savedUsername) {
    // If they aren't logged in, immediately kick them to the login page
    window.location.href = '/login.html';
} else {
    // If they are logged in, set their name!
    currentUsername = savedUsername;
}

// --- SOCKET EVENT LISTENERS ---
socket.on('chat-message', function(msgData) {
    const isMe = msgData.id === socket.id;
    const type = isMe ? 'sent' : 'received';
    const displayName = isMe ? 'You' : msgData.username;
    
    appendMessage(msgData.text, type, displayName);
});

socket.on('typing', (username) => {
    typingIndicator.textContent = `${username} is typing...`;
    typingIndicator.classList.remove('hidden');
});

socket.on('stop-typing', () => {
    typingIndicator.textContent = "";
    typingIndicator.classList.add('hidden');
});

// --- HELPER FUNCTIONS ---
function appendMessage(text, type, senderName) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', type);
    
    msgDiv.innerHTML = `
        <div style="font-size: 11px; opacity: 0.7; margin-bottom: 4px; font-weight: bold;">
            ${senderName}
        </div>
        ${text}
    `;
    
    chatWindow.appendChild(msgDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// --- USER INPUT EVENT LISTENERS ---
chatInput.addEventListener('input', () => {
    if (currentUsername !== "") {
        socket.emit('typing', currentUsername);
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            socket.emit('stop-typing');
        }, 1000);
    }
});

chatForm.addEventListener('submit', function(event) {
    event.preventDefault(); 
    const text = chatInput.value.trim();
    
    if (text !== "" && currentUsername !== "") {
        socket.emit('chat-message', { 
            text: text, 
            id: socket.id, 
            username: currentUsername 
        });
        
        chatInput.value = "";
        socket.emit('stop-typing');
        clearTimeout(typingTimer);
    }
});

// --- LOGOUT FUNCTIONALITY ---
document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('chatUsername');
    window.location.href = '/login.html';
});