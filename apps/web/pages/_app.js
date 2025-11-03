import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import PropTypes from 'prop-types';
import '../styles/globals.css';
import { auth } from '../lib/api';

function MyApp({ Component, pageProps }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    // Handle redirects after auth check completes
    const publicPages = ['/login', '/register'];
    const isPublicPage = publicPages.includes(router.pathname);

    if (authChecked && !loading) {
      if (!user && !isPublicPage) {
        // Not logged in and trying to access protected page
        console.log('[Auth] Redirecting to /login - no user found');
        router.replace('/login');
      } else if (user && (router.pathname === '/login' || router.pathname === '/')) {
        // Logged in but on login page or root, redirect to hub
        console.log('[Auth] User authenticated, redirecting to /hub');
        router.replace('/hub');
      }
    }
  }, [authChecked, user, router, loading]);

  async function checkAuth() {
    try {
      console.log('[Auth] Checking authentication...');
      const data = await auth.getMe();
      console.log('[Auth] User authenticated:', data.user?.email);
      setUser(data.user);
    } catch (error) {
      // Not authenticated or token expired
      console.log('[Auth] Not authenticated:', error.message);
      setUser(null);
    } finally {
      setLoading(false);
      setAuthChecked(true);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return <Component {...pageProps} user={user} setUser={setUser} authChecked={authChecked} />;
}

MyApp.propTypes = {
  Component: PropTypes.elementType.isRequired,
  pageProps: PropTypes.object.isRequired,
};

export default MyApp;
