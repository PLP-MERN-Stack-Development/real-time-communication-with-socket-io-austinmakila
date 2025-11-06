# Real-Time Chat Application with Socket.io

This assignment focuses on building a real-time chat application using Socket.io, implementing bidirectional communication between clients and server.

## Assignment Overview

You will build a chat application with the following features:
1. Real-time messaging using Socket.io
2. User authentication and presence
3. Multiple chat rooms or private messaging
4. Real-time notifications
5. Advanced features like typing indicators and read receipts

## Project Structure

```
socketio-chat/
├── client/                 # React front-end
│   ├── public/             # Static files
│   ├── src/                # React source code
│   │   ├── components/     # UI components
│   │   ├── context/        # React context providers
│   │   ├── hooks/          # Custom React hooks
│   │   ├── pages/          # Page components
│   │   ├── socket/         # Socket.io client setup
│   │   └── App.jsx         # Main application component
│   └── package.json        # Client dependencies
├── server/                 # Node.js back-end
│   ├── config/             # Configuration files
│   ├── controllers/        # Socket event handlers
│   ├── models/             # Data models
│   ├── socket/             # Socket.io server setup
│   ├── utils/              # Utility functions
│   ├── server.js           # Main server file
│   └── package.json        # Server dependencies
└── README.md               # Project documentation
```

## Getting Started
Repo: https://github.com/PLP-MERN-Stack-Development/real-time-communication-with-socket-io-austinmakila.git


## Initializing node env in server side..
mkdir server && cd server
npm init -y
npm i express socket.io cors multer mongoose jsonwebtoken bcrypt dotenv
# dev: nodemon
npm i -D nodemon

# Summary of changes

## Server

server/server.js — replaced/updated to a production-friendly Socket.IO + Express setup with:

## JWT-friendly handshake (simple username support),

presence tracking with MongoDB User model,

Message model and persistent message saves (MongoDB + Mongoose),

## file upload endpoint (/upload) using multer,

events: sendMessage, privateMessage, typing, reaction, markRead, joinRoom, leaveRoom,

message pagination REST endpoint: GET /messages?room=...&page=...&limit=....

## server Models

server/models/Message.js — schema for messages (reactions + readBy).

server/models/User.js — schema for users with online, socketId, lastSeen.

## Client

client/src/hooks/useSocket.js — reusable hook handling connection, reconnection, event listeners, typing states and helper functions for emitting events.

client/src/App.jsx — updated UI wiring to use useSocket with simple login flow, message list, typing indicator, file upload, basic read receipts/reactions.




# Client side ...

## Using Vite
npm create vite@latest chat-client -- --template react
cd chat-client
npm install socket.io-client axios



## Important features explained & how they map to code

Live messaging to everyone: io.emit() from server or nsp.to(room).emit('message', ...) sends to a room.

Broadcast except sender: socket.broadcast.emit() or socket.to(room).emit(...).

Typing indicator: client emits typing and server forwards to everyone else in room (socket.to(room).emit('typing', {user, typing})).

Online status: keep User collection + presence events emitted to clients on connect/disconnect.

Private messages: privateMessage event saved to DB and sent to recipient socket using map of online users.

Rooms/channels: joinRoom / leaveRoom events; server uses socket.join(room).

File/image sharing: file upload endpoint returns URL; client sends message with type: 'image' and content = URL.

Read receipts & reactions: separate socket events markRead and reaction, update DB and broadcast updates.

Message pagination: REST endpoint /messages?room=global&page=1&limit=20 returning paged messages.

Acks: callbacks on socket.emit(..., ackFn) used to confirm message saved/delivered.

Reconnection: socket.io-client options reconnectionAttempts, reconnectionDelay. Handle queued outgoing messages while offline on client.

Namespaces: shown with io.of('/staff') if you want isolated channels for admin/staff.

Scaling: for multiple Node instances, enable socket.io-redis adapter (or Redis adapter) so that sockets across instances can communicate. Also disable sticky sessions unless using adapter.

Security & production notes

Use HTTPS (TLS) in production.

Use JWT for auth and validate token on connection (handshake.auth.token).

Sanitize message content to prevent XSS; escape when rendering or use safe text nodes.

Limit file upload sizes and validate file types. Store files in S3 for scale.

Use Redis adapter for Socket.IO across multiple server instances: const { createAdapter } = require('@socket.io/redis-adapter').

Rate-limit message sends to prevent abuse.

Use content moderation if needed (e.g., for file/image scanning).


