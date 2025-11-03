import { useEffect } from 'react';
import { useRouter } from 'next/router';
import PropTypes from 'prop-types';

function Home({ user }) {
  const router = useRouter();

  useEffect(() => {
    if (user) {
      // Redirect authenticated users to hub
      router.push('/hub');
    }
  }, [user, router]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

Home.propTypes = {
  user: PropTypes.object,
};

export default Home;
