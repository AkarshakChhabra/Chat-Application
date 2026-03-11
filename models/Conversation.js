const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    participants: [{ 
        type: String, 
        required: true 
    }],
    isGroupChat: { 
        type: Boolean, 
        default: false 
    },
    chatName: { 
        type: String, 
        trim: true 
    } 
}, { 
    timestamps: true 
});

module.exports = mongoose.model('Conversation', conversationSchema);