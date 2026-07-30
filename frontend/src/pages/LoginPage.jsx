// frontend/src/pages/LoginPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Auth endpoint uses OAuth2PasswordRequestForm, which expects urlencoded form params
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);

      const response = await client.post('/auth/login', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token } = response.data;
      localStorage.setItem('token', access_token);

      // Fetch user info
      const meResponse = await client.get('/auth/me');
      localStorage.setItem('user', JSON.stringify(meResponse.data));

      // Redirect to dashboard
      navigate('/');
    } catch (err) {
      console.error('Login failed:', err);
      if (err.response && err.response.status === 401) {
        setError('Invalid email or password. Please try again.');
      } else if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Could not connect to the authentication server.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-canvas-cream font-sans p-6">
      <div className="w-full max-w-md p-8 space-y-8 bg-canvas-light rounded-xl shadow-[0_8px_8px_rgba(0,0,0,0.05),_0_4px_4px_rgba(0,0,0,0.05),_0_2px_2px_rgba(0,0,0,0.05),_0_0_0_1px_rgba(0,0,0,0.05)] border border-hairline-light transition-all duration-300 hover:shadow-[0_12px_20px_rgba(0,0,0,0.08)]">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-aloe-10 mb-4 animate-pulse">
            <span className="text-ink font-semibold text-lg">SI</span>
          </div>
          <h1 className="text-4xl font-display font-light tracking-tight text-ink">
            Smart Inventory
          </h1>
          <p className="mt-2 text-body-md text-shade-50">
            Sign in to access your dashboard
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-md bg-red-50 border border-red-200 text-sm text-red-700 animate-fadeIn">
            {error}
          </div>
        )}

        <form className="space-y-6" onSubmit={handleSubmit}>
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
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full px-4 py-3 bg-canvas-light border border-hairline-light rounded-md placeholder-shade-40 text-ink focus:outline-none focus:ring-2 focus:ring-ink focus:border-ink transition-all text-body-md"
              placeholder="••••••••"
            />
          </div>

          <div>
            <button
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
                  <span>Signing in...</span>
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
