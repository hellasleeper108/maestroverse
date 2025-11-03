import '../styles/globals.css';
import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { auth } from '../lib/api';
import { useRouter } from 'next/router';

function App({ Component, pageProps }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const data = await auth.getMe();
      setUser(data.user);
    } catch (error) {
      if (router.pathname !== '/login') {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return <Component {...pageProps} user={user} setUser={setUser} />;
}

App.propTypes = {
  Component: PropTypes.elementType.isRequired,
  pageProps: PropTypes.object.isRequired,
};

export default App;
