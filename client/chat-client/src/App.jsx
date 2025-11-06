import React, { useEffect, useState } from 'react';
import useSocket from './hooks/useSocket';
import axios from 'axios';

const SERVER = 'http://localhost:4000';

function App() {
  const storedName = localStorage.getItem('username') || '';
  const [username, setUsername] = useState(storedName);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [room, setRoom] = useState('global');

  const { connected, presence, messages, typingUsers, sendMessage, sendPrivate, joinRoom, emitTyping, markRead } =
    useSocket({ url: SERVER, token, username });

  useEffect(() => {
    if (username) {
      localStorage.setItem('username', username);
    }
  }, [username]);

  // login simple -> get JWT
  const login = async () => {
    const res = await axios.post(`${SERVER}/login`, { username });
    setToken(res.data.token);
    localStorage.setItem('token', res.data.token);
  };

  const handleSend = async (text) => {
    if (!text) return;
    sendMessage({ room, content: text, type: 'text' }, (ack) => {
      console.log('ack', ack);
    });
  };

  // file upload example
  const handleFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const r = await axios.post(`${SERVER}/upload`, formData);
    sendMessage({ room, content: r.data.url, type: 'image' });
  };

  // show browser notification for incoming messages (basic)
  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    // show browser notification for last message if not from me
    const last = messages[messages.length - 1];
    if (last && last.from !== username) {
      if (Notification.permission === 'granted') {
        new Notification(`New message from ${last.from}`, { body: last.content });
      }
    }
  }, [messages, username]);

  return (
    <div style={{ display: 'flex', height: '100vh', gap: 20 }}>
      <div style={{ width: 250, padding: 10, borderRight: '1px solid #ddd' }}>
        <h3>Connect</h3>
        <input placeholder='username' value={username} onChange={e=>setUsername(e.target.value)} />
        <button onClick={login}>Login (get token)</button>
        <p>Socket: {connected ? 'connected' : 'disconnected'}</p>

        <h4>Online</h4>
        <ul>
          {presence.map(u => <li key={u.username}>{u.username} {u.online ? '🟢' : '⚪️'}</li>)}
        </ul>
      </div>

      <ChatPanel
        messages={messages}
        onSend={handleSend}
        onFile={handleFile}
        typingUsers={typingUsers}
        username={username}
        markRead={markRead}
      />
    </div>
  );
}

function ChatPanel({ messages, onSend, onFile, typingUsers, username, markRead }) {
  const [text, setText] = useState('');

  const handleSend = () => {
    onSend(text);
    setText('');
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) onFile(f);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
        {messages.map(m => (
          <div key={m._id} style={{ marginBottom: 8 }}>
            <b>{m.from}</b> <small>{new Date(m.createdAt).toLocaleTimeString()}</small>
            <div>
              {m.type === 'image' ? <img src={m.content} alt='' style={{ maxWidth: 200 }} /> : m.content}
            </div>
            <div>
              <small>Reactions: {(m.reactions || []).map(r=>r.type).join(', ')}</small>
              <button onClick={()=>markRead({ messageId: m._id }, console.log)}>Mark Read</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: 10, borderTop: '1px solid #ddd' }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder='Type a message...' />
        <button onClick={handleSend}>Send</button>
        <input type="file" onChange={handleFileChange} />
        <div>
          {Object.entries(typingUsers).filter(([u, t])=>t).map(([u])=> <small key={u}>{u} is typing…</small>)}
        </div>
      </div>
    </div>
  );
}

export default App;
