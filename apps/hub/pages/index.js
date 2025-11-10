import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import PropTypes from 'prop-types';
import Navbar from '../components/Navbar';
import PostCard from '../components/PostCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { hub, auth } from '../lib/api';

function Home({ user, setUser }) {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadPosts();
  }, [user]);

  async function loadPosts() {
    try {
      setError(null);
      const data = await hub.getPosts();
      setPosts(data.posts);
    } catch (err) {
      console.error('Failed to load posts:', err);
      setError(err.message || 'Failed to load posts. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function createPost(e) {
    e.preventDefault();
    if (!newPost.trim()) return;

    try {
      setCreating(true);
      await hub.createPost({ content: newPost });
      setNewPost('');
      await loadPosts();
    } catch (err) {
      console.error('Failed to create post:', err);
      setError(err.message || 'Failed to create post. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function handleLike(postId) {
    try {
      await hub.likePost(postId);
      await loadPosts();
    } catch (err) {
      console.error('Failed to like post:', err);
      setError(err.message || 'Failed to like post. Please try again.');
    }
  }

  function handleLogout() {
    auth.logout();
    setUser(null);
    router.push('/login');
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar currentModule="Hub" user={user} onLogout={handleLogout} />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Create Post */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
          <form onSubmit={createPost}>
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full bg-gray-700 text-white rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-teal-500"
              rows="3"
            />
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Posting...' : 'Post'}
              </button>
            </div>
          </form>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6">
            <ErrorMessage message={error} onRetry={loadPosts} />
          </div>
        )}

        {/* Posts Feed */}
        {loading ? (
          <LoadingSpinner size="lg" text="Loading your feed..." />
        ) : posts.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-white text-xl font-semibold mb-2">No posts yet</h3>
            <p className="text-gray-400">Be the first to share something with the community!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onLike={handleLike}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

Home.propTypes = {
  user: PropTypes.shape({
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
  }),
  setUser: PropTypes.func.isRequired,
};

export default Home;
