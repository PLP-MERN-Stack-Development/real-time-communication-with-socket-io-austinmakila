require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const Message = require('./models/Message');
const User = require('./models/User');

const app = express();
app.use(cors());
app.use(express.json());

// === Connect MongoDB ===
const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/chatapp';
mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=>console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
  });

// === Upload config ===
const uploadDir = path.join(__dirname, 'uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit
app.use('/uploads', express.static(uploadDir));

// === Simple endpoints ===
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// message pagination endpoint
app.get('/messages', async (req, res) => {
  try {
    const room = req.query.room || 'global';
    const page = Math.max(1, parseInt(req.query.page || '1'));
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit || '20')));
    const skip = (page - 1) * limit;
    const docs = await Message.find({ room }).sort({ createdAt: -1 }).skip(skip).limit(limit);
    return res.json({ messages: docs.reverse() }); // oldest-first
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal' });
  }
});

// upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file uploaded' });
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
});

// simple /login -> returns token
app.post('/login', (req, res) => {
  const username = (req.body.username || '').trim();
  if (!username) return res.status(400).json({ error: 'username required' });
  // create/update user doc
  const token = jwt.sign({ username }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '24h' });
  res.json({ token, username });
});

// === HTTP + Socket.IO server ===
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000
});

// in-memory username -> socketId map for fast lookup
const onlineMap = new Map();

io.on('connection', async (socket) => {
  // extract token/username from handshake
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  let username = socket.handshake.auth?.username || socket.handshake.query?.username;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
      username = payload.username;
    } catch (err) {
      console.warn('Invalid token on connection');
    }
  }
  if (!username) username = 'Guest-' + socket.id.slice(0,6);
  socket.data.username = username;

  // persist user online
  onlineMap.set(username, socket.id);
  await User.findOneAndUpdate({ username }, { username, socketId: socket.id, online: true }, { upsert: true });

  // broadcast presence list
  const users = await User.find().select('username online lastSeen -_id');
  io.emit('presence', users);

  console.log(`CONNECT: ${username} (${socket.id})`);

  // join default room
  const defaultRoom = 'global';
  socket.join(defaultRoom);

  // emit recent messages for default room (limit 50)
  const recent = await Message.find({ room: defaultRoom }).sort({ createdAt: -1 }).limit(50);
  socket.emit('recentMessages', recent.reverse());

  // events
  socket.on('joinRoom', async (roomName, cb) => {
    socket.join(roomName);
    io.to(roomName).emit('systemMessage', { text: `${username} joined ${roomName}`, room: roomName });
    cb && cb({ ok: true });
  });

  socket.on('leaveRoom', (roomName, cb) => {
    socket.leave(roomName);
    io.to(roomName).emit('systemMessage', { text: `${username} left ${roomName}`, room: roomName });
    cb && cb({ ok: true });
  });

  socket.on('sendMessage', async (msg, ack) => {
    try {
      const doc = new Message({
        room: msg.room || defaultRoom,
        from: username,
        to: msg.to || null,
        content: msg.content,
        type: msg.type || 'text'
      });
      await doc.save();
      io.to(doc.room).emit('message', doc);
      ack && ack({ status: 'sent', id: doc._id, createdAt: doc.createdAt });
    } catch (err) {
      console.error('sendMessage error', err);
      ack && ack({ status: 'error' });
    }
  });

  socket.on('privateMessage', async ({ to, content }, ack) => {
    try {
      const roomName = `pm:${[username, to].sort().join('-')}`;
      const doc = new Message({ room: roomName, from: username, to, content, type: 'text' });
      await doc.save();
      // emit to recipient if online
      const toSocket = onlineMap.get(to);
      if (toSocket) io.to(toSocket).emit('privateMessage', doc);
      socket.emit('privateMessage', doc);
      ack && ack({ status: 'delivered', id: doc._id });
    } catch (err) {
      console.error(err);
      ack && ack({ status: 'error' });
    }
  });

  socket.on('typing', ({ room, typing }) => {
    socket.to(room || defaultRoom).emit('typing', { user: username, typing });
  });

  socket.on('reaction', async ({ messageId, reaction }, ack) => {
    try {
      const m = await Message.findById(messageId);
      if (!m) return ack && ack({ status: 'notfound' });
      m.reactions.push({ user: username, type: reaction });
      await m.save();
      io.to(m.room).emit('reaction', { messageId, user: username, reaction });
      ack && ack({ status: 'ok' });
    } catch (err) {
      console.error(err);
      ack && ack({ status: 'error' });
    }
  });

  socket.on('markRead', async ({ messageId }, ack) => {
    try {
      const m = await Message.findById(messageId);
      if (!m) return ack && ack({ status: 'notfound' });
      if (!m.readBy.includes(username)) m.readBy.push(username);
      await m.save();
      io.to(m.room).emit('readReceipt', { messageId, user: username });
      ack && ack({ status: 'ok' });
    } catch (err) {
      console.error(err);
      ack && ack({ status: 'error' });
    }
  });

  socket.on('disconnect', async (reason) => {
    console.log(`DISCONNECT: ${username} (${socket.id}) reason: ${reason}`);
    onlineMap.delete(username);
    await User.findOneAndUpdate({ username }, { online: false, lastSeen: new Date() });
    const users2 = await User.find().select('username online lastSeen -_id');
    io.emit('presence', users2);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
