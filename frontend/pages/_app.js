import { useEffect } from 'react';
import { AuthProvider } from '../context/AuthContext';

function BrainBytesApp({ Component, pageProps }) {
  // Register service worker for PWA support
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW registered:', reg.scope))
        .catch(err => console.error('SW registration failed:', err));
    }
  }, []);

  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}

export default BrainBytesApp;
