const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, index: true },
  socketId: String,
  online: { type: Boolean, default: false },
  lastSeen: Date
});

module.exports = mongoose.model('User', userSchema);
