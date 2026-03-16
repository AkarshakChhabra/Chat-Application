# Chat App with AI Assistant

**Live Demo:** [Click here to try the app!](https://akarshaks-chat-application.onrender.com)

A full-stack, real-time messaging platform built with Node.js, Socket.io, and MongoDB. I built this to get hands-on experience with bidirectional data flow, web sockets, and persistent database architecture. It fully supports private 1-on-1 chats, live typing indicators, and secure user authentication.

The core highlight of this project is the integrated AI assistant. By leveraging the Google Gemini API, I built a server-side interception pipeline. Whenever a user tags `@bot` in a conversation, the backend catches the message, queries the Large Language Model, and instantly broadcasts the generated response back into the chat room for both users to read together.

## Features
* **Real-time messaging:** Powered by Socket.io so messages appear instantly without refreshing.
* **AI Bot:** Tag `@bot` to ask questions or get help directly in the chat.
* **Private Chats:** 1-on-1 messaging with active session tracking.
* **Mobile Friendly:** The CSS flexbox layout automatically adjusts for phone screens.
* **Secure Auth:** Passwords are encrypted before saving to the database.

## Tech Stack
* **Frontend:** HTML, CSS, Vanilla JS
* **Backend:** Node.js, Express, Socket.io
* **Database:** MongoDB Atlas
* **AI:** Google Gemini API

## How to run this locally

1. Clone this repo to your machine.
2. Open your terminal in the project folder and install the dependencies:
   ```bash
   npm install