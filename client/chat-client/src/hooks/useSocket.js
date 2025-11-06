// A reusable hook to manage socket lifecycle, reconnection options, and events.

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export default function useSocket({ url, token, username }) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState([]); // users list
  const [messages, setMessages] = useState([]); // all messages for current room
  const [typingUsers, setTypingUsers] = useState({});

  useEffect(() => {
    const socket = io(url, {
      auth: { token, username },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      console.log('connected', socket.id);
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('presence', (users) => setPresence(users));
    socket.on('recentMessages', (recent) => setMessages(recent));
    socket.on('message', (m) => setMessages(prev => [...prev, m]));
    socket.on('privateMessage', (m) => setMessages(prev => [...prev, m]));
    socket.on('typing', ({ user, typing }) => {
      setTypingUsers(prev => ({ ...prev, [user]: typing }));
    });
    socket.on('reaction', ({ messageId, user, reaction }) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, reactions: [...(m.reactions||[]), { user, type: reaction }] } : m));
    });
    socket.on('readReceipt', ({ messageId, user }) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, readBy: [...(m.readBy||[]), user] } : m));
    });

    return () => { socket.disconnect(); };
  }, [url, token, username]);

  const sendMessage = (payload, cb) => {
    socketRef.current?.emit('sendMessage', payload, cb);
  };

  const sendPrivate = (payload, cb) => {
    socketRef.current?.emit('privateMessage', payload, cb);
  };

  const joinRoom = (room, cb) => socketRef.current?.emit('joinRoom', room, cb);
  const leaveRoom = (room, cb) => socketRef.current?.emit('leaveRoom', room, cb);
  const emitTyping = (payload) => socketRef.current?.emit('typing', payload);
  const reactTo = (payload, cb) => socketRef.current?.emit('reaction', payload, cb);
  const markRead = (payload, cb) => socketRef.current?.emit('markRead', payload, cb);

  return { connected, presence, messages, typingUsers, sendMessage, sendPrivate, joinRoom, leaveRoom, emitTyping, reactTo, markRead };
}
