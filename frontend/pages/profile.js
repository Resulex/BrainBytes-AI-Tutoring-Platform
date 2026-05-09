import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [preferredSubjects, setPreferredSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch the first user (for simplicity) or use user ID from auth
    axios.get('http://localhost:3000/api/users')
      .then(res => {
        if (res.data.length > 0) {
          const u = res.data[0];
          setUser(u);
          setName(u.name);
          setEmail(u.email);
          setPreferredSubjects(u.preferredSubjects || []);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      const res = await axios.put(`http://localhost:3000/api/users/${user._id}`, { name, email, preferredSubjects });
      alert('Profile updated!');
    } catch (err) {
      alert('Update failed');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ maxWidth: '500px', margin: '40px auto' }}>
      <h1>Your Profile</h1>
      <form onSubmit={handleUpdate}>
        <label>Name</label>
        <input value={name} onChange={e => setName(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 10 }} />
        <label>Email</label>
        <input value={email} onChange={e => setEmail(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 10 }} />
        <label>Preferred Subjects (comma separated)</label>
        <input value={preferredSubjects.join(', ')} onChange={e => setPreferredSubjects(e.target.value.split(',').map(s => s.trim()))} style={{ display: 'block', width: '100%', marginBottom: 10 }} />
        <button type="submit" style={{ padding: '10px 20px', background: '#2196f3', color: 'white', border: 'none', borderRadius: 5 }}>Save</button>
      </form>
    </div>
  );
}