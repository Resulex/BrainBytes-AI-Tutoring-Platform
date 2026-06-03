import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const SUBJECT_OPTIONS = [
  'Mathematics',
  'Science',
  'English',
  'History',
  'Filipino',
  'Computer Science',
  'Other',
];

export default function Profile() {
  const { user, isAuthenticated, loading: authLoading, logout, updateUser } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [preferredSubjects, setPreferredSubjects] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setBio(user.bio || '');
      setPreferredSubjects(user.preferredSubjects || []);
    }
  }, [user]);

  const toggleSubject = (subject) => {
    setPreferredSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject],
    );
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await axios.put(
        `${API_URL}/api/users/${user.id}`,
        { name, email, bio, preferredSubjects },
        { headers: { Authorization: `Bearer ${localStorage.getItem('brainbytes_token')}` } },
      );
      updateUser(res.data.user);
      setMessage('Profile updated successfully! ✅');
    } catch (err) {
      console.error('Profile update failed:', err);
      setMessage('Update failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return <div style={styles.loading}>Loading...</div>;
  }
  if (!isAuthenticated) {
    return (
      <div style={styles.container}>
        <h1>Please log in to view your profile</h1>
        <Link href="/">
          <a style={styles.link}>Go to Login</a>
        </Link>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>Your Profile</h1>
          <p style={styles.headerSubtitle}>Manage your account settings</p>
        </div>
        <div style={styles.headerActions}>
          <Link href="/dashboard">
            <a style={styles.navLink}>Dashboard</a>
          </Link>
          <Link href="/">
            <a style={styles.navLink}>Chat</a>
          </Link>
          <button onClick={logout} style={styles.logoutBtn}>
            Sign Out
          </button>
        </div>
      </div>

      {message && (
        <div style={message.includes('✅') ? styles.successBanner : styles.errorBanner}>
          {message}
        </div>
      )}

      <form onSubmit={handleUpdate} style={styles.form}>
        <div style={styles.formCard}>
          <label style={styles.label}>Full Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.input}
            required
          />

          <label style={styles.label}>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            type="email"
            required
          />

          <label style={styles.label}>Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            style={styles.textarea}
            maxLength={500}
            placeholder="Tell us a bit about yourself..."
          />
          <span style={styles.charCount}>{bio.length}/500</span>

          <label style={styles.label}>Preferred Subjects</label>
          <p style={styles.hint}>Select the subjects you&apos;re interested in:</p>
          <div style={styles.subjectGrid}>
            {SUBJECT_OPTIONS.map((subject) => (
              <button
                key={subject}
                type="button"
                onClick={() => toggleSubject(subject)}
                style={{
                  ...styles.subjectChip,
                  backgroundColor: preferredSubjects.includes(subject) ? '#1a237e' : '#f0f0f0',
                  color: preferredSubjects.includes(subject) ? 'white' : '#333',
                }}
              >
                {subject}
              </button>
            ))}
          </div>

          <button type="submit" disabled={saving} style={styles.saveButton}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'Nunito, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  headerTitle: { color: '#1a237e', fontSize: '28px', margin: '0 0 4px 0' },
  headerSubtitle: { color: '#666', margin: 0, fontSize: '14px' },
  headerActions: { display: 'flex', gap: '12px', alignItems: 'center' },
  navLink: { color: '#1a237e', textDecoration: 'none', fontWeight: 600, fontSize: '14px' },
  logoutBtn: {
    backgroundColor: 'transparent',
    color: '#c62828',
    border: '1px solid #ffcdd2',
    padding: '6px 14px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  formCard: {
    background: 'white',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  label: {
    display: 'block',
    fontWeight: 600,
    color: '#333',
    margin: '16px 0 6px 0',
    fontSize: '14px',
  },
  input: {
    display: 'block',
    width: '100%',
    padding: '12px 14px',
    borderRadius: '8px',
    border: '2px solid #e0e0e0',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    display: 'block',
    width: '100%',
    padding: '12px 14px',
    borderRadius: '8px',
    border: '2px solid #e0e0e0',
    fontSize: '15px',
    outline: 'none',
    resize: 'vertical',
    minHeight: '80px',
    boxSizing: 'border-box',
  },
  charCount: {
    display: 'block',
    textAlign: 'right',
    fontSize: '12px',
    color: '#999',
    marginTop: '4px',
  },
  hint: { margin: '0 0 10px 0', color: '#666', fontSize: '13px' },
  subjectGrid: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' },
  subjectChip: {
    padding: '8px 16px',
    borderRadius: '20px',
    border: 'none',
    fontSize: '13px',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  saveButton: {
    display: 'block',
    width: '100%',
    padding: '14px',
    backgroundColor: '#1a237e',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '8px',
  },
  successBanner: {
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    padding: '12px',
    borderRadius: '10px',
    marginBottom: '16px',
    fontSize: '14px',
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    padding: '12px',
    borderRadius: '10px',
    marginBottom: '16px',
    fontSize: '14px',
    textAlign: 'center',
  },
  link: { color: '#1a237e', textDecoration: 'none', fontWeight: 600 },
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' },
};
