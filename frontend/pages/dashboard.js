import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function Dashboard() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [recentMessages, setRecentMessages] = useState([]);
  const [materialsCount, setMaterialsCount] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    axios.get(`${API_URL}/api/messages?limit=50`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('brainbytes_token')}` }
      })
      .then(res => setRecentMessages(res.data.messages || res.data || []))
      .catch(console.error);
    axios.get(`${API_URL}/api/materials?limit=1`)
      .then(res => setMaterialsCount(res.data.pagination?.totalItems || 0))
      .catch(console.error);
  }, [isAuthenticated]);

  if (authLoading) return <div style={styles.loading}>Loading...</div>;
  if (!isAuthenticated) return (
    <div style={styles.container}>
      <h1>Please log in to view the dashboard</h1>
      <Link href="/"><a style={styles.link}>Go to Login</a></Link>
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Dashboard</h1>
        <p style={styles.headerSubtitle}>Welcome back, {user?.name || 'Student'}!</p>
      </div>
      
      <div className="stats-grid" style={styles.statsGrid}>
        <div style={styles.statCard}>
          <h3 style={styles.statLabel}>Total Learning Materials</h3>
          <p style={styles.statValue}>{materialsCount}</p>
          <p style={styles.statSub}>Available lessons</p>
        </div>
        <div style={{ ...styles.statCard, background: '#f0fff0' }}>
          <h3 style={styles.statLabel}>Recent Messages</h3>
          <p style={styles.statValue}>{recentMessages.length}</p>
          <p style={styles.statSub}>In current session</p>
        </div>
        <div style={{ ...styles.statCard, background: '#fff0f0' }}>
          <h3 style={styles.statLabel}>Subjects</h3>
          <p style={styles.statValue}>{user?.preferredSubjects?.length || 0}</p>
          <p style={styles.statSub}>Tracked subjects</p>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2>Recent Chat Messages</h2>
          <Link href="/"><a style={styles.link}>Go to Chat →</a></Link>
        </div>
        <ul style={styles.messageList}>
          {recentMessages.length === 0 ? (
            <li style={styles.emptyState}>No messages yet. Start a conversation!</li>
          ) : (
            (expanded ? recentMessages : recentMessages.slice(0, 5)).map(msg => (
              <li key={msg._id} style={styles.messageItem}>
                <strong style={{ color: msg.isUser ? '#1565c0' : '#2e7d32' }}>
                  {msg.isUser ? 'You' : 'AI'}:
                </strong>
                {' '}{msg.text.substring(0, 120)}{msg.text.length > 120 ? '...' : ''}
                <span style={styles.messageTime}>
                  {new Date(msg.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))
          )}
        </ul>
        {recentMessages.length > 5 && (
          <button onClick={() => setExpanded(!expanded)} style={styles.expandButton}>
            {expanded ? '▲ Show Less' : `▼ Show All (${recentMessages.length})`}
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { maxWidth: '900px', margin: '0 auto', padding: '20px', fontFamily: 'Nunito, sans-serif' },
  header: { marginBottom: '24px' },
  headerTitle: { color: '#1a237e', fontSize: '28px', margin: '0 0 4px 0' },
  headerSubtitle: { color: '#666', margin: 0, fontSize: '16px' },
  statsGrid: { display: 'flex', gap: '20px', marginBottom: '32px' },
  statCard: {
    flex: 1, padding: '20px', background: '#f0f8ff', borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center',
  },
  statLabel: { margin: '0 0 8px 0', color: '#555', fontSize: '14px', fontWeight: 500 },
  statValue: { margin: 0, fontSize: '2.5em', fontWeight: 700, color: '#1a237e' },
  statSub: { margin: '4px 0 0 0', color: '#888', fontSize: '12px' },
  section: {
    background: 'white', borderRadius: '12px', padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  sectionHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '16px',
  },
  link: { color: '#1a237e', textDecoration: 'none', fontWeight: 600 },
  messageList: { listStyle: 'none', padding: 0, margin: 0 },
  messageItem: {
    padding: '12px', borderBottom: '1px solid #f0f0f0', fontSize: '14px',
    lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '4px',
  },
  messageTime: { fontSize: '12px', color: '#999' },
  emptyState: { padding: '20px', textAlign: 'center', color: '#999' },
  expandButton: {
    display: 'block', width: '100%', padding: '10px', marginTop: '8px',
    backgroundColor: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: '8px',
    cursor: 'pointer', fontSize: '14px', color: '#1a237e', fontWeight: 600,
  },
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' },
};

// Inject responsive styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 600px) {
      body { margin: 0; }
      .stats-grid { flex-direction: column !important; gap: 12px !important; }
      .stats-grid > div { padding: 16px !important; }
      .stats-grid h3 { font-size: 13px !important; }
      .stats-grid p { font-size: 2em !important; }
    }
    @media (min-width: 601px) and (max-width: 900px) {
      .stats-grid { gap: 12px !important; }
    }
  `;
  document.head.appendChild(style);
}