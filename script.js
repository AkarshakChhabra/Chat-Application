const socket = io();

// State management
const currentUsername = localStorage.getItem('chatUsername');
if (!currentUsername) window.location.href = '/login.html'; 

let currentConversationId = null; 
let typingTimer;
let onlineUsers = []; 
let unreadCounts = {};       

// DOM Elements
const elements = {
    wrapper: document.querySelector('.chat-wrapper'),
    header: document.querySelector('.app-header'),
    form: document.getElementById('message-form'),
    input: document.getElementById('user-msg'),
    sendBtn: document.getElementById('send-btn'),
    window: document.getElementById('chat-window'),
    title: document.getElementById('chat-title'),
    statusDot: document.getElementById('status-dot'),
    convoList: document.getElementById('conversation-list'),
    typingIndicator: document.getElementById('typing-indicator'),
    logoutBtn: document.getElementById('logout-btn'),
    modals: {
        newChatBtn: document.getElementById('new-chat-btn'),
        modal: document.getElementById('new-chat-modal'),
        cancelBtn: document.getElementById('cancel-chat-btn'),
        startBtn: document.getElementById('start-chat-btn'),
        usernameInput: document.getElementById('new-chat-username')
    }
};

// Mobile UI Setup
const mobileBackBtn = document.createElement('button');
mobileBackBtn.id = 'mobile-back-btn';
mobileBackBtn.innerHTML = '&#8592;'; // Left arrow
elements.header.prepend(mobileBackBtn);

mobileBackBtn.addEventListener('click', () => {
    elements.wrapper.classList.remove('chat-active');
});

// Initialization
socket.emit('user-connected', currentUsername);
loadConversations();

// Socket Listeners
socket.on('update-online-users', (users) => {
    onlineUsers = users;
    loadConversations();
});

socket.on('chat-message', (msg) => {
    if (msg.conversationId === currentConversationId) {
        const type = msg.username === currentUsername ? 'sent' : 'received';
        const senderName = msg.username === currentUsername ? 'You' : msg.username;
        appendMessage(msg.text, type, senderName, msg.createdAt);
    } else {
        unreadCounts[msg.conversationId] = (unreadCounts[msg.conversationId] || 0) + 1;
    }
    loadConversations(); 
});

socket.on('typing', (username) => {
    elements.typingIndicator.textContent = `${username} is typing...`;
    elements.typingIndicator.classList.remove('hidden');
});

socket.on('stop-typing', () => {
    elements.typingIndicator.classList.add('hidden');
});

socket.on('chat-deleted', (convoId) => {
    if (currentConversationId === convoId) resetChatView('The other user deleted this chat.');
    delete unreadCounts[convoId];
    loadConversations(); 
});

// Core Functions
async function loadConversations() {
    try {
        const res = await fetch(`/conversations/${currentUsername}`);
        const convos = await res.json();
        
        elements.convoList.innerHTML = ''; 
        
        convos.forEach(convo => {
            const otherUser = convo.participants.find(p => p !== currentUsername);
            const displayName = convo.isGroupChat ? convo.chatName : otherUser;
            const isOnline = onlineUsers.includes(otherUser);
            const unread = unreadCounts[convo._id];

            const div = document.createElement('div');
            div.classList.add('convo-item');
            if (convo._id === currentConversationId) div.classList.add('active'); 
            
            div.innerHTML = `
                <div class="convo-name">
                    ${displayName} 
                    ${isOnline ? '<span class="online-dot" title="Online"></span>' : ''} 
                    ${unread ? `<span class="unread-badge">${unread}</span>` : ''}
                </div>
                <button class="delete-chat-btn" title="Delete Chat">&#128465;</button>
            `;
            
            // Delete handler
            div.querySelector('.delete-chat-btn').addEventListener('click', async (e) => {
                e.stopPropagation(); 
                if (confirm(`Permanently delete chat with ${displayName}?`)) {
                    await fetch(`/conversations/${convo._id}`, { method: 'DELETE' });
                    socket.emit('chat-deleted', convo._id);
                    if (currentConversationId === convo._id) resetChatView('Chat deleted. Select a new chat.');
                    loadConversations();
                }
            });

            div.addEventListener('click', () => selectConversation(convo._id, displayName, otherUser));
            elements.convoList.appendChild(div);
        });
    } catch (err) {
        console.error("Error loading conversations", err);
    }
}

async function selectConversation(convoId, displayName, otherUser) {
    currentConversationId = convoId;
    delete unreadCounts[convoId]; 
    
    elements.wrapper.classList.add('chat-active'); // Trigger mobile view
    elements.title.textContent = displayName;
    elements.statusDot.classList.toggle('hidden', !onlineUsers.includes(otherUser));
    
    elements.input.disabled = false;
    elements.sendBtn.disabled = false;
    elements.input.focus();
    
    loadConversations(); 
    socket.emit('join-room', convoId);
    
    try {
        const res = await fetch(`/messages/${convoId}`);
        const messages = await res.json();
        
        elements.window.innerHTML = ''; 
        messages.forEach(msg => {
            const type = msg.sender === currentUsername ? 'sent' : 'received';
            const senderName = msg.sender === currentUsername ? 'You' : msg.sender;
            appendMessage(msg.text, type, senderName, msg.createdAt);
        });
    } catch (err) {
        console.error("Error loading messages", err);
    }
}

function appendMessage(text, type, senderName, timestamp) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', type);
    
    const timeString = new Date(timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    msgDiv.innerHTML = `
        <div style="font-size: 11px; opacity: 0.7; margin-bottom: 4px; font-weight: bold;">${senderName}</div>
        ${text}
        <div class="msg-timestamp">${timeString}</div>
    `;
    
    elements.window.appendChild(msgDiv);
    elements.window.scrollTop = elements.window.scrollHeight; 
}

function resetChatView(message) {
    currentConversationId = null;
    elements.title.textContent = "Select a chat to start";
    elements.statusDot.classList.add('hidden');
    elements.window.innerHTML = `<div class="message received" style="margin: auto; text-align: center; background: none; box-shadow: none;">${message}</div>`;
    elements.input.disabled = true;
    elements.sendBtn.disabled = true;
    elements.wrapper.classList.remove('chat-active');
}

// Event Listeners
elements.input.addEventListener('input', () => {
    if (currentConversationId) {
        socket.emit('typing', { conversationId: currentConversationId, username: currentUsername });
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => socket.emit('stop-typing', currentConversationId), 1000);
    }
});

elements.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = elements.input.value.trim();
    if (text && currentConversationId) {
        socket.emit('chat-message', { conversationId: currentConversationId, username: currentUsername, text });
        elements.input.value = '';
        socket.emit('stop-typing', currentConversationId);
        clearTimeout(typingTimer);
    }
});

// Modals & Auth
elements.modals.newChatBtn.addEventListener('click', () => elements.modals.modal.classList.remove('hidden'));
elements.modals.cancelBtn.addEventListener('click', () => {
    elements.modals.modal.classList.add('hidden');
    elements.modals.usernameInput.value = '';
});

elements.modals.startBtn.addEventListener('click', async () => {
    const receiver = elements.modals.usernameInput.value.trim();
    if (!receiver || receiver === currentUsername) return alert("Invalid username.");

    try {
        const res = await fetch('/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender: currentUsername, receiver })
        });
        
        if (!res.ok) return alert((await res.json()).error); 

        const newConvo = await res.json();
        elements.modals.modal.classList.add('hidden');
        elements.modals.usernameInput.value = '';
        
        await loadConversations();
        selectConversation(newConvo._id, receiver, receiver);
    } catch (err) {
        console.error("Error creating chat", err);
    }
});

elements.logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('chatUsername');
    window.location.href = '/login.html';
});