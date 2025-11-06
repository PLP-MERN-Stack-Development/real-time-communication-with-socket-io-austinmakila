const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
  user: String,
  type: String,
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const messageSchema = new mongoose.Schema({
  room: { type: String, default: 'global' },
  from: { type: String, required: true },
  to: { type: String, default: null }, // for private messages
  content: { type: String, required: true },
  type: { type: String, enum: ['text','image','file'], default: 'text' },
  reactions: { type: [reactionSchema], default: [] },
  readBy: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', messageSchema);
