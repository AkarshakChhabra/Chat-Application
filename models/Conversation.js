const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
    participants: [{ 
        type: String, 
        required: true 
    }],
    isGroupChat: { 
        type: Boolean, 
        default: false 
    },
    chatName: { 
        type: String 
    }
}, { timestamps: true });

module.exports = mongoose.model('Conversation', ConversationSchema);