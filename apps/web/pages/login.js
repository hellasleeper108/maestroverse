import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import PropTypes from 'prop-types';
import { auth } from '../lib/api';
import OAuthButtons from '../components/OAuthButtons';

function Login({ setUser }) {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Handle OAuth callback
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const { auth: authStatus, error: authError, token } = router.query;

      if (authStatus === 'success' && token) {
        try {
          // Token is already set in cookies by backend
          // Fetch user data
          const data = await auth.me();
          setUser(data.user);
          // Clean URL and redirect
          router.replace('/hub');
        } catch (err) {
          console.error('[OAuth] Failed to fetch user:', err);
          setError('Authentication successful, but failed to fetch user data');
        }
      } else if (authError) {
        const errorMessages = {
          google_auth_failed: 'Google authentication failed',
          github_auth_failed: 'GitHub authentication failed',
          authentication_failed: 'Authentication failed',
          account_banned: 'Your account has been banned',
          account_suspended: 'Your account is suspended',
          authentication_error: 'An error occurred during authentication',
        };
        setError(errorMessages[authError] || 'Authentication failed');
        // Clean URL
        router.replace('/login', undefined, { shallow: true });
      }
    };

    handleOAuthCallback();
  }, [router, router.query, setUser]);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('[Login] Attempting login...');
      const data = await auth.login({ emailOrUsername, password });
      console.log('[Login] Login successful:', data.user?.email);
      setUser(data.user);
      // Wait a moment for state to update before navigating
      setTimeout(() => {
        router.push('/hub');
      }, 100);
    } catch (err) {
      console.error('[Login] Login failed:', err);
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-teal-400 to-cyan-500 bg-clip-text text-transparent mb-2">
            Maestroverse
          </h1>
          <p className="text-gray-400">Student Hub Login</p>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-gray-300 mb-2">Email or Username</label>
              <input
                type="text"
                value={emailOrUsername}
                onChange={(e) => setEmailOrUsername(e.target.value)}
                className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 text-white py-3 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="mt-6">
            <OAuthButtons />
          </div>

          <div className="mt-6 text-center">
            <p className="text-gray-400">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-teal-400 hover:text-teal-300">
                Register
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center text-gray-400 text-sm">
          <p>Demo credentials:</p>
          <p>Email: alice@maestro.edu</p>
          <p>Password: password123</p>
        </div>
      </div>
    </div>
  );
}

Login.propTypes = {
  setUser: PropTypes.func.isRequired,
};

export default Login;
