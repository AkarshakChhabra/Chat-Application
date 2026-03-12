const socket = io();

// --- STATE & AUTHENTICATION ---
const savedUsername = localStorage.getItem('chatUsername');
if (!savedUsername) {
    window.location.href = '/login.html'; 
}
const currentUsername = savedUsername;
let currentConversationId = null; 
let typingTimer;
let currentOnlineUsers = []; // Keeps track of who is online

// --- DOM ELEMENTS ---
const chatForm = document.getElementById('message-form');
const chatInput = document.getElementById('user-msg');
const sendBtn = document.getElementById('send-btn');
const chatWindow = document.getElementById('chat-window');
const chatTitle = document.getElementById('chat-title');
const statusDot = document.getElementById('status-dot');
const conversationList = document.getElementById('conversation-list');
const typingIndicator = document.getElementById('typing-indicator');

const newChatBtn = document.getElementById('new-chat-btn');
const newChatModal = document.getElementById('new-chat-modal');
const cancelChatBtn = document.getElementById('cancel-chat-btn');
const startChatBtn = document.getElementById('start-chat-btn');
const newChatUsernameInput = document.getElementById('new-chat-username');

// --- 1. INITIALIZATION ---
// Tell the server we arrived!
socket.emit('user-connected', currentUsername);

// Listen for the live list of users from the server
socket.on('update-online-users', (onlineUsers) => {
    currentOnlineUsers = onlineUsers;
    loadConversations(); // Re-draw the sidebar to show/hide the green dots!
});

loadConversations();

async function loadConversations() {
    try {
        const res = await fetch(`/conversations/${currentUsername}`);
        const convos = await res.json();
        
        conversationList.innerHTML = ''; 
        
        convos.forEach(convo => {
            const otherUser = convo.participants.find(p => p !== currentUsername);
            const displayName = convo.isGroupChat ? convo.chatName : otherUser;

            const div = document.createElement('div');
            div.classList.add('convo-item');
            if (convo._id === currentConversationId) div.classList.add('active'); 
            
            // Check if the other user is in our online list!
            const isOnline = currentOnlineUsers.includes(otherUser);
            const onlineIndicator = isOnline ? '<span class="online-dot" title="Online"></span>' : '';
            
            div.innerHTML = `<div class="convo-name">${displayName} ${onlineIndicator}</div>`;
            div.addEventListener('click', () => selectConversation(convo._id, displayName));
            conversationList.appendChild(div);
        });
    } catch (err) {
        console.error("Error loading conversations", err);
    }
}

// --- 2. SWITCHING CHATS ---
async function selectConversation(convoId, displayName) {
    currentConversationId = convoId;
    chatTitle.textContent = displayName;
    
    // Show/hide the header status dot based on if they are online
    const otherUser = displayName; // For 1-on-1, the display name is the user
    if (currentOnlineUsers.includes(otherUser)) {
        statusDot.classList.remove('hidden');
    } else {
        statusDot.classList.add('hidden');
    }
    
    chatInput.disabled = false;
    sendBtn.disabled = false;
    chatInput.focus();
    
    loadConversations(); 
    socket.emit('join-room', convoId);
    
    try {
        const res = await fetch(`/messages/${convoId}`);
        const messages = await res.json();
        
        chatWindow.innerHTML = ''; 
        messages.forEach(msg => {
            const type = msg.sender === currentUsername ? 'sent' : 'received';
            const senderName = msg.sender === currentUsername ? 'You' : msg.sender;
            appendMessage(msg.text, type, senderName, msg.createdAt);
        });
    } catch (err) {
        console.error("Error loading messages", err);
    }
}

// --- 3. CREATING A NEW CHAT ---
newChatBtn.addEventListener('click', () => newChatModal.classList.remove('hidden'));

cancelChatBtn.addEventListener('click', () => {
    newChatModal.classList.add('hidden');
    newChatUsernameInput.value = '';
});

startChatBtn.addEventListener('click', async () => {
    const receiver = newChatUsernameInput.value.trim();
    if (!receiver || receiver === currentUsername) return alert("Please enter a valid username.");

    try {
        const res = await fetch('/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender: currentUsername, receiver })
        });
        
        if (!res.ok) {
            const errorData = await res.json();
            return alert(errorData.error); 
        }

        const newConvo = await res.json();
        newChatModal.classList.add('hidden');
        newChatUsernameInput.value = '';
        
        await loadConversations();
        selectConversation(newConvo._id, receiver);
    } catch (err) {
        console.error("Error creating chat", err);
    }
});

// --- 4. SOCKET LISTENERS (Real-time Magic) ---
socket.on('chat-message', (msg) => {
    if (msg.conversationId === currentConversationId) {
        const type = msg.username === currentUsername ? 'sent' : 'received';
        const senderName = msg.username === currentUsername ? 'You' : msg.username;
        appendMessage(msg.text, type, senderName, msg.createdAt);
    }
    loadConversations();
});

socket.on('typing', (username) => {
    typingIndicator.textContent = `${username} is typing...`;
    typingIndicator.classList.remove('hidden');
});

socket.on('stop-typing', () => {
    typingIndicator.textContent = "";
    typingIndicator.classList.add('hidden');
});


// --- 5. SENDING MESSAGES & TYPING ---
chatInput.addEventListener('input', () => {
    if (currentConversationId) {
        socket.emit('typing', { conversationId: currentConversationId, username: currentUsername });
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => socket.emit('stop-typing', currentConversationId), 1000);
    }
});

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    
    if (text && currentConversationId) {
        socket.emit('chat-message', {
            conversationId: currentConversationId,
            username: currentUsername,
            text: text
        });
        chatInput.value = '';
        socket.emit('stop-typing', currentConversationId);
        clearTimeout(typingTimer);
    }
});

// --- HELPER FUNCTION: DRAW MESSAGES ---
function appendMessage(text, type, senderName, timestamp) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', type);
    
    const dateObj = timestamp ? new Date(timestamp) : new Date();
    const timeString = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    msgDiv.innerHTML = `
        <div style="font-size: 11px; opacity: 0.7; margin-bottom: 4px; font-weight: bold;">
            ${senderName}
        </div>
        ${text}
        <div class="msg-timestamp">${timeString}</div>
    `;
    
    chatWindow.appendChild(msgDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight; 
}

// --- LOGOUT ---
document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('chatUsername');
    window.location.href = '/login.html';
});