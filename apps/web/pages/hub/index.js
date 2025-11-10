import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import PropTypes from 'prop-types';
import Navbar from '../../components/Navbar';
import PostCard from '../../components/PostCard';
import CommentSection from '../../components/CommentSection';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorMessage from '../../components/ErrorMessage';
import { hub, auth } from '../../lib/api';

function Home({ user, setUser }) {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState(null);
  const [comments, setComments] = useState({});
  const [loadingComments, setLoadingComments] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (user) {
      loadPosts();
    }
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

  async function handleCommentClick(postId) {
    if (expandedPostId === postId) {
      // Collapse if already expanded
      setExpandedPostId(null);
    } else {
      // Expand and load comments
      setExpandedPostId(postId);
      if (!comments[postId]) {
        await loadComments(postId);
      }
    }
  }

  async function loadComments(postId) {
    try {
      setLoadingComments(true);
      const data = await hub.getComments(postId);
      setComments((prev) => ({ ...prev, [postId]: data.comments }));
    } catch (err) {
      console.error('Failed to load comments:', err);
      setError(err.message || 'Failed to load comments');
    } finally {
      setLoadingComments(false);
    }
  }

  async function refreshPostComments(postId) {
    await loadComments(postId);
    await loadPosts();
  }

  async function handleCommentAdded(postId, content, parentId = null) {
    try {
      await hub.createComment(postId, content, parentId);
      await refreshPostComments(postId);
    } catch (err) {
      console.error('Failed to add comment:', err);
      throw err;
    }
  }

  async function handleDeletePost(postId) {
    if (!confirm('Are you sure you want to delete this post? This will also delete all comments.')) return;

    try {
      await hub.deletePost(postId);
      await loadPosts(); // Refresh posts list
    } catch (err) {
      console.error('Failed to delete post:', err);
      setError(err.message || 'Failed to delete post. Please try again.');
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
              <div key={post.id}>
                <PostCard
                  post={post}
                  onLike={handleLike}
                  onComment={handleCommentClick}
                  onDelete={handleDeletePost}
                  currentUserId={user.id}
                />

                {/* Expanded Comment Section */}
                {expandedPostId === post.id && (
                  <div className="mt-4 bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-white font-semibold mb-4">Comments</h3>
                    {loadingComments ? (
                      <LoadingSpinner size="md" text="Loading comments..." />
                    ) : (
                      <CommentSection
                        postId={post.id}
                        comments={comments[post.id] || []}
                        onCommentAdded={handleCommentAdded}
                        onCommentsUpdated={refreshPostComments}
                      />
                    )}
                  </div>
                )}
              </div>
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
