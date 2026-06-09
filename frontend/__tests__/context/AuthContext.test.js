import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import axios from 'axios';
import { AuthProvider, useAuth } from '../../context/AuthContext';

// Mock axios
jest.mock('axios');

// Helper: component that consumes AuthContext and renders its values
function AuthConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(auth.loading)}</span>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="username">{auth.user?.name || 'no-user'}</span>
      <span data-testid="token">{auth.token || 'no-token'}</span>
      <button
        data-testid="login-btn"
        onClick={async () => {
          try { await auth.login('test@test.com', 'password'); } catch (e) { /* expected */ }
        }}
      >
        Login
      </button>
      <button
        data-testid="register-btn"
        onClick={async () => {
          try { await auth.register('Test', 'test@test.com', 'password', []); } catch (e) { /* expected */ }
        }}
      >
        Register
      </button>
      <button data-testid="logout-btn" onClick={auth.logout}>
        Logout
      </button>
      <button data-testid="update-btn" onClick={() => auth.updateUser({ name: 'Updated', email: 'updated@test.com' })}>
        Update
      </button>
    </div>
  );
}

// Helper: component that uses useAuth outside provider (should throw)
function AuthConsumerWithoutProvider() {
  const auth = useAuth();
  return <div>{auth.user?.name}</div>;
}

function renderWithProvider(ui, { providerProps = {} } = {}) {
  return render(<AuthProvider {...providerProps}>{ui}</AuthProvider>);
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    // Reset axios defaults
    delete axios.defaults.headers.common['Authorization'];
  });

  describe('AuthProvider', () => {
    test('shows unauthenticated state after initial load completes', async () => {
      renderWithProvider(<AuthConsumer />);
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });
      expect(screen.getByTestId('authenticated').textContent).toBe('false');
      expect(screen.getByTestId('username').textContent).toBe('no-user');
    });

    test('sets loading to false when no stored token exists', async () => {
      renderWithProvider(<AuthConsumer />);
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });
      expect(screen.getByTestId('authenticated').textContent).toBe('false');
    });

    test('restores auth state from localStorage', async () => {
      const storedToken = 'mock-jwt-token';
      const storedUser = { name: 'StoredUser', email: 'stored@test.com' };
      localStorage.setItem('brainbytes_token', storedToken);
      localStorage.setItem('brainbytes_user', JSON.stringify(storedUser));

      axios.get.mockResolvedValueOnce({ data: { user: storedUser } });

      renderWithProvider(<AuthConsumer />);

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });
      expect(screen.getByTestId('authenticated').textContent).toBe('true');
      expect(screen.getByTestId('username').textContent).toBe('StoredUser');
      expect(screen.getByTestId('token').textContent).toBe(storedToken);
    });

    test('calls /api/auth/me to verify stored token', async () => {
      localStorage.setItem('brainbytes_token', 'stale-token');
      localStorage.setItem('brainbytes_user', JSON.stringify({ name: 'OldUser' }));

      axios.get.mockResolvedValueOnce({
        data: { user: { name: 'FreshUser', email: 'fresh@test.com' } },
      });

      renderWithProvider(<AuthConsumer />);

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/me'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer stale-token' },
        }),
      );
      // User should be updated from the fresh API response
      expect(screen.getByTestId('username').textContent).toBe('FreshUser');
    });

    test('logs out when token verification fails (401)', async () => {
      localStorage.setItem('brainbytes_token', 'expired-token');
      localStorage.setItem('brainbytes_user', JSON.stringify({ name: 'OldUser' }));

      axios.get.mockRejectedValueOnce({ response: { status: 401 } });

      renderWithProvider(<AuthConsumer />);

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });
      expect(screen.getByTestId('authenticated').textContent).toBe('false');
      expect(screen.getByTestId('username').textContent).toBe('no-user');
    });
  });

  describe('login', () => {
    test('successful login stores token and user', async () => {
      const userData = { name: 'TestUser', email: 'test@test.com' };
      const token = 'login-jwt-token';
      axios.post.mockResolvedValueOnce({ data: { token, user: userData } });

      renderWithProvider(<AuthConsumer />);

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      fireEvent.click(screen.getByTestId('login-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('authenticated').textContent).toBe('true');
      });

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/login'),
        { email: 'test@test.com', password: 'password' },
      );
      expect(screen.getByTestId('username').textContent).toBe('TestUser');
      expect(localStorage.getItem('brainbytes_token')).toBe(token);
      expect(localStorage.getItem('brainbytes_user')).toBe(JSON.stringify(userData));
      expect(axios.defaults.headers.common['Authorization']).toBe(`Bearer ${token}`);
    });

    test('login failure does not update state', async () => {
      axios.post.mockRejectedValueOnce(new Error('Invalid credentials'));

      renderWithProvider(<AuthConsumer />);

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      fireEvent.click(screen.getByTestId('login-btn'));

      // After failure, user should still be unauthenticated
      await waitFor(() => {
        expect(screen.getByTestId('authenticated').textContent).toBe('false');
      });
      expect(localStorage.getItem('brainbytes_token')).toBeNull();
    });
  });

  describe('register', () => {
    test('successful registration stores token and user', async () => {
      const userData = { name: 'NewUser', email: 'new@test.com' };
      const token = 'register-jwt-token';
      axios.post.mockResolvedValueOnce({ data: { token, user: userData } });

      renderWithProvider(<AuthConsumer />);

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      fireEvent.click(screen.getByTestId('register-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('authenticated').textContent).toBe('true');
      });

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/register'),
        {
          name: 'Test',
          email: 'test@test.com',
          password: 'password',
          preferredSubjects: [],
        },
      );
      expect(screen.getByTestId('username').textContent).toBe('NewUser');
      expect(localStorage.getItem('brainbytes_token')).toBe(token);
    });

    test('register failure does not update state', async () => {
      axios.post.mockRejectedValueOnce(new Error('Email taken'));

      renderWithProvider(<AuthConsumer />);

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      fireEvent.click(screen.getByTestId('register-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('authenticated').textContent).toBe('false');
      });
      expect(localStorage.getItem('brainbytes_token')).toBeNull();
    });
  });

  describe('logout', () => {
    test('clears auth state and localStorage', async () => {
      localStorage.setItem('brainbytes_token', 'some-token');
      localStorage.setItem('brainbytes_user', JSON.stringify({ name: 'User' }));
      axios.defaults.headers.common['Authorization'] = 'Bearer some-token';

      renderWithProvider(<AuthConsumer />);

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      fireEvent.click(screen.getByTestId('logout-btn'));

      expect(screen.getByTestId('authenticated').textContent).toBe('false');
      expect(screen.getByTestId('username').textContent).toBe('no-user');
      expect(screen.getByTestId('token').textContent).toBe('no-token');
      expect(localStorage.getItem('brainbytes_token')).toBeNull();
      expect(localStorage.getItem('brainbytes_user')).toBeNull();
      expect(axios.defaults.headers.common['Authorization']).toBeUndefined();
    });
  });

  describe('updateUser', () => {
    test('updates user in state and localStorage', async () => {
      localStorage.setItem('brainbytes_token', 'token');
      localStorage.setItem('brainbytes_user', JSON.stringify({ name: 'Old', email: 'old@test.com' }));
      axios.get.mockResolvedValueOnce({ data: { user: { name: 'Old', email: 'old@test.com' } } });

      renderWithProvider(<AuthConsumer />);

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });

      fireEvent.click(screen.getByTestId('update-btn'));

      expect(screen.getByTestId('username').textContent).toBe('Updated');
      const stored = JSON.parse(localStorage.getItem('brainbytes_user'));
      expect(stored.name).toBe('Updated');
      expect(stored.email).toBe('updated@test.com');
    });
  });

  describe('useAuth error boundary', () => {
    test('throws when used outside AuthProvider', () => {
      // Suppress console.error for the expected error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => render(<AuthConsumerWithoutProvider />)).toThrow(
        'useAuth must be used within an AuthProvider',
      );

      consoleSpy.mockRestore();
    });
  });
});
