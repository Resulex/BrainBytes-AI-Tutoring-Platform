import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Dashboard() {
  const [recentMessages, setRecentMessages] = useState([]);
  const [materialsCount, setMaterialsCount] = useState(0);

  useEffect(() => {
    axios.get('http://localhost:3000/api/messages?limit=5')
      .then(res => setRecentMessages(res.data))
      .catch(console.error);
    axios.get('http://localhost:3000/api/materials?limit=1')
      .then(res => setMaterialsCount(res.data.pagination?.totalItems || 0))
      .catch(console.error);
  }, []);

  return (
    <div style={{ maxWidth: '800px', margin: '20px auto' }}>
      <h1>Dashboard</h1>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div style={{ flex: 1, padding: '20px', background: '#f0f8ff', borderRadius: 8 }}>
          <h3>Total Learning Materials</h3>
          <p style={{ fontSize: '2em' }}>{materialsCount}</p>
        </div>
        <div style={{ flex: 1, padding: '20px', background: '#f0fff0', borderRadius: 8 }}>
          <h3>Recent Messages</h3>
          <p style={{ fontSize: '2em' }}>{recentMessages.length}</p>
        </div>
      </div>
      <h2>Recent Chat Messages</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {recentMessages.map(msg => (
          <li key={msg._id} style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
            <strong>{msg.isUser ? 'You' : 'AI'}:</strong> {msg.text.substring(0, 100)}...
          </li>
        ))}
      </ul>
    </div>
  );
}