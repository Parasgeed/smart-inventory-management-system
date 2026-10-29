// frontend/src/pages/LoginPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

function LoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleToggleMode = (mode) => {
    setIsRegistering(mode);
    setError('');
    setSuccessMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    // Validation for registration mode
    if (isRegistering) {
      const trimmedUsername = username.trim();
      if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
        setError('Username must be between 3 and 30 characters.');
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
        setError('Username can only contain letters, numbers, and underscores.');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please re-enter.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isRegistering) {
        // Register user
        await client.post('/auth/register', {
          username: username.trim(),
          email: email.trim(),
          password,
        });

        // Automatically log in with the newly created account
        try {
          const params = new URLSearchParams();
          params.append('username', email.trim());
          params.append('password', password);

          const loginResponse = await client.post('/auth/login', params, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          });

          const { access_token } = loginResponse.data;
          localStorage.setItem('token', access_token);

          const meResponse = await client.get('/auth/me');
          localStorage.setItem('user', JSON.stringify(meResponse.data));

          navigate('/');
          return;
        } catch (autoLoginErr) {
          console.warn('Auto-login after register failed:', autoLoginErr);
          setIsRegistering(false);
          setSuccessMsg('Account created successfully! Please sign in with your credentials.');
          setPassword('');
          setConfirmPassword('');
        }
      } else {
        // Sign In
        const params = new URLSearchParams();
        params.append('username', email.trim());
        params.append('password', password);

        const response = await client.post('/auth/login', params, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        const { access_token } = response.data;
        localStorage.setItem('token', access_token);

        const meResponse = await client.get('/auth/me');
        localStorage.setItem('user', JSON.stringify(meResponse.data));

        navigate('/');
      }
    } catch (err) {
      console.error(isRegistering ? 'Registration failed:' : 'Login failed:', err);
      if (err.response && err.response.status === 401) {
        setError('Invalid email or password. Please try again.');
      } else if (err.response && err.response.data && err.response.data.detail) {
        const detail = err.response.data.detail;
        if (typeof detail === 'string') {
          setError(detail);
        } else if (Array.isArray(detail)) {
          setError(detail.map((d) => d.msg).join(', '));
        } else {
          setError(JSON.stringify(detail));
        }
      } else {
        setError(
          isRegistering
            ? 'Could not complete registration. Please try again.'
            : 'Could not connect to the authentication server.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-canvas-cream font-sans p-6">
      <div className="w-full max-w-md p-8 space-y-6 bg-canvas-light rounded-xl shadow-[0_8px_8px_rgba(0,0,0,0.05),_0_4px_4px_rgba(0,0,0,0.05),_0_2px_2px_rgba(0,0,0,0.05),_0_0_0_1px_rgba(0,0,0,0.05)] border border-hairline-light transition-all duration-300 hover:shadow-[0_12px_20px_rgba(0,0,0,0.08)]">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-aloe-10 mb-4 animate-pulse">
            <span className="text-ink font-semibold text-lg">SI</span>
          </div>
          <h1 className="text-3xl font-display font-light tracking-tight text-ink">
            Smart Inventory
          </h1>
          <p className="mt-2 text-body-md text-shade-50">
            {isRegistering
              ? 'Create a new account to get started'
              : 'Sign in to access your dashboard'}
          </p>
        </div>

        {/* Mode Toggle Tabs */}
        <div className="flex p-1 bg-shade-10 rounded-lg border border-hairline-light">
          <button
            type="button"
            id="tab-signin"
            onClick={() => handleToggleMode(false)}
            className={`flex-1 py-2 text-body-sm font-semibold rounded-md transition-all duration-200 cursor-pointer ${
              !isRegistering
                ? 'bg-canvas-light text-ink shadow-sm'
                : 'text-shade-50 hover:text-ink'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            id="tab-register"
            onClick={() => handleToggleMode(true)}
            className={`flex-1 py-2 text-body-sm font-semibold rounded-md transition-all duration-200 cursor-pointer ${
              isRegistering
                ? 'bg-canvas-light text-ink shadow-sm'
                : 'text-shade-50 hover:text-ink'
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div
            id="auth-error-alert"
            className="p-4 rounded-md bg-red-50 border border-red-200 text-sm text-red-700 animate-fadeIn"
          >
            {error}
          </div>
        )}

        {successMsg && (
          <div
            id="auth-success-alert"
            className="p-4 rounded-md bg-green-50 border border-green-200 text-sm text-green-700 animate-fadeIn"
          >
            {successMsg}
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit}>
          {isRegistering && (
            <div className="space-y-1">
              <label
                htmlFor="username"
                className="block text-caption font-semibold text-ink"
              >
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required={isRegistering}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full px-4 py-3 bg-canvas-light border border-hairline-light rounded-md placeholder-shade-40 text-ink focus:outline-none focus:ring-2 focus:ring-ink focus:border-ink transition-all text-body-md"
                placeholder="johndoe"
              />
              <p className="text-caption text-shade-40">
                3–30 characters, letters, numbers, and underscores only.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <label
              htmlFor="email"
              className="block text-caption font-semibold text-ink"
            >
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full px-4 py-3 bg-canvas-light border border-hairline-light rounded-md placeholder-shade-40 text-ink focus:outline-none focus:ring-2 focus:ring-ink focus:border-ink transition-all text-body-md"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="block text-caption font-semibold text-ink"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isRegistering ? 'new-password' : 'current-password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full px-4 py-3 bg-canvas-light border border-hairline-light rounded-md placeholder-shade-40 text-ink focus:outline-none focus:ring-2 focus:ring-ink focus:border-ink transition-all text-body-md"
              placeholder="••••••••"
            />
            {isRegistering && (
              <p className="text-caption text-shade-40">
                Minimum 8 characters.
              </p>
            )}
          </div>

          {isRegistering && (
            <div className="space-y-1">
              <label
                htmlFor="confirmPassword"
                className="block text-caption font-semibold text-ink"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required={isRegistering}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full px-4 py-3 bg-canvas-light border border-hairline-light rounded-md placeholder-shade-40 text-ink focus:outline-none focus:ring-2 focus:ring-ink focus:border-ink transition-all text-body-md"
                placeholder="••••••••"
              />
            </div>
          )}

          <div>
            <button
              id="submit-auth-btn"
              type="submit"
              disabled={loading}
              className="flex justify-center items-center w-full px-xl py-3 text-body-md font-semibold text-on-primary bg-primary rounded-full hover:bg-shade-70 active:bg-shade-70 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ink transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center space-x-2">
                  <svg className="animate-spin h-5 w-5 text-on-primary" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>{isRegistering ? 'Creating account...' : 'Signing in...'}</span>
                </span>
              ) : isRegistering ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </button>
          </div>
        </form>

        <div className="text-center pt-2 border-t border-hairline-light">
          <button
            type="button"
            id="toggle-auth-mode-link"
            onClick={() => handleToggleMode(!isRegistering)}
            className="text-body-sm text-shade-60 hover:text-ink font-medium transition-colors cursor-pointer"
          >
            {isRegistering ? (
              <span>Already have an account? <span className="text-primary font-semibold underline">Sign In</span></span>
            ) : (
              <span>Don't have an account? <span className="text-primary font-semibold underline">Create one</span></span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
